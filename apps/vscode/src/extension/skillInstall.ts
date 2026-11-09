import { homedir } from 'node:os';
import * as vscode from 'vscode';
import { t } from './locale';

const SKILL_NAME = 'dav-diagrams';

/** Where each agent looks for skills, relative to the workspace and to the home directory. */
const SKILL_TARGETS: ReadonlyArray<{
  agent: string;
  workspace: readonly string[];
  personal: readonly string[];
}> = [
  { agent: 'Claude Code', workspace: ['.claude', 'skills'], personal: ['.claude', 'skills'] },
  { agent: 'GitHub Copilot', workspace: ['.github', 'skills'], personal: ['.copilot', 'skills'] },
  { agent: 'Codex', workspace: ['.agents', 'skills'], personal: ['.agents', 'skills'] },
];

export async function installAgentSkill(extensionUri: vscode.Uri): Promise<void> {
  const home = vscode.Uri.file(homedir());
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  const items = SKILL_TARGETS.flatMap(({ agent, workspace, personal }) => [
    ...(workspaceRoot
      ? [
          {
            label: agent,
            description: t('このワークスペース', 'This workspace'),
            detail: workspace.join('/'),
            root: workspaceRoot,
            segments: workspace,
          },
        ]
      : []),
    {
      label: agent,
      description: t('すべてのプロジェクト', 'All projects'),
      detail: `~/${personal.join('/')}`,
      root: home,
      segments: personal,
    },
  ]);
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: t('スキルをインストールする場所を選択', 'Choose where to install the skill'),
  });
  if (!picked) return;

  const parent = vscode.Uri.joinPath(picked.root, ...picked.segments);
  const target = vscode.Uri.joinPath(parent, SKILL_NAME);
  if (await uriExists(target)) {
    const replace = t('置き換える', 'Replace');
    const answer = await vscode.window.showWarningMessage(
      t(
        `${picked.detail}/${SKILL_NAME} は既に存在します。置き換えますか？`,
        `${picked.detail}/${SKILL_NAME} already exists. Replace it?`,
      ),
      { modal: true },
      replace,
    );
    if (answer !== replace) return;
  }

  await vscode.workspace.fs.createDirectory(parent);
  await vscode.workspace.fs.copy(
    vscode.Uri.joinPath(extensionUri, 'dist', 'skill', SKILL_NAME),
    target,
    { overwrite: true },
  );
  void vscode.window.showInformationMessage(
    t(
      `スキルをインストールしました: ${picked.detail}/${SKILL_NAME}。エージェントの新しいセッションで使えます。`,
      `Installed the skill to ${picked.detail}/${SKILL_NAME}. It is available in new agent sessions.`,
    ),
  );
}

async function uriExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
