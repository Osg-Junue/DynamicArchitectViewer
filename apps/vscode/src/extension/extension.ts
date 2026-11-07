import * as vscode from 'vscode';
import {
  computeCompletions,
  type CompletionItemKind as DavCompletionKind,
  type Diagnostic as DavDiagnostic,
  format,
  formatDiagnostic,
  type Locale,
  parse,
} from '../dsl';
import { exportHtml, importContent } from '../exporter';
import type { HostToWebviewMessage, WebviewToHostMessage } from '../protocol/messages';
import { SAMPLES } from '../samples';

const LANGUAGE_ID = 'dav';

function currentLocale(): Locale {
  return vscode.env.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export function activate(context: vscode.ExtensionContext): void {
  const locale = currentLocale();
  const diagnostics = vscode.languages.createDiagnosticCollection(LANGUAGE_ID);
  const latestDiagnostics = new Map<string, DavDiagnostic[]>();

  const refreshDiagnostics = (doc: vscode.TextDocument) => {
    if (doc.languageId !== LANGUAGE_ID) return;
    const text = doc.getText();
    const { diagnostics: parsed } = parse(text);
    latestDiagnostics.set(doc.uri.toString(), parsed);

    const items = parsed.map((d) => {
      const range = new vscode.Range(
        doc.positionAt(Math.min(d.from, text.length)),
        doc.positionAt(Math.min(Math.max(d.to, d.from), text.length)),
      );
      const severity =
        d.severity === 'error'
          ? vscode.DiagnosticSeverity.Error
          : vscode.DiagnosticSeverity.Warning;
      const diag = new vscode.Diagnostic(range, formatDiagnostic(d, locale), severity);
      diag.code = d.code;
      diag.source = 'dav';
      return diag;
    });
    diagnostics.set(doc.uri, items);
  };

  for (const doc of vscode.workspace.textDocuments) {
    refreshDiagnostics(doc);
  }

  context.subscriptions.push(
    diagnostics,
    vscode.workspace.onDidOpenTextDocument(refreshDiagnostics),
    vscode.workspace.onDidChangeTextDocument((e) => refreshDiagnostics(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnostics.delete(doc.uri);
      latestDiagnostics.delete(doc.uri.toString());
    }),
  );

  // Quick Fix CodeActionProvider for diagnostics with suggestions
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      LANGUAGE_ID,
      {
        provideCodeActions(doc, range) {
          const list = latestDiagnostics.get(doc.uri.toString()) ?? [];
          const startOffset = doc.offsetAt(range.start);
          const endOffset = doc.offsetAt(range.end);
          const actions: vscode.CodeAction[] = [];

          for (const d of list) {
            const hint = d.args.hint;
            if (!hint) continue;
            if (d.to < startOffset || d.from > endOffset) continue;
            const title = locale === 'ja' ? `「${hint}」に修正` : `Change to '${hint}'`;
            const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
            const edit = new vscode.WorkspaceEdit();
            edit.replace(
              doc.uri,
              new vscode.Range(doc.positionAt(d.from), doc.positionAt(d.to)),
              hint,
            );
            action.edit = edit;
            action.isPreferred = true;
            actions.push(action);
          }
          return actions;
        },
      },
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
    ),
  );

  // Autocomplete CompletionItemProvider
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      LANGUAGE_ID,
      {
        provideCompletionItems(doc, position) {
          const result = computeCompletions(doc.getText(), doc.offsetAt(position), true);
          if (!result) return undefined;
          const replaceRange = new vscode.Range(
            doc.positionAt(result.from),
            doc.positionAt(result.to),
          );
          return result.items.map((item) => {
            const ci = new vscode.CompletionItem(item.label, mapCompletionKind(item.kind));
            if (item.detail) ci.detail = item.detail;
            if (item.insertText) ci.insertText = item.insertText;
            ci.range = replaceRange;
            return ci;
          });
        },
      },
      ':',
      '@',
      '[',
      ' ',
    ),
  );

  // Formatter DocumentFormattingEditProvider
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(LANGUAGE_ID, {
      provideDocumentFormattingEdits(doc) {
        const text = doc.getText();
        const formatted = format(text);
        if (formatted === text) return [];
        const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(text.length));
        return [vscode.TextEdit.replace(fullRange, formatted)];
      },
    }),
  );

  // Outline / Breadcrumbs DocumentSymbolProvider
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(LANGUAGE_ID, {
      provideDocumentSymbols(doc) {
        const text = doc.getText();
        const { document: model, sourceMap } = parse(text);
        const symbols: vscode.DocumentSymbol[] = [];

        for (const g of model.groups) {
          const src = sourceMap.elements.get(g.id);
          if (!src) continue;
          const range = toRange(doc, src.from, src.to);
          const selRange = src.idRange ? toRange(doc, src.idRange.from, src.idRange.to) : range;
          symbols.push(
            new vscode.DocumentSymbol(g.id, g.label, vscode.SymbolKind.Namespace, range, selRange),
          );
        }
        for (const n of model.nodes) {
          const src = sourceMap.elements.get(n.id);
          if (!src) continue;
          const range = toRange(doc, src.from, src.to);
          const selRange = src.idRange ? toRange(doc, src.idRange.from, src.idRange.to) : range;
          symbols.push(
            new vscode.DocumentSymbol(n.id, n.label, vscode.SymbolKind.Object, range, selRange),
          );
        }
        model.steps.forEach((s, idx) => {
          const src = sourceMap.steps[idx];
          if (!src) return;
          const range = toRange(doc, src.from, src.to);
          symbols.push(
            new vscode.DocumentSymbol(
              `Step ${idx + 1}: ${s.title}`,
              s.description ?? '',
              vscode.SymbolKind.Event,
              range,
              range,
            ),
          );
        });
        return symbols;
      },
    }),
  );

  // Canvas Preview Panel Manager
  const panelManager = new CanvasPanelManager(context.extensionUri);

  context.subscriptions.push(
    vscode.commands.registerCommand('dav.openPreview', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        void vscode.window.showInformationMessage('Open a .dav file first.');
        return;
      }
      panelManager.open(editor.document);
    }),
    vscode.commands.registerCommand('dav.exportHtml', async () => {
      const doc = panelManager.activeDocument ?? vscode.window.activeTextEditor?.document;
      if (!doc) {
        void vscode.window.showInformationMessage('Open a .dav file first.');
        return;
      }
      await exportDocumentToHtml(doc, locale);
    }),
    vscode.commands.registerCommand('dav.importHtml', async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'Standalone HTML / DAV': ['html', 'dav'] },
      });
      const uri = uris?.[0];
      if (!uri) return;
      const bytes = await vscode.workspace.fs.readFile(uri);
      const content = new TextDecoder('utf-8').decode(bytes);
      const res = importContent(content);
      if (!res.ok) {
        void vscode.window.showErrorMessage(`Could not import HTML (${res.reason}).`);
        return;
      }
      const doc = await vscode.workspace.openTextDocument({
        language: LANGUAGE_ID,
        content: res.dsl,
      });
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
      panelManager.open(doc);
    }),
    vscode.commands.registerCommand('dav.newFromTemplate', async () => {
      const picked = await vscode.window.showQuickPick(
        SAMPLES.map((s) => ({ label: s.name, detail: s.id, dsl: s.dsl })),
        { placeHolder: 'Select a sample diagram template' },
      );
      if (!picked) return;
      const doc = await vscode.workspace.openTextDocument({
        language: LANGUAGE_ID,
        content: picked.dsl,
      });
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
      panelManager.open(doc);
    }),
  );
}

