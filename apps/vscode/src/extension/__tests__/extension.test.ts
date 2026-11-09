import { beforeEach, describe, expect, it, vi } from 'vitest';

const host = vi.hoisted(() => ({
  commands: new Map<string, () => Promise<void> | void>(),
  codeActionProvider: null as null | {
    provideCodeActions(
      doc: unknown,
      range: unknown,
    ): Array<{ title: string; edit: { newText: string } }>;
  },
  disposePanel: () => {},
  activeTextEditor: undefined as undefined | { document: unknown },
  written: [] as string[],
  clipboard: [] as string[],
}));

vi.mock('vscode', () => {
  const noop = { dispose() {} };
  const event = () => noop;
  class Position {
    constructor(
      readonly line: number,
      readonly character: number,
    ) {}
  }
  class Range {
    constructor(
      readonly start: Position,
      readonly end: Position,
    ) {}
  }
  class Diagnostic {
    code: unknown;
    source: unknown;
  }
  class CodeAction {
    edit: unknown;
    isPreferred = false;
    constructor(readonly title: string) {}
  }
  class WorkspaceEdit {
    newText = '';
    replace(_uri: unknown, _range: unknown, text: string) {
      this.newText = text;
    }
  }
  return {
    Position,
    Range,
    Diagnostic,
    CodeAction,
    WorkspaceEdit,
    CodeActionKind: { QuickFix: 'quickfix' },
    DiagnosticSeverity: { Error: 0, Warning: 1 },
    ViewColumn: { One: 1, Beside: -2 },
    Uri: {
      file: (fsPath: string) => ({ fsPath }),
      joinPath: (_base: unknown, ...parts: string[]) => ({ fsPath: parts.join('/') }),
    },
    languages: {
      createDiagnosticCollection: () => ({ ...noop, set() {}, delete() {} }),
      registerCodeActionsProvider: (_lang: string, provider: typeof host.codeActionProvider) => {
        host.codeActionProvider = provider;
        return noop;
      },
      registerCompletionItemProvider: () => noop,
      registerDocumentFormattingEditProvider: () => noop,
      registerDocumentSymbolProvider: () => noop,
    },
    workspace: {
      textDocuments: [],
      onDidOpenTextDocument: event,
      onDidChangeTextDocument: event,
      onDidCloseTextDocument: event,
      fs: {
        writeFile: async (_uri: unknown, bytes: Uint8Array) => {
          host.written.push(new TextDecoder().decode(bytes));
        },
      },
    },
    env: {
      clipboard: {
        writeText: async (text: string) => {
          host.clipboard.push(text);
        },
      },
    },
    commands: {
      registerCommand: (id: string, handler: () => Promise<void> | void) => {
        host.commands.set(id, handler);
        return noop;
      },
    },
    window: {
      get activeTextEditor() {
        return host.activeTextEditor;
      },
      onDidChangeTextEditorSelection: event,
      onDidChangeActiveTextEditor: event,
      showInformationMessage: async () => undefined,
      showErrorMessage: async () => undefined,
      showSaveDialog: async () => ({ fsPath: 'out.html' }),
      createWebviewPanel: () => ({
        title: '',
        reveal() {},
        onDidDispose: (listener: () => void) => {
          host.disposePanel = listener;
          return noop;
        },
        webview: {
          html: '',
          cspSource: 'csp',
          asWebviewUri: (uri: unknown) => uri,
          postMessage: async () => true,
          onDidReceiveMessage: event,
        },
      }),
    },
  };
});

import { activate } from '../extension';

function fakeDocument(text: string, name: string, languageId = 'dav') {
  return {
    languageId,
    isClosed: false,
    isUntitled: false,
    uri: { fsPath: name, toString: () => `file:///${name}` },
    getText: () => text,
    positionAt: (offset: number) => ({ line: 0, character: offset }),
    offsetAt: (position: { character: number }) => position.character,
  };
}

const run = (id: string) => host.commands.get(id)?.();

describe('extension commands', () => {
  const docA = fakeDocument('dav 1\ntitle "Doc A"\nnode a', 'a.dav');
  const docB = fakeDocument('dav 1\ntitle "Doc B"\nnode b', 'b.dav');

  beforeEach(() => {
    host.commands.clear();
    host.written.length = 0;
    host.clipboard.length = 0;
    host.activeTextEditor = undefined;
    activate({ subscriptions: [], extensionUri: { fsPath: '/ext' } } as never);
  });

  it('exports the focused document after the preview of another one was closed', async () => {
    host.activeTextEditor = { document: docA };
    await run('dav.openPreview');
    host.disposePanel();
    host.activeTextEditor = { document: docB };

    await run('dav.exportHtml');

    expect(host.written).toHaveLength(1);
    expect(host.written[0]).toContain('<title>Doc B</title>');
  });

  it('exports the previewed document when the preview has focus', async () => {
    host.activeTextEditor = { document: docA };
    await run('dav.openPreview');
    host.activeTextEditor = undefined;

    await run('dav.exportHtml');

    expect(host.written[0]).toContain('<title>Doc A</title>');
  });

  it('does not export a closed preview document or a non-dav editor', async () => {
    host.activeTextEditor = { document: docA };
    await run('dav.openPreview');
    host.disposePanel();
    host.activeTextEditor = { document: fakeDocument('plain', 'notes.txt', 'plaintext') };

    await run('dav.exportHtml');

    expect(host.written).toEqual([]);
  });

  it('does not open a preview for a non-dav editor', async () => {
    host.activeTextEditor = { document: fakeDocument('plain', 'notes.txt', 'plaintext') };
    await run('dav.openPreview');
    host.activeTextEditor = undefined;

    await run('dav.exportHtml');

    expect(host.written).toEqual([]);
  });

  it('leaves a closed preview document out of the AI prompt', async () => {
    host.activeTextEditor = { document: docA };
    await run('dav.openPreview');
    host.disposePanel();
    host.activeTextEditor = undefined;

    await run('dav.copyAiPrompt');

    expect(host.clipboard[0]).not.toContain('Doc A');
  });

  it('offers a Quick Fix for a misspelled icon', async () => {
    const text = 'dav 1\nnode a [icon: servr]';
    const doc = fakeDocument(text, 'c.dav');
    const { workspace } = await import('vscode');
    (workspace.textDocuments as unknown[]).push(doc);
    activate({ subscriptions: [], extensionUri: { fsPath: '/ext' } } as never);
    (workspace.textDocuments as unknown[]).length = 0;

    const offset = text.indexOf('servr');
    const position = { line: 0, character: offset };
    const actions = host.codeActionProvider?.provideCodeActions(doc, {
      start: position,
      end: position,
    });

    expect(actions?.map((a) => a.title)).toEqual(["Change to 'server'"]);
    expect(actions?.[0]?.edit.newText).toBe('server');
  });
});
