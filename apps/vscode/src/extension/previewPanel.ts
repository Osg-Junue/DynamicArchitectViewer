import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as vscode from 'vscode';
import {
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

const inlineCssCache = new Map<string, string>();

export function clearWebviewAssetCache(): void {
  inlineCssCache.clear();
}

function isSafeInlineStyle(content: string): boolean {
  return !/<\/style/i.test(content) && !content.includes('<!--');
}

/**
 * Reads `webview.css` once per extension root, to put it in the page: the toolbar is styled
 * before the script arrives, with one request fewer. `null` when the file cannot be read (as
 * in unit-test mocks) or is not safe to inline, and the page links to it instead.
 *
 * The script stays a file of its own. The lazy documentation chunk imports from it, and an
 * inline copy would have no URL to import from, so the browser would load and run it twice.
 */
function readInlineWebviewCss(webviewRootFsPath: string): string | null {
  const cached = inlineCssCache.get(webviewRootFsPath);
  if (cached !== undefined) return cached;
  try {
    const css = readFileSync(join(webviewRootFsPath, 'assets', 'webview.css'), 'utf8');
    if (!isSafeInlineStyle(css)) return null;
    inlineCssCache.set(webviewRootFsPath, css);
    return css;
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
    const inlineCss = readInlineWebviewCss(webviewRoot.fsPath);
    const assetUri = (name: string): string =>
      webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, 'assets', name)).toString();
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

    const styleTag =
      inlineCss !== null
        ? `<style nonce="${nonce}">${inlineCss}</style>`
        : `<link rel="stylesheet" href="${assetUri('webview.css')}">`;
    const scriptTag = `<script nonce="${nonce}" type="module" src="${assetUri('webview.js')}"></script>`;

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
