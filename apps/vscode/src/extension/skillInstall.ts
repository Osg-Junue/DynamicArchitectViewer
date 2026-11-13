import { homedir } from 'node:os';
import * as vscode from 'vscode';
import { t } from './locale';

/** The skills the extension carries: one to write diagrams, one to read them. */
const SKILL_NAMES = ['dav-diagrams', 'dav-reading'];

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
    placeHolder: t('スキルをインストールする場所を選択', 'Choose where to install the skills'),
  });
  if (!picked) return;

  const parent = vscode.Uri.joinPath(picked.root, ...picked.segments);
  const targets = SKILL_NAMES.map((name) => ({ name, uri: vscode.Uri.joinPath(parent, name) }));
  const existing: string[] = [];
  for (const { name, uri } of targets) {
    if (await uriExists(uri)) existing.push(name);
  }
  if (existing.length > 0) {
    const replace = t('置き換える', 'Replace');
    const names = existing.join(', ');
    const answer = await vscode.window.showWarningMessage(
      t(
        `${picked.detail} に ${names} は既に存在します。置き換えますか？`,
        `${names} already exists in ${picked.detail}. Replace it?`,
      ),
      { modal: true },
      replace,
    );
    if (answer !== replace) return;
  }

  await vscode.workspace.fs.createDirectory(parent);
  for (const { name, uri } of targets) {
    await vscode.workspace.fs.copy(vscode.Uri.joinPath(extensionUri, 'dist', 'skill', name), uri, {
      overwrite: true,
    });
  }
  const installed = SKILL_NAMES.join(', ');
  void vscode.window.showInformationMessage(
    t(
      `スキル（${installed}）を ${picked.detail} にインストールしました。エージェントの新しいセッションで使えます。`,
      `Installed the skills (${installed}) to ${picked.detail}. They are available in new agent sessions.`,
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
