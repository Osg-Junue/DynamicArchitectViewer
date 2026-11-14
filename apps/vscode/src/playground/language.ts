import * as monaco from 'monaco-editor/editor';
import configuration from '../../language-configuration.json';
import {
  computeCompletions,
  type CompletionItemKind as DavCompletionKind,
  type Diagnostic as DavDiagnostic,
  format,
  formatDiagnostic,
  parse,
} from '../dsl';
import type { ViewerLocale } from '../runtime/i18n';
import { DAV_THEMES, DAV_TOKENS } from './tokens';

export const LANGUAGE_ID = 'dav';

type Model = monaco.editor.ITextModel;

const COMPLETION_KINDS: Record<DavCompletionKind, monaco.languages.CompletionItemKind> = {
  keyword: monaco.languages.CompletionItemKind.Keyword,
  property: monaco.languages.CompletionItemKind.Property,
  constant: monaco.languages.CompletionItemKind.Constant,
  variable: monaco.languages.CompletionItemKind.Variable,
  class: monaco.languages.CompletionItemKind.Class,
};

function toRange(model: Model, from: number, to: number): monaco.Range {
  const length = model.getValueLength();
  const safeFrom = Math.min(length, Math.max(0, from));
  const safeTo = Math.min(length, Math.max(safeFrom, to));
  return monaco.Range.fromPositions(model.getPositionAt(safeFrom), model.getPositionAt(safeTo));
}

function documentSymbols(model: Model, locale: ViewerLocale): monaco.languages.DocumentSymbol[] {
  const { document, sourceMap } = parse(model.getValue());
  const declared = (
    { id, label }: { id: string; label: string },
    kind: monaco.languages.SymbolKind,
  ): monaco.languages.DocumentSymbol | undefined => {
    const src = sourceMap.elements.get(id);
    if (!src) return undefined;
    const range = toRange(model, src.from, src.to);
    return {
      name: id,
      detail: label,
      kind,
      tags: [],
      range,
      selectionRange: src.idRange ? toRange(model, src.idRange.from, src.idRange.to) : range,
      children: [],
    };
  };
  // Groups hold their nodes and nested groups, as they do in the diagram.
  const symbols: monaco.languages.DocumentSymbol[] = [];
  const groupSymbols = new Map<string, monaco.languages.DocumentSymbol>();
  const place = (
    parentId: string | undefined,
    symbol: monaco.languages.DocumentSymbol | undefined,
  ) => {
    if (!symbol) return;
    const parent = parentId === undefined ? undefined : groupSymbols.get(parentId);
    (parent?.children ?? symbols).push(symbol);
  };
  // Parents always precede their children in `document.groups`.
  for (const group of document.groups) {
    const symbol = declared(group, monaco.languages.SymbolKind.Namespace);
    if (symbol) groupSymbols.set(group.id, symbol);
    place(group.parentId, symbol);
  }
  for (const node of document.nodes) {
    place(node.parentId, declared(node, monaco.languages.SymbolKind.Object));
  }
  document.steps.forEach((step, index) => {
    const src = sourceMap.steps[index];
    if (!src) return;
    const range = toRange(model, src.from, src.to);
    symbols.push({
      name: `${locale === 'ja' ? 'ステップ' : 'Step'} ${index + 1}: ${step.title}`,
      detail: step.description ?? '',
      kind: monaco.languages.SymbolKind.Event,
      tags: [],
      range,
      selectionRange: range,
    });
  });
  return symbols;
}

/**
 * Teaches Monaco the language, as `extension/languageFeatures.ts` teaches VS Code: coloring,
 * brackets and folding, completion, Quick Fixes, formatting and the outline. The diagnostics of a
 * model are kept by `refreshDiagnostics`, which the editor calls on every change.
 */
export function registerLanguage(locale: ViewerLocale): {
  refreshDiagnostics(model: Model): void;
} {
  const latest = new WeakMap<Model, DavDiagnostic[]>();

  monaco.languages.register({ id: LANGUAGE_ID, extensions: ['.dav'] });
  monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, DAV_TOKENS);
  for (const [name, data] of Object.entries(DAV_THEMES)) monaco.editor.defineTheme(name, data);

  // The same file the extension contributes, in the shape Monaco takes.
  const { markers } = configuration.folding;
  monaco.languages.setLanguageConfiguration(LANGUAGE_ID, {
    comments: configuration.comments,
    brackets: configuration.brackets as [string, string][],
    autoClosingPairs: configuration.autoClosingPairs,
    surroundingPairs: configuration.surroundingPairs.map(([open = '', close = '']) => ({
      open,
      close,
    })),
    folding: { markers: { start: new RegExp(markers.start), end: new RegExp(markers.end) } },
  });

  monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
    triggerCharacters: [':', '[', ' '],
    provideCompletionItems(model, position, context) {
      // A trigger character offers what the statement expects there; the full list of statements
      // on an empty spot waits until the reader asks for it, or it would open after every space.
      const explicit = context.triggerKind === monaco.languages.CompletionTriggerKind.Invoke;
      const result = computeCompletions(
        model.getValue(),
        model.getOffsetAt(position),
        explicit,
        locale,
      );
      if (!result) return { suggestions: [] };
      const range = toRange(model, result.from, result.to);
      return {
        suggestions: result.items.map((item) => ({
          label: item.label,
          kind: COMPLETION_KINDS[item.kind],
          insertText: item.insertText ?? item.label,
          range,
          ...(item.detail ? { detail: item.detail } : {}),
        })),
      };
    },
  });

  monaco.languages.registerCodeActionProvider(
    LANGUAGE_ID,
    {
      provideCodeActions(model, range) {
        const start = model.getOffsetAt(range.getStartPosition());
        const end = model.getOffsetAt(range.getEndPosition());
        const actions: monaco.languages.CodeAction[] = [];
        for (const d of latest.get(model) ?? []) {
          const suggestion = d.args.suggestion;
          if (!suggestion || d.to < start || d.from > end) continue;
          actions.push({
            title: locale === 'ja' ? `'${suggestion}' に変更` : `Change to '${suggestion}'`,
            kind: 'quickfix',
            isPreferred: true,
            edit: {
              edits: [
                {
                  resource: model.uri,
                  versionId: undefined,
                  textEdit: { range: toRange(model, d.from, d.to), text: suggestion },
                },
              ],
            },
          });
        }
        return { actions, dispose() {} };
      },
    },
    { providedCodeActionKinds: ['quickfix'] },
  );

  monaco.languages.registerDocumentFormattingEditProvider(LANGUAGE_ID, {
    provideDocumentFormattingEdits(model) {
      const text = model.getValue();
      const formatted = format(text);
      return formatted === text ? [] : [{ range: model.getFullModelRange(), text: formatted }];
    },
  });

  monaco.languages.registerDocumentSymbolProvider(LANGUAGE_ID, {
    provideDocumentSymbols: (model) => documentSymbols(model, locale),
  });

  return {
    refreshDiagnostics(model) {
      const { diagnostics } = parse(model.getValue());
      latest.set(model, diagnostics);
      monaco.editor.setModelMarkers(
        model,
        LANGUAGE_ID,
        diagnostics.map((d) => {
          const { startLineNumber, startColumn, endLineNumber, endColumn } = toRange(
            model,
            d.from,
            d.to,
          );
          return {
            startLineNumber,
            startColumn,
            endLineNumber,
            endColumn,
            message: formatDiagnostic(d, locale),
            severity:
              d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
            code: d.code,
            source: LANGUAGE_ID,
          };
        }),
      );
    },
  };
}