export function deactivate(): void {}

class CanvasPanelManager {
  private panel: vscode.WebviewPanel | null = null;
  activeDocument: vscode.TextDocument | null = null;
  private applyingFromWebview = false;
  private disposables: vscode.Disposable[] = [];

  constructor(private readonly extensionUri: vscode.Uri) {}

  open(document: vscode.TextDocument): void {
    this.activeDocument = document;

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      this.postToWebview({
        type: 'docChanged',
        dsl: document.getText(),
        uri: document.uri.toString(),
      });
      return;
    }

    const webviewRoot = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview');
    const panel = vscode.window.createWebviewPanel(
      'dav.canvasPreview',
      `Preview: ${fileBasename(document.uri.fsPath)}`,
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
        for (const d of this.disposables) d.dispose();
        this.disposables = [];
      }),
      panel.webview.onDidReceiveMessage((msg: WebviewToHostMessage) => {
        void this.onWebviewMessage(msg);
      }),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (this.applyingFromWebview) return;
        if (
          this.activeDocument &&
          e.document.uri.toString() === this.activeDocument.uri.toString()
        ) {
          this.postToWebview({
            type: 'docChanged',
            dsl: e.document.getText(),
            uri: e.document.uri.toString(),
          });
        }
      }),
      vscode.window.onDidChangeTextEditorSelection((e) => {
        if (
          this.activeDocument &&
          e.textEditor.document.uri.toString() === this.activeDocument.uri.toString()
        ) {
          const offset = e.textEditor.document.offsetAt(
            e.selections[0]?.active ?? new vscode.Position(0, 0),
          );
          this.postToWebview({ type: 'cursorMoved', offset });
        }
      }),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.languageId === LANGUAGE_ID) {
          this.activeDocument = editor.document;
          panel.title = `Preview: ${fileBasename(editor.document.uri.fsPath)}`;
          this.postToWebview({
            type: 'docChanged',
            dsl: editor.document.getText(),
            uri: editor.document.uri.toString(),
          });
        }
      }),
    );
  }

  private postToWebview(msg: HostToWebviewMessage): void {
    void this.panel?.webview.postMessage(msg);
  }

  private async onWebviewMessage(msg: WebviewToHostMessage): Promise<void> {
    const doc = this.activeDocument;
    if (!doc) return;

    switch (msg.type) {
      case 'ready':
        this.postToWebview({
          type: 'docChanged',
          dsl: doc.getText(),
          uri: doc.uri.toString(),
        });
        break;

      case 'updateDsl': {
        const current = doc.getText();
        if (current === msg.dsl) return;
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(current.length));
        edit.replace(doc.uri, fullRange, msg.dsl);
        this.applyingFromWebview = true;
        try {
          await vscode.workspace.applyEdit(edit);
        } finally {
          this.applyingFromWebview = false;
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
        await exportDocumentToHtml(doc, currentLocale(), msg.dsl);
        break;

      case 'formatDocument': {
        const text = doc.getText();
        const formatted = format(text);
        if (formatted !== text) {
          const edit = new vscode.WorkspaceEdit();
          edit.replace(
            doc.uri,
            new vscode.Range(doc.positionAt(0), doc.positionAt(text.length)),
            formatted,
          );
          await vscode.workspace.applyEdit(edit);
        }
        break;
      }
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
      `<html lang="${currentLocale()}">`,
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

async function exportDocumentToHtml(
  doc: vscode.TextDocument,
  locale: Locale,
  overrideDsl?: string,
): Promise<void> {
  const dsl = overrideDsl ?? doc.getText();
  const html = await exportHtml(dsl, { locale });
  const defaultPath = `${doc.uri.fsPath.replace(/\.dav$/i, '')}.html`;
  const targetUri = await vscode.window.showSaveDialog({
    defaultUri: doc.isUntitled ? vscode.Uri.file('diagram.html') : vscode.Uri.file(defaultPath),
    filters: { 'Standalone HTML': ['html'] },
  });
  if (!targetUri) return;
  await vscode.workspace.fs.writeFile(targetUri, new TextEncoder().encode(html));
  void vscode.window.showInformationMessage(`Exported standalone HTML: ${targetUri.fsPath}`);
}

function toRange(doc: vscode.TextDocument, from: number, to: number): vscode.Range {
  const len = doc.getText().length;
  const safeFrom = Math.max(0, Math.min(from, len));
  const safeTo = Math.max(safeFrom, Math.min(to, len));
  return new vscode.Range(doc.positionAt(safeFrom), doc.positionAt(safeTo));
}

function mapCompletionKind(kind: DavCompletionKind): vscode.CompletionItemKind {
  switch (kind) {
    case 'keyword':
      return vscode.CompletionItemKind.Keyword;
    case 'property':
      return vscode.CompletionItemKind.Property;
    case 'constant':
      return vscode.CompletionItemKind.Constant;
    case 'enum':
      return vscode.CompletionItemKind.EnumMember;
    case 'variable':
      return vscode.CompletionItemKind.Variable;
    case 'class':
      return vscode.CompletionItemKind.Class;
  }
}

function fileBasename(fsPath: string): string {
  return fsPath.split(/[\\/]/).pop() || 'Untitled.dav';
}

function randomNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}
