import { beforeEach, describe, expect, it, vi } from 'vitest';

const { freshHostState, host } = vi.hoisted(() => {
  const freshHostState = () => ({
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
    language: 'en',
    workspaceFolders: undefined as undefined | Array<{ uri: { fsPath: string } }>,
    quickPick: [] as Array<{ label: string; description: string; detail: string }>,
    pickIndex: 0 as number | null,
    existing: new Set<string>(),
    copied: [] as Array<{ from: string; to: string }>,
    warnings: [] as string[],
    errors: [] as string[],
    warningAnswer: undefined as string | undefined,
    saveDefaultUri: undefined as string | undefined,
    saveUri: { fsPath: 'out.html' } as { fsPath: string } | undefined,
    webviewHtml: '',
    webviewPosted: [] as unknown[],
    receive: (_msg: unknown): void => {},
  });
  return { freshHostState, host: freshHostState() };
});

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
      joinPath: (base: { fsPath: string }, ...parts: string[]) => ({
        fsPath: [base.fsPath, ...parts].join('/'),
      }),
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
      get workspaceFolders() {
        return host.workspaceFolders;
      },
      onDidOpenTextDocument: event,
      onDidChangeTextDocument: event,
      onDidCloseTextDocument: event,
      fs: {
        writeFile: async (_uri: unknown, bytes: Uint8Array) => {
          host.written.push(new TextDecoder().decode(bytes));
        },
        stat: async (uri: { fsPath: string }) => {
          if (!host.existing.has(uri.fsPath)) throw new Error('not found');
          return {};
        },
        createDirectory: async () => {},
        copy: async (from: { fsPath: string }, to: { fsPath: string }) => {
          host.copied.push({ from: from.fsPath, to: to.fsPath });
        },
      },
    },
    env: {
      get language() {
        return host.language;
      },
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
      showErrorMessage: async (msg: string) => {
        host.errors.push(msg);
        return undefined;
      },
      showWarningMessage: async (msg: string) => {
        host.warnings.push(msg);
        return host.warningAnswer;
      },
      showQuickPick: async (items: typeof host.quickPick) => {
        host.quickPick = items;
        return host.pickIndex === null ? undefined : items[host.pickIndex];
      },
      showSaveDialog: async (options?: { defaultUri?: { fsPath: string } }) => {
        host.saveDefaultUri = options?.defaultUri?.fsPath;
        return host.saveUri;
      },
      createWebviewPanel: () => {
        const webview = {
          get html() {
            return host.webviewHtml;
          },
          set html(value: string) {
            host.webviewHtml = value;
          },
          cspSource: 'https://csp.example',
          asWebviewUri: (uri: { fsPath: string }) => ({
            fsPath: uri.fsPath,
            toString: () =>
              `https://csp.example/${uri.fsPath.replaceAll('\\', '/').replace(/^\/+/, '')}`,
          }),
          postMessage: async (msg: unknown) => {
            host.webviewPosted.push(msg);
            return true;
          },
          onDidReceiveMessage: (listener: (msg: unknown) => void) => {
            host.receive = listener;
            return noop;
          },
        };
        return {
          title: '',
          reveal() {},
          onDidDispose: (listener: () => void) => {
            host.disposePanel = listener;
            return noop;
          },
          webview,
        };
      },
    },
  };
});

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { escapeJsonForHtml } from '../../model/text';
import {
  INITIAL_DOC_ELEMENT_ID,
  isHostToWebviewMessage,
  isInitialDocPayload,
  isWebviewToHostMessage,
  serializeInitialDoc,
} from '../../protocol/messages';
import { activate } from '../extension';
import { clearWebviewAssetCache } from '../previewPanel';

