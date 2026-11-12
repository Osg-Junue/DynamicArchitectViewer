import * as vscode from 'vscode';
import { exportDocumentToHtml, exportDocumentToSvg, LANGUAGE_ID } from './documents';
import { registerLanguageFeatures } from './languageFeatures';
import { t, uiLocale } from './locale';
import { CanvasPanelManager } from './previewPanel';

const openDavFirst = (): string =>
  t('先に .dav ファイルを開いてください。', 'Open a .dav file first.');

export function activate(context: vscode.ExtensionContext): void {
  registerLanguageFeatures(context);

  const panelManager = new CanvasPanelManager(context.extensionUri);

  /** The `.dav` document a command applies to: the focused editor, else the previewed one. */
  const commandTargetDocument = (): vscode.TextDocument | undefined => {
    const active = vscode.window.activeTextEditor?.document;
    if (active?.languageId === LANGUAGE_ID) return active;
    const previewed = panelManager.activeDocument;
    return previewed && !previewed.isClosed ? previewed : undefined;
  };

  const withTargetDocument =
    (fn: (doc: vscode.TextDocument) => Promise<void>) => async (): Promise<void> => {
      const doc = commandTargetDocument();
      if (!doc) {
        void vscode.window.showInformationMessage(openDavFirst());
        return;
      }
      await fn(doc);
    };

  /** Opens text as a new, unsaved diagram, next to its preview. */
  const openNewDocument = async (content: string): Promise<void> => {
    const doc = await vscode.workspace.openTextDocument({ language: LANGUAGE_ID, content });
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    panelManager.open(doc);
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('dav.openPreview', () => {
      const doc = vscode.window.activeTextEditor?.document;
      if (!doc || (doc.languageId !== LANGUAGE_ID && !doc.uri.fsPath.endsWith('.dav'))) {
        void vscode.window.showInformationMessage(openDavFirst());
        return;
      }
      panelManager.open(doc);
    }),
    vscode.commands.registerCommand(
      'dav.exportHtml',
      withTargetDocument((doc) => exportDocumentToHtml(doc)),
    ),
    vscode.commands.registerCommand(
      'dav.exportSvg',
      withTargetDocument((doc) => exportDocumentToSvg(doc)),
    ),
    vscode.commands.registerCommand('dav.importHtml', async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { [t('スタンドアロン HTML / DAV', 'Standalone HTML / DAV')]: ['html', 'dav'] },
      });
      const uri = uris?.[0];
      if (!uri) return;
      const bytes = await vscode.workspace.fs.readFile(uri);
      const content = new TextDecoder('utf-8').decode(bytes);
      const { importContent } = await import('../exporter');
      const res = importContent(content);
      if (!res.ok) {
        void vscode.window.showErrorMessage(
          t(
            `HTML を読み込めませんでした（${res.reason}）。`,
            `Could not import HTML (${res.reason}).`,
          ),
        );
        return;
      }
      await openNewDocument(res.dsl);
    }),
    vscode.commands.registerCommand('dav.newFromTemplate', async () => {
      const { SAMPLE_TEMPLATES } = await import('../samples');
      const picked = await vscode.window.showQuickPick(
        SAMPLE_TEMPLATES.map((s) => ({ label: s.name, detail: s.id, dsl: s.dsl })),
        { placeHolder: t('サンプルのテンプレートを選択', 'Select a sample diagram template') },
      );
      if (!picked) return;
      await openNewDocument(picked.dsl);
    }),
    vscode.commands.registerCommand('dav.copyAiPrompt', async () => {
      const { buildAiPrompt } = await import('../prompt');
      const currentDsl = commandTargetDocument()?.getText();
      const prompt = buildAiPrompt({
        locale: uiLocale(),
        ...(currentDsl ? { currentDsl, includeCurrentDsl: true } : {}),
      });
      await vscode.env.clipboard.writeText(prompt);
      void vscode.window.showInformationMessage(
        t(
          'DSL v1 の AI プロンプトをクリップボードにコピーしました。',
          'Copied DSL v1 AI prompt template to clipboard.',
        ),
      );
    }),
    vscode.commands.registerCommand('dav.installAgentSkill', async () => {
      const { installAgentSkill } = await import('./skillInstall');
      await installAgentSkill(context.extensionUri);
    }),
  );
}

export function deactivate(): void {}
