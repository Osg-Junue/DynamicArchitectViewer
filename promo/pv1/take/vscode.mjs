// Starts a real VS Code window for a take, and connects to it: the extension at the current commit
// (as an extension under development), Claude Code and the Japanese language pack from the installed
// extensions, in a profile of its own, so that nothing in the user's own VS Code changes.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const here = import.meta.dirname;
export const repo = resolve(here, '../../..');
const CODE = join(process.env.LOCALAPPDATA, 'Programs/Microsoft VS Code/bin/code.cmd');
const EXTENSIONS = join(process.env.USERPROFILE, '.vscode/extensions');
/** Extensions the take needs; every other installed one is switched off for this window. */
const KEEP = ['anthropic.claude-code', 'ms-ceintl.vscode-language-pack-ja'];

/** The settings of the profile: the look of the recordings so far, and a quiet window. */
const SETTINGS = {
  'workbench.colorTheme': 'Dark+',
  'editor.fontSize': 16,
  'claudeCode.preferredLocation': 'panel',
  'claudeCode.hideOnboarding': true,
  'claudeCode.initialPermissionMode': 'acceptEdits',
  'workbench.startupEditor': 'none',
  'window.newWindowDimensions': 'maximized',
  'window.restoreWindows': 'none',
  'workbench.secondarySideBar.defaultVisibility': 'hidden',
  'workbench.tips.enabled': false,
  'update.mode': 'none',
  'extensions.autoUpdate': false,
  'extensions.autoCheckUpdates': false,
  'extensions.ignoreRecommendations': true,
  'telemetry.telemetryLevel': 'off',
  'git.openRepositoryInParentFolders': 'never',
  'chat.commandCenter.enabled': false,
  'editor.inlineSuggest.enabled': false,
  // The window fills a 3840x2160 screen at 150 %; this makes its text large enough for a video.
  'window.zoomLevel': 2.5,
};

/** Launches VS Code on `folder` in the profile `profile`, with its debugging port open. */
export function launch({ folder, profile, lang, port }) {
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(join(profile, 'User'), { recursive: true });
  writeFileSync(join(profile, 'User/settings.json'), JSON.stringify(SETTINGS, null, 2));
  // The display language comes from the language pack, which VS Code finds through this file.
  const packs = join(process.env.APPDATA, 'Code/languagepacks.json');
  if (lang === 'ja' && existsSync(packs)) copyFileSync(packs, join(profile, 'languagepacks.json'));
  const ids = [
    ...new Set(
      readdirSync(EXTENSIONS)
        .filter((name) => /-\d+\.\d+\.\d+/.test(name))
        .map((name) => name.replace(/-\d+\.\d+\.\d+.*$/, '')),
    ),
  ].filter((id) => !KEEP.includes(id));
  const args = [
    '--user-data-dir',
    profile,
    `--extensionDevelopmentPath=${resolve(repo, 'apps/vscode')}`,
    `--remote-debugging-port=${port}`,
    '--locale',
    lang,
    '--disable-workspace-trust',
    '--new-window',
    ...ids.flatMap((id) => ['--disable-extension', id]),
    folder,
  ];
  spawn('cmd.exe', ['/c', CODE, ...args], { detached: true, stdio: 'ignore' }).unref();
}

/** The workbench page of the window on `port`. */
export async function connect(port) {
  let browser = null;
  for (let i = 0; i < 60 && !browser; i++) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!browser) throw new Error(`no VS Code on port ${port}`);
  for (let i = 0; i < 60; i++) {
    const page = browser
      .contexts()
      .flatMap((c) => c.pages())
      .find((p) => p.url().includes('workbench'));
    if (page) return { browser, page };
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('no workbench page');
}

/** Stops only the VS Code processes of `profile`. */
export function quit(profile) {
  const name = profile.replace(/\\/g, '/').split('/').at(-1);
  spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='Code.exe'" | Where-Object { $_.CommandLine -like '*${name}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    ],
    { stdio: 'ignore' },
  );
}
