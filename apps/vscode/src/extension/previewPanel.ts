import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as vscode from 'vscode';
import {
  escapeJsonForHtml,
  type HostToWebviewMessage,
  INITIAL_DOC_ELEMENT_ID,
  isWebviewToHostMessage,
  serializeInitialDoc,
  type WebviewToHostMessage,
} from '../protocol/messages';
import { exportDocumentToHtml, exportDocumentToSvg, LANGUAGE_ID, toRange } from './documents';
import { t, uiLocale } from './locale';

const previewTitle = (doc: vscode.TextDocument): string =>
  `${t('プレビュー', 'Preview')}: ${fileBasename(doc.uri.fsPath)}`;

interface InlineWebviewAssets {
  css: string;
  js: string;
}

const inlineAssetCache = new Map<string, InlineWebviewAssets>();

export function clearWebviewAssetCache(): void {
  inlineAssetCache.clear();
}

function isSafeInlineAsset(content: string): boolean {
  return !/<\/(script|style)/i.test(content) && !content.includes('<!--');
}

/**
 * Reads `webview.css` and `webview.js` once per extension root so cold Webview startup
 * needs zero `vscode-resource` Service Worker network requests. Falls back to external
 * URIs if assets are unavailable on disk (e.g. in unit-test mocks) or fail inline checks.
 */
function readInlineWebviewAssets(webviewRootFsPath: string): InlineWebviewAssets | null {
  const cached = inlineAssetCache.get(webviewRootFsPath);
  if (cached) return cached;
  try {
    const css = readFileSync(join(webviewRootFsPath, 'assets', 'webview.css'), 'utf8');
    const js = readFileSync(join(webviewRootFsPath, 'assets', 'webview.js'), 'utf8');
    if (!isSafeInlineAsset(css) || !isSafeInlineAsset(js)) return null;
    const assets: InlineWebviewAssets = { css, js };
    inlineAssetCache.set(webviewRootFsPath, assets);
    return assets;
  } catch {
    return null;
  }
}

/** The one preview panel, which shows the most recent `.dav` document. */
export class CanvasPanelManager {
  private panel: vscode.WebviewPanel | null = null;
  activeDocument: vscode.TextDocument | null = null;
  private disposables: vscode.Disposable[] = [];

  constructor(private readonly extensionUri: vscode.Uri) {}

  open(document: vscode.TextDocument): void {
    if (this.panel) {
      this.showDocument(document, true);
      return;
    }

    this.activeDocument = document;
    const webviewRoot = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview');
    const panel = vscode.window.createWebviewPanel(
      'dav.canvasPreview',
      previewTitle(document),
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [webviewRoot],
      },
    );
    this.panel = panel;
    panel.webview.html = this.buildWebviewHtml(panel.webview, webviewRoot, document);

