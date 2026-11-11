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

/** Diagnostics, Quick Fixes, completion, formatting and the outline. */
export function registerLanguageFeatures(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection(LANGUAGE_ID);
  const latestDiagnostics = new Map<string, DavDiagnostic[]>();

  const refreshDiagnostics = (doc: vscode.TextDocument) => {
    if (doc.languageId !== LANGUAGE_ID) return;
    const text = doc.getText();
    const { diagnostics: parsed } = parse(text);
    latestDiagnostics.set(doc.uri.toString(), parsed);

    const items = parsed.map((d) => {
      const range = toRange(doc, d.from, d.to, text.length);
      const severity =
        d.severity === 'error'
          ? vscode.DiagnosticSeverity.Error
          : vscode.DiagnosticSeverity.Warning;
      const diag = new vscode.Diagnostic(range, formatDiagnostic(d, uiLocale()), severity);
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
        },
      },
      ':',
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
        return formatted === text
          ? []
          : [vscode.TextEdit.replace(toRange(doc, 0, text.length, text.length), formatted)];
      },
    }),
  );

  // Outline / Breadcrumbs DocumentSymbolProvider
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(LANGUAGE_ID, {
      provideDocumentSymbols(doc) {
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
      },
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
