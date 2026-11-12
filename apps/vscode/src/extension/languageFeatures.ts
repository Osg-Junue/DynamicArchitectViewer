import * as vscode from 'vscode';
import {
  computeCompletions,
  type CompletionItemKind as DavCompletionKind,
  type Diagnostic as DavDiagnostic,
  format,
  formatDiagnostic,
  parse,
} from '../dsl';
import { LANGUAGE_ID, toRange } from './documents';
import { t, uiLocale } from './locale';

function toVsDiagnostic(
  doc: vscode.TextDocument,
  d: DavDiagnostic,
  textLength: number,
): vscode.Diagnostic {
  const range = toRange(doc, d.from, d.to, textLength);
  const severity =
    d.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
  const diag = new vscode.Diagnostic(range, formatDiagnostic(d, uiLocale()), severity);
  diag.code = d.code;
  diag.source = 'dav';
  return diag;
}

function provideQuickFixes(
  doc: vscode.TextDocument,
  range: vscode.Range | vscode.Selection,
  list: readonly DavDiagnostic[],
): vscode.CodeAction[] {
  const startOffset = doc.offsetAt(range.start);
  const endOffset = doc.offsetAt(range.end);
  const text = doc.getText();
  const actions: vscode.CodeAction[] = [];

  for (const d of list) {
    const suggestion = d.args.suggestion;
    if (!suggestion) continue;
    if (d.to < startOffset || d.from > endOffset) continue;
    const title = t(`'${suggestion}' に変更`, `Change to '${suggestion}'`);
    const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(doc.uri, toRange(doc, d.from, d.to, text.length), suggestion);
    action.edit = edit;
    action.isPreferred = true;
    actions.push(action);
  }
  return actions;
}

function provideCompletions(
  doc: vscode.TextDocument,
  position: vscode.Position,
): vscode.CompletionItem[] | undefined {
  const text = doc.getText();
  const result = computeCompletions(text, doc.offsetAt(position), true, uiLocale());
  if (!result) return undefined;
  const replaceRange = toRange(doc, result.from, result.to, text.length);
  return result.items.map((item) => {
    const ci = new vscode.CompletionItem(item.label, mapCompletionKind(item.kind));
    if (item.detail) ci.detail = item.detail;
    if (item.insertText) ci.insertText = item.insertText;
    ci.range = replaceRange;
    return ci;
  });
}

function provideFormattingEdits(doc: vscode.TextDocument): vscode.TextEdit[] {
  const text = doc.getText();
  const formatted = format(text);
  return formatted === text
    ? []
    : [vscode.TextEdit.replace(toRange(doc, 0, text.length, text.length), formatted)];
}

function provideDocumentSymbols(doc: vscode.TextDocument): vscode.DocumentSymbol[] {
  const text = doc.getText();
  const { document: model, sourceMap } = parse(text);
  const declared = (
    { id, label }: { id: string; label: string },
    kind: vscode.SymbolKind,
  ): vscode.DocumentSymbol[] => {
    const src = sourceMap.elements.get(id);
    if (!src) return [];
    const range = toRange(doc, src.from, src.to, text.length);
    const selRange = src.idRange
      ? toRange(doc, src.idRange.from, src.idRange.to, text.length)
      : range;
    return [new vscode.DocumentSymbol(id, label, kind, range, selRange)];
  };
  const symbols = [
    ...model.groups.flatMap((g) => declared(g, vscode.SymbolKind.Namespace)),
    ...model.nodes.flatMap((n) => declared(n, vscode.SymbolKind.Object)),
  ];
  model.steps.forEach((s, idx) => {
    const src = sourceMap.steps[idx];
    if (!src) return;
    const range = toRange(doc, src.from, src.to, text.length);
    symbols.push(
      new vscode.DocumentSymbol(
        `${t('ステップ', 'Step')} ${idx + 1}: ${s.title}`,
        s.description ?? '',
        vscode.SymbolKind.Event,
        range,
        range,
      ),
    );
  });
  return symbols;
}

/** Diagnostics, Quick Fixes, completion, formatting and the outline. */
export function registerLanguageFeatures(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection(LANGUAGE_ID);
  const latestDiagnostics = new Map<string, DavDiagnostic[]>();

  const refreshDiagnostics = (doc: vscode.TextDocument): DavDiagnostic[] => {
    if (doc.languageId !== LANGUAGE_ID) return [];
    const text = doc.getText();
    const { diagnostics: parsed } = parse(text);
    latestDiagnostics.set(doc.uri.toString(), parsed);
    diagnostics.set(
      doc.uri,
      parsed.map((d) => toVsDiagnostic(doc, d, text.length)),
    );
    return parsed;
  };

  // Defer initial workspace-wide diagnostics so cold command activation (e.g. dav.openPreview)
  // registers and runs without synchronous parsing stalls.
  const initialDocs = vscode.workspace.textDocuments.filter(
    (doc) => doc.languageId === LANGUAGE_ID,
  );
  if (initialDocs.length > 0) {
    const timer = setTimeout(() => {
      for (const doc of initialDocs) {
        if (!doc.isClosed && !latestDiagnostics.has(doc.uri.toString())) {
          refreshDiagnostics(doc);
        }
      }
    }, 0);
    context.subscriptions.push({ dispose: () => clearTimeout(timer) });
  }

  context.subscriptions.push(
    diagnostics,
    vscode.workspace.onDidOpenTextDocument((doc) => {
      refreshDiagnostics(doc);
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      refreshDiagnostics(e.document);
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnostics.delete(doc.uri);
      latestDiagnostics.delete(doc.uri.toString());
    }),
    // Quick Fix CodeActionProvider for diagnostics with suggestions
    vscode.languages.registerCodeActionsProvider(
      LANGUAGE_ID,
      {
        provideCodeActions(doc, range) {
          const list = latestDiagnostics.get(doc.uri.toString()) ?? refreshDiagnostics(doc);
          return provideQuickFixes(doc, range, list);
        },
      },
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
    ),
    // Autocomplete CompletionItemProvider
    vscode.languages.registerCompletionItemProvider(
      LANGUAGE_ID,
      { provideCompletionItems: provideCompletions },
      ':',
      '[',
      ' ',
    ),
    // Formatter DocumentFormattingEditProvider
    vscode.languages.registerDocumentFormattingEditProvider(LANGUAGE_ID, {
      provideDocumentFormattingEdits: provideFormattingEdits,
    }),
    // Outline / Breadcrumbs DocumentSymbolProvider
    vscode.languages.registerDocumentSymbolProvider(LANGUAGE_ID, {
      provideDocumentSymbols,
    }),
  );
}

function mapCompletionKind(kind: DavCompletionKind): vscode.CompletionItemKind {
  switch (kind) {
    case 'keyword':
      return vscode.CompletionItemKind.Keyword;
    case 'property':
      return vscode.CompletionItemKind.Property;
    case 'constant':
      return vscode.CompletionItemKind.Constant;
    case 'variable':
      return vscode.CompletionItemKind.Variable;
    case 'class':
      return vscode.CompletionItemKind.Class;
  }
}