    this.disposables.push(
      panel.onDidDispose(() => {
        this.panel = null;
        this.activeDocument = null;
        for (const d of this.disposables) d.dispose();
        this.disposables = [];
      }),
      panel.webview.onDidReceiveMessage((msg: unknown) => {
        if (!isWebviewToHostMessage(msg)) return;
        this.onWebviewMessage(msg).catch((err: unknown) => {
          const detail = err instanceof Error ? err.message : String(err);
          void vscode.window.showErrorMessage(`DynamicArchitectViewer: ${detail}`);
        });
      }),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (this.isActive(e.document)) this.postDocument(e.document);
      }),
      vscode.window.onDidChangeTextEditorSelection((e) => {
        if (this.isActive(e.textEditor.document)) {
          const offset = e.textEditor.document.offsetAt(
            e.selections[0]?.active ?? new vscode.Position(0, 0),
          );
          this.postToWebview({ type: 'cursorMoved', offset });
        }
      }),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.languageId === LANGUAGE_ID) {
          this.showDocument(editor.document);
        }
      }),
    );
  }

  private showDocument(doc: vscode.TextDocument, reveal = false): void {
    this.activeDocument = doc;
    if (!this.panel) return;
    this.panel.title = previewTitle(doc);
    if (reveal) this.panel.reveal(vscode.ViewColumn.Beside);
    this.postDocument(doc);
  }

  private isActive(doc: vscode.TextDocument): boolean {
    return doc.uri.toString() === this.activeDocument?.uri.toString();
  }

  private postDocument(doc: vscode.TextDocument): void {
    this.postToWebview({
      type: 'docChanged',
      dsl: doc.getText(),
      uri: doc.uri.toString(),
      ...(typeof doc.version === 'number' ? { version: doc.version } : {}),
    });
  }

  private postToWebview(msg: HostToWebviewMessage): void {
    void this.panel?.webview.postMessage(msg);
  }

  private async onWebviewMessage(msg: WebviewToHostMessage): Promise<void> {
    const doc = this.activeDocument;
    if (!doc) return;

    switch (msg.type) {
      case 'ready': {
        const upToDate =
          msg.uri !== undefined &&
          msg.uri === doc.uri.toString() &&
          typeof msg.version === 'number' &&
          msg.version === doc.version;
        if (!upToDate) {
          this.postDocument(doc);
        }
        break;
      }

      case 'revealRange': {
        const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One, false);
        const range = toRange(doc, msg.from, msg.to);
        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        break;
      }

      case 'exportHtml':
        await exportDocumentToHtml(doc, msg.dsl);
        break;

      case 'exportSvg':
        await exportDocumentToSvg(doc, {
          dsl: msg.dsl,
          animate: msg.animate,
          camera: msg.camera,
          step: msg.step,
        });
        break;
    }
  }

  private buildWebviewHtml(
    webview: vscode.Webview,
    webviewRoot: vscode.Uri,
    document: vscode.TextDocument,
  ): string {
    const nonce = randomNonce();
    const inlineAssets = readInlineWebviewAssets(webviewRoot.fsPath);
    const helpScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(webviewRoot, 'assets', 'HelpModal.js'),
    );
    const initialDocJson = serializeInitialDoc({
      uri: document.uri.toString(),
      dsl: document.getText(),
      ...(typeof document.version === 'number' ? { version: document.version } : {}),
    });

    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} data:`,
      `style-src 'nonce-${nonce}' ${webview.cspSource}`,
      `script-src 'nonce-${nonce}' ${webview.cspSource}`,
    ].join('; ');

    const styleTag = inlineAssets
      ? `<style nonce="${nonce}">${inlineAssets.css}</style>`
      : `<link rel="stylesheet" href="${webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, 'assets', 'webview.css')).toString()}">`;

    // Maps the lazy HelpModal chunk URL without setting <base href> (which breaks SVG url(#id) markers).
    const importMapTag = inlineAssets
      ? `<script nonce="${nonce}" type="importmap">${escapeJsonForHtml(JSON.stringify({ imports: { './HelpModal.js': helpScriptUri.toString() } }))}</script>`
      : '';

    const scriptTag = inlineAssets
      ? `<script nonce="${nonce}" type="module">${inlineAssets.js}</script>`
      : `<script nonce="${nonce}" type="module" src="${webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, 'assets', 'webview.js')).toString()}"></script>`;

    return [
      '<!DOCTYPE html>',
      `<html lang="${uiLocale()}">`,
      '<head>',
      '<meta charset="UTF-8">',
      `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      styleTag,
      '<title>DynamicArchitectViewer</title>',
      '</head>',
      '<body>',
      '<div id="root"></div>',
      `<script id="${INITIAL_DOC_ELEMENT_ID}" type="application/json">${initialDocJson}</script>`,
      ...(importMapTag ? [importMapTag] : []),
      scriptTag,
      '</body>',
      '</html>',
    ].join('\n');
  }
}

function fileBasename(fsPath: string): string {
  return fsPath.split(/[\\/]/).pop() || 'Untitled.dav';
}

function randomNonce(): string {
  return randomBytes(16).toString('hex');
}