function fakeDocument(
  text: string,
  name: string,
  languageId = 'dav',
  isUntitled = false,
  version = 1,
) {
  return {
    languageId,
    isClosed: false,
    isUntitled,
    version,
    uri: {
      fsPath: name,
      toString: () => (isUntitled ? `untitled:${name}` : `file:///${name}`),
    },
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
    Object.assign(host, freshHostState());
    activate({ subscriptions: [], extensionUri: { fsPath: '/ext' } } as never);
  });

  describe('dav.installAgentSkill', () => {
    const packaged = '/ext/dist/skill/dav-diagrams';
    const workspaceTarget = '/repo/.claude/skills/dav-diagrams';

    it('copies the packaged skill into the workspace of the chosen agent', async () => {
      host.workspaceFolders = [{ uri: { fsPath: '/repo' } }];

      await run('dav.installAgentSkill');

      expect(host.quickPick.map((item) => item.detail)).toEqual([
        '.claude/skills',
        '~/.claude/skills',
        '.github/skills',
        '~/.copilot/skills',
        '.agents/skills',
        '~/.agents/skills',
      ]);
      expect(host.copied).toEqual([{ from: packaged, to: workspaceTarget }]);
    });

    it('offers only personal locations without a workspace', async () => {
      await run('dav.installAgentSkill');

      expect(host.quickPick.map((item) => item.detail)).toEqual([
        '~/.claude/skills',
        '~/.copilot/skills',
        '~/.agents/skills',
      ]);
      expect(host.copied[0]?.to.replaceAll('\\', '/')).toMatch(/\/\.claude\/skills\/dav-diagrams$/);
    });

    it('does nothing when the picker is dismissed', async () => {
      host.pickIndex = null;

      await run('dav.installAgentSkill');

      expect(host.copied).toEqual([]);
    });

    it.each([
      [undefined, 0],
      ['Replace', 1],
    ])('replaces an existing skill only after confirmation (%s)', async (answer, copies) => {
      host.workspaceFolders = [{ uri: { fsPath: '/repo' } }];
      host.existing.add(workspaceTarget);
      host.warningAnswer = answer;

      await run('dav.installAgentSkill');

      expect(host.copied).toHaveLength(copies);
    });
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

  it.each(['dav.exportHtml', 'dav.exportSvg'])(
    '%s exports nothing and says why while the text has a fatal error',
    async (command) => {
      host.activeTextEditor = { document: fakeDocument('dav 1\n]', 'broken.dav') };

      await run(command);

      expect(host.written).toEqual([]);
      expect(host.quickPick).toEqual([]);
      expect(host.warnings).toEqual([
        'Nothing was exported: the diagram has a syntax error and nothing to draw. Fix the error, then export.',
      ]);
    },
  );

  it('exports a diagram whose errors leave something to draw', async () => {
    host.activeTextEditor = { document: fakeDocument('dav 1\nnode a\n]', 'partial.dav') };

    await run('dav.exportHtml');

    expect(host.written).toHaveLength(1);
    expect(host.warnings).toEqual([]);
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

  describe('dav.exportSvg', () => {
    const stepped = fakeDocument(
      'dav 1\ntitle "Doc S"\nnode a\nnode b\na --> b\nstep "Go" {\n  animate a --> b\n}',
      's.dav',
    );

    it('asks for animated or still when the diagram has steps', async () => {
      host.activeTextEditor = { document: stepped };

      await run('dav.exportSvg');

      expect(host.quickPick.map((item) => item.label)).toEqual([
        'Animated',
        'Animated, whole diagram',
        'Still',
      ]);
      expect(host.written[0]).toContain('<animate');
      expect(host.written[0]).toContain('<title>Doc S</title>');
    });

    it('keeps the whole diagram in view when that is picked', async () => {
      host.activeTextEditor = { document: stepped };
      host.pickIndex = 1;

      await run('dav.exportSvg');

      expect(host.written[0]).toContain('<animate');
      expect(host.written[0]).not.toContain('attributeName="viewBox"');
    });

    it('writes a still picture when that is picked', async () => {
      host.activeTextEditor = { document: stepped };
      host.pickIndex = 2;

      await run('dav.exportSvg');

      expect(host.written[0]).toMatch(/^<\?xml/);
      expect(host.written[0]).not.toContain('<animate');
    });

    it('writes a still picture without asking when there are no steps', async () => {
      host.activeTextEditor = { document: docA };

      await run('dav.exportSvg');

      expect(host.quickPick).toEqual([]);
      expect(host.written[0]).not.toContain('<animate');
    });

    it('does nothing when the picker is dismissed', async () => {
      host.activeTextEditor = { document: stepped };
      host.pickIndex = null;

      await run('dav.exportSvg');

      expect(host.written).toEqual([]);
    });

    it('exports the kind the preview picked, from the text it shows, without asking', async () => {
      host.activeTextEditor = { document: stepped };
      await run('dav.openPreview');

      host.receive({
        type: 'exportSvg',
        dsl: stepped.getText(),
        animate: false,
        camera: 'follow',
        step: null,
      });
      await vi.waitFor(() => expect(host.written).toHaveLength(1));

      expect(host.quickPick).toEqual([]);
      expect(host.written[0]).not.toContain('<animate');

      host.receive({
        type: 'exportSvg',
        dsl: stepped.getText(),
        animate: true,
        camera: 'whole',
        step: null,
      });
      await vi.waitFor(() => expect(host.written).toHaveLength(2));
      expect(host.written[1]).toContain('<animate');
      expect(host.written[1]).not.toContain('attributeName="viewBox"');
    });

    it('names the file after the one step the preview picked', async () => {
      host.activeTextEditor = { document: stepped };
      await run('dav.openPreview');

      host.receive({
        type: 'exportSvg',
        dsl: stepped.getText(),
        animate: false,
        camera: 'follow',
        step: 0,
      });
      await vi.waitFor(() => expect(host.written).toHaveLength(1));

      expect(host.saveDefaultUri?.replaceAll('\\', '/')).toMatch(/s-step1\.svg$/);
      expect(host.written[0]).toContain('Step 1 / 1');
    });

    it('reads a stepped document only once when exporting', async () => {
      const getText = vi.fn(() => stepped.getText());
      host.activeTextEditor = { document: { ...stepped, getText } };

      await run('dav.exportSvg');

      expect(getText).toHaveBeenCalledTimes(1);
      expect(host.written).toHaveLength(1);
    });

    it('anchors untitled save dialogs in the workspace or home directory', async () => {
      const untitled = fakeDocument(docA.getText(), 'Untitled-1', 'dav', true);
      host.activeTextEditor = { document: untitled };
      host.workspaceFolders = [{ uri: { fsPath: '/repo' } }];

      await run('dav.exportSvg');
      expect(host.saveDefaultUri).toBe('/repo/diagram.svg');

      await run('dav.exportHtml');
      expect(host.saveDefaultUri).toBe('/repo/diagram.html');

      host.workspaceFolders = undefined;
      await run('dav.exportSvg');
      expect(host.saveDefaultUri).toBe(`${homedir()}/diagram.svg`);
    });

    it('uses overrideDsl from webview exportHtml and exportSvg over doc.getText()', async () => {
      const brokenEditorDoc = fakeDocument('dav 1\n/* unclosed comment', 'live.dav');
      host.activeTextEditor = { document: brokenEditorDoc };
      await run('dav.openPreview');

      host.receive({
        type: 'exportHtml',
        dsl: 'dav 1\ntitle "Preview HTML"\nnode shown',
      });
      await vi.waitFor(() => expect(host.written).toHaveLength(1));
      expect(host.written[0]).toContain('<title>Preview HTML</title>');

      host.receive({
        type: 'exportSvg',
        dsl: 'dav 1\ntitle "Preview SVG"\nnode shown',
        animate: false,
        camera: 'follow',
        step: null,
      });
      await vi.waitFor(() => expect(host.written).toHaveLength(2));
      expect(host.written[1]).toContain('<title>Preview SVG</title>');
    });

    it.each([
      ['en', 'Step 6 does not exist (2 steps in diagram).'],
      ['ja', 'ステップ 6 は存在しません（全 2 ステップ）。'],
    ])(
      'warns cleanly in %s without saving when webview exportSvg requests an out-of-bounds step',
      async (language, expectedWarning) => {
        host.language = language;
        const twoSteps = fakeDocument(
          'dav 1\nnode a\nnode b\na --> b\nstep "S1" {\n  focus a\n}\nstep "S2" {\n  animate a --> b\n}',
          'two.dav',
        );
        host.activeTextEditor = { document: twoSteps };
        await run('dav.openPreview');

        host.receive({
          type: 'exportSvg',
          dsl: twoSteps.getText(),
          animate: false,
          camera: 'follow',
          step: 5,
        });
        await vi.waitFor(() => expect(host.warnings).toEqual([expectedWarning]));

        expect(host.errors).toEqual([]);
        expect(host.saveDefaultUri).toBeUndefined();
        expect(host.written).toEqual([]);
      },
    );

    it('exports step: 1 of a multi-step diagram as -step2.svg with Step 2 / 3', async () => {
      const multi = fakeDocument(
        'dav 1\nnode a\nnode b\na --> b\nstep "First" {\n  focus a\n}\nstep "Second" {\n  animate a --> b\n}\nstep "Third" {\n  focus b\n}',
        'multi.dav',
      );
      host.activeTextEditor = { document: multi };
      await run('dav.openPreview');

      host.receive({
        type: 'exportSvg',
        dsl: multi.getText(),
        animate: true,
        camera: 'follow',
        step: 1,
      });
      await vi.waitFor(() => expect(host.written).toHaveLength(1));

      expect(host.saveDefaultUri?.replaceAll('\\', '/')).toMatch(/multi-step2\.svg$/);
      expect(host.written[0]).toContain('Step 2 / 3');
      expect(host.written[0]).toContain('<animate');
    });

    it('defaults an untitled document with step: 1 to diagram-step2.svg', async () => {
      const multiText =
        'dav 1\nnode a\nnode b\na --> b\nstep "S1" {\n  focus a\n}\nstep "S2" {\n  animate a --> b\n}';
      const untitledMulti = fakeDocument(multiText, 'Untitled-1', 'dav', true);
      host.activeTextEditor = { document: untitledMulti };
      host.workspaceFolders = [{ uri: { fsPath: '/repo' } }];
      await run('dav.openPreview');

      host.receive({
        type: 'exportSvg',
        dsl: multiText,
        animate: false,
        camera: 'follow',
        step: 1,
      });
      await vi.waitFor(() => expect(host.written).toHaveLength(1));
      expect(host.saveDefaultUri).toBe('/repo/diagram-step2.svg');

      host.workspaceFolders = undefined;
      host.receive({
        type: 'exportSvg',
        dsl: multiText,
        animate: false,
        camera: 'follow',
        step: 1,
      });
      await vi.waitFor(() => expect(host.written).toHaveLength(2));
      expect(host.saveDefaultUri).toBe(`${homedir()}/diagram-step2.svg`);
    });

    it('localizes dav.exportSvg QuickPick in ja and writes nothing when save dialog is cancelled', async () => {
      host.language = 'ja';
      host.activeTextEditor = { document: stepped };
      host.saveUri = undefined;

      await run('dav.exportSvg');
      await run('dav.exportHtml');

      expect(host.quickPick.map((item) => item.label)).toEqual([
        'アニメーション',
        'アニメーション（全体固定）',
        '静止画',
      ]);
      expect(host.written).toEqual([]);
    });

    it('ignores malformed webview messages without errors, warnings, or writes', async () => {
      host.activeTextEditor = { document: stepped };
      await run('dav.openPreview');

      host.receive(null);
      host.receive({ type: 'exportSvg', step: 0.5 });
      host.receive({
        type: 'exportSvg',
        dsl: stepped.getText(),
        animate: true,
        camera: 'follow',
        step: 0.5,
      });
      host.receive({ type: 'revealRange', from: Number.NaN, to: 1 });
      host.receive({ type: 'unknown' });
      host.receive({ type: 'exportHtml', dsl: 'dav 1\ntitle "Valid After Malformed"\nnode a' });

      await vi.waitFor(() => expect(host.written).toHaveLength(1));
      expect(host.errors).toEqual([]);
      expect(host.warnings).toEqual([]);
      expect(host.written[0]).toContain('<title>Valid After Malformed</title>');
    });
  });

  it('leaves a closed preview document out of the AI prompt', async () => {
    host.activeTextEditor = { document: docA };
    await run('dav.openPreview');
    host.disposePanel();
    host.activeTextEditor = undefined;

    await run('dav.copyAiPrompt');

    expect(host.clipboard[0]).not.toContain('Doc A');
  });

  it.each([
    ['ja', 'ja', '仕様プロンプト'],
    ['zh-cn', 'en', 'Specification'],
  ])('follows the VS Code language %s when exporting', async (language, lang, promptText) => {
    host.language = language;
    host.activeTextEditor = { document: docA };

    await run('dav.exportHtml');
    await run('dav.copyAiPrompt');

    expect(host.written[0]).toContain(`<html lang="${lang}">`);
    expect(host.written[0]).toContain(`"locale":"${lang}"`);
    expect(host.clipboard[0]).toContain(promptText);
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

  describe('preview cold-start bootstrap and inline assets', () => {
    it('inlines the CSS, links the script, escapes </script> in initial doc JSON, and caches the CSS', async () => {
      const extDir = mkdtempSync(join(tmpdir(), 'dav-ext-inline-'));
      try {
        const assetsDir = join(extDir, 'dist', 'webview', 'assets');
        mkdirSync(assetsDir, { recursive: true });
        writeFileSync(join(assetsDir, 'webview.css'), 'body{margin:0;color:red}', 'utf8');
        writeFileSync(join(assetsDir, 'webview.js'), 'window.__davBooted=true;', 'utf8');
        clearWebviewAssetCache();

        Object.assign(host, freshHostState());
        activate({ subscriptions: [], extensionUri: { fsPath: extDir } } as never);

        const trickyDsl =
          'dav 1\ntitle "Break </script><script>alert(1)</script> <!-- </style> & \u2028\u2029"\nnode a';
        const doc = fakeDocument(trickyDsl, 'tricky.dav', 'dav', false, 3);
        host.activeTextEditor = { document: doc };

        await run('dav.openPreview');

        const html = host.webviewHtml;
        expect(html).not.toContain('<link rel="stylesheet"');
        expect(html).not.toContain('</script><script>');
        expect(html).not.toContain('<!--');

        const nonceMatch = /style-src 'nonce-([0-9a-f]+)'/.exec(html);
        expect(nonceMatch?.[1]).toBeDefined();
        const nonce = nonceMatch?.[1] ?? '';
        expect(html).toContain(`<style nonce="${nonce}">body{margin:0;color:red}</style>`);
        // The script is a file of its own: the lazy documentation chunk imports from it, and
        // an inline copy would be loaded and run a second time.
        expect(html).not.toContain('window.__davBooted');
        expect(html).not.toContain('type="importmap"');
        expect(html).toMatch(
          new RegExp(
            `<script nonce="${nonce}" type="module" src="[^"]*dist/webview/assets/webview\\.js"></script>`,
          ),
        );

        const initialDocRaw = new RegExp(
          `<script id="${INITIAL_DOC_ELEMENT_ID}" type="application/json">([\\s\\S]*?)</script>`,
        ).exec(html)?.[1];
        expect(initialDocRaw).toBeDefined();
        expect(JSON.parse(initialDocRaw ?? '{}')).toEqual({
          uri: 'file:///tricky.dav',
          dsl: trickyDsl,
          version: 3,
        });

        // Re-opening after removing files from disk uses the in-memory asset cache until cleared.
        host.disposePanel();
        rmSync(assetsDir, { recursive: true, force: true });
        await run('dav.openPreview');
        expect(host.webviewHtml).toContain('body{margin:0;color:red}');

        host.disposePanel();
        clearWebviewAssetCache();
        await run('dav.openPreview');
        expect(host.webviewHtml).toContain('<link rel="stylesheet"');
        expect(host.webviewHtml).not.toContain('<style');
      } finally {
        clearWebviewAssetCache();
        rmSync(extDir, { recursive: true, force: true });
      }
    });

    it('links the stylesheet if it contains a sequence that is unsafe to inline', async () => {
      const extDir = mkdtempSync(join(tmpdir(), 'dav-ext-unsafe-'));
      try {
        const assetsDir = join(extDir, 'dist', 'webview', 'assets');
        mkdirSync(assetsDir, { recursive: true });
        writeFileSync(join(assetsDir, 'webview.css'), 'body::after{content:"</style>"}', 'utf8');
        writeFileSync(join(assetsDir, 'webview.js'), 'window.__davBooted=true;', 'utf8');
        clearWebviewAssetCache();

        Object.assign(host, freshHostState());
        activate({ subscriptions: [], extensionUri: { fsPath: extDir } } as never);
        host.activeTextEditor = { document: docA };

        await run('dav.openPreview');

        expect(host.webviewHtml).toContain('<link rel="stylesheet"');
        expect(host.webviewHtml).not.toContain('<style');
      } finally {
        clearWebviewAssetCache();
        rmSync(extDir, { recursive: true, force: true });
      }
    });

    it('skips redundant docChanged on ready when (uri, version) matches and posts when stale', async () => {
      const mutableDoc = fakeDocument('dav 1\nnode a', 'sync.dav', 'dav', false, 5);
      host.activeTextEditor = { document: mutableDoc };
      await run('dav.openPreview');
      expect(host.webviewPosted).toEqual([]);

      // Matching URI + version: host skips posting duplicate docChanged.
      host.receive({ type: 'ready', uri: 'file:///sync.dav', version: 5 });
      await new Promise((r) => setTimeout(r, 0));
      expect(host.webviewPosted).toEqual([]);

      // Document edited before ready arrived: version mismatch triggers docChanged.
      mutableDoc.version = 6;
      host.receive({ type: 'ready', uri: 'file:///sync.dav', version: 5 });
      await vi.waitFor(() => expect(host.webviewPosted).toHaveLength(1));
      expect(host.webviewPosted[0]).toEqual({
        type: 'docChanged',
        dsl: 'dav 1\nnode a',
        uri: 'file:///sync.dav',
        version: 6,
      });

      // Legacy ready without version still receives docChanged for devHost compatibility.
      host.receive({ type: 'ready' });
      await vi.waitFor(() => expect(host.webviewPosted).toHaveLength(2));
    });

    it('defers initial workspace diagnostic parsing off the synchronous activate() call', async () => {
      const getText = vi.fn(() => 'dav 1\nnode a');
      const doc = { ...fakeDocument('dav 1\nnode a', 'deferred.dav'), getText };
      const { workspace } = await import('vscode');
      (workspace.textDocuments as unknown[]).push(doc);
      const subscriptions: Array<{ dispose(): void }> = [];
      try {
        activate({ subscriptions, extensionUri: { fsPath: '/ext' } } as never);
        expect(getText).not.toHaveBeenCalled();

        await vi.waitFor(() => expect(getText).toHaveBeenCalledTimes(1));
      } finally {
        (workspace.textDocuments as unknown[]).length = 0;
        for (const sub of subscriptions) sub.dispose();
      }
    });
  });
});

describe('protocol message guards', () => {
  it('validates InitialDocPayload and escapes HTML-breaking JSON characters', () => {
    expect(isInitialDocPayload({ dsl: 'dav 1' })).toBe(true);
    expect(isInitialDocPayload({ dsl: 'dav 1', uri: 'file:///a.dav', version: 1 })).toBe(true);
    expect(isInitialDocPayload(null)).toBe(false);
    expect(isInitialDocPayload({ uri: 'file:///a.dav' })).toBe(false);
    expect(isInitialDocPayload({ dsl: 'dav 1', version: Number.NaN })).toBe(false);
    expect(isInitialDocPayload({ dsl: 'dav 1', uri: 42 })).toBe(false);

    const payload = {
      uri: 'file:///x.dav',
      dsl: '</script><!-- & \u2028\u2029 >',
      version: 2,
    };
    const serialized = serializeInitialDoc(payload);
    expect(serialized).not.toContain('<');
    expect(serialized).not.toContain('>');
    expect(serialized).not.toContain('&');
    expect(serialized).not.toContain('\u2028');
    expect(serialized).not.toContain('\u2029');
    expect(JSON.parse(serialized)).toEqual(payload);
    expect(escapeJsonForHtml('a<b>c&d')).toBe('a\\u003cb\\u003ec\\u0026d');
  });

  it('validates HostToWebviewMessage including optional string uri, version, and finite offset', () => {
    expect(isHostToWebviewMessage({ type: 'docChanged', dsl: 'dav 1' })).toBe(true);
    expect(isHostToWebviewMessage({ type: 'docChanged', dsl: 'dav 1', uri: 'file:///a.dav' })).toBe(
      true,
    );
    expect(
      isHostToWebviewMessage({
        type: 'docChanged',
        dsl: 'dav 1',
        uri: 'file:///a.dav',
        version: 2,
      }),
    ).toBe(true);
    expect(isHostToWebviewMessage({ type: 'cursorMoved', offset: 0 })).toBe(true);

    expect(isHostToWebviewMessage(null)).toBe(false);
    expect(isHostToWebviewMessage({ type: 'docChanged', dsl: 'dav 1', uri: 123 })).toBe(false);
    expect(isHostToWebviewMessage({ type: 'docChanged', dsl: 'dav 1', version: Number.NaN })).toBe(
      false,
    );
    expect(isHostToWebviewMessage({ type: 'docChanged', dsl: 'dav 1', version: '2' })).toBe(false);
    expect(isHostToWebviewMessage({ type: 'cursorMoved', offset: Number.NaN })).toBe(false);
    expect(isHostToWebviewMessage({ type: 'cursorMoved', offset: Number.POSITIVE_INFINITY })).toBe(
      false,
    );
    expect(isHostToWebviewMessage({ type: 'unknown' })).toBe(false);
  });

  it('validates every WebviewToHostMessage variant and rejects malformed payloads', () => {
    expect(isWebviewToHostMessage({ type: 'ready' })).toBe(true);
    expect(isWebviewToHostMessage({ type: 'ready', uri: 'file:///a.dav', version: 1 })).toBe(true);
    expect(isWebviewToHostMessage({ type: 'ready', uri: 123 })).toBe(false);
    expect(isWebviewToHostMessage({ type: 'ready', version: Number.POSITIVE_INFINITY })).toBe(
      false,
    );
    expect(isWebviewToHostMessage({ type: 'revealRange', from: 0, to: 10 })).toBe(true);
    expect(isWebviewToHostMessage({ type: 'exportHtml', dsl: 'dav 1' })).toBe(true);
    expect(
      isWebviewToHostMessage({
        type: 'exportSvg',
        dsl: 'dav 1',
        animate: true,
        camera: 'whole',
        step: 0,
      }),
    ).toBe(true);
    expect(
      isWebviewToHostMessage({
        type: 'exportSvg',
        dsl: 'dav 1',
        animate: false,
        camera: 'follow',
        step: null,
      }),
    ).toBe(true);

    expect(isWebviewToHostMessage(null)).toBe(false);
    expect(isWebviewToHostMessage({ type: 'formatDocument' })).toBe(false);
    expect(isWebviewToHostMessage({ type: 'exportSvg', step: 0.5 })).toBe(false);
    expect(
      isWebviewToHostMessage({
        type: 'exportSvg',
        dsl: 'dav 1',
        animate: true,
        camera: 'follow',
        step: 0.5,
      }),
    ).toBe(false);
    expect(
      isWebviewToHostMessage({
        type: 'exportSvg',
        dsl: 'dav 1',
        animate: true,
        camera: 'follow',
        step: -1,
      }),
    ).toBe(false);
    expect(
      isWebviewToHostMessage({
        type: 'exportSvg',
        dsl: 'dav 1',
        animate: 'true',
        camera: 'follow',
        step: null,
      }),
    ).toBe(false);
    expect(
      isWebviewToHostMessage({
        type: 'exportSvg',
        dsl: 'dav 1',
        animate: true,
        camera: 'pan',
        step: null,
      }),
    ).toBe(false);
    expect(isWebviewToHostMessage({ type: 'exportHtml' })).toBe(false);
    expect(isWebviewToHostMessage({ type: 'revealRange', from: Number.NaN, to: 1 })).toBe(false);
    expect(
      isWebviewToHostMessage({ type: 'revealRange', from: 0, to: Number.POSITIVE_INFINITY }),
    ).toBe(false);
    expect(isWebviewToHostMessage({ type: 'unknown' })).toBe(false);
  });
});
