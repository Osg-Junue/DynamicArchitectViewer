import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import {
  type HostToWebviewMessage,
  isWebviewToHostMessage,
  type WebviewToHostMessage,
} from '../protocol/messages';
import { exportDocumentToHtml, exportDocumentToSvg, LANGUAGE_ID, toRange } from './documents';
import { t, uiLocale } from './locale';

const previewTitle = (doc: vscode.TextDocument): string =>
  `${t('プレビュー', 'Preview')}: ${fileBasename(doc.uri.fsPath)}`;

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
    panel.webview.html = this.buildWebviewHtml(panel.webview, webviewRoot);

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
    this.postToWebview({ type: 'docChanged', dsl: doc.getText(), uri: doc.uri.toString() });
  }

  private postToWebview(msg: HostToWebviewMessage): void {
    void this.panel?.webview.postMessage(msg);
  }

  private async onWebviewMessage(msg: WebviewToHostMessage): Promise<void> {
    const doc = this.activeDocument;
    if (!doc) return;

    switch (msg.type) {
      case 'ready':
        this.postDocument(doc);
        break;

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

  private buildWebviewHtml(webview: vscode.Webview, webviewRoot: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(webviewRoot, 'assets', 'webview.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(webviewRoot, 'assets', 'webview.css'),
    );
    const nonce = randomNonce();
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
    ].join('; ');

    return [
      '<!DOCTYPE html>',
      `<html lang="${uiLocale()}">`,
      '<head>',
      '<meta charset="UTF-8">',
      `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      `<link rel="stylesheet" href="${styleUri.toString()}">`,
      '<title>DynamicArchitectViewer</title>',
      '</head>',
      '<body>',
      '<div id="root"></div>',
      `<script nonce="${nonce}" type="module" src="${scriptUri.toString()}"></script>`,
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
