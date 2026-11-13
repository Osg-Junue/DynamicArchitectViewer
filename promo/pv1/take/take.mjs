// Records a take in real VS Code: node take/take.mjs <ja|en>
// Opens a fresh copy of the demo service (scratch/take/<lang>/tiny-orders) in VS Code with the extension
// at the current commit, then does what a user does: installs the agent skills from the Command
// Palette, asks Claude Code for a diagram, and plays it in the preview. The window is recorded through
// its debugging port; nothing is typed or clicked with the system's own mouse and keyboard.
// Writes recordings/take-<lang>.mp4, recordings/take-<lang>.json (when things happened, and where the
// panes are) and architecture-<lang>.dav (the file Claude Code wrote, unedited).
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { connect, launch, quit, repo } from './vscode.mjs';

const lang = process.argv[2] === 'en' ? 'en' : 'ja';
const pv1 = resolve(import.meta.dirname, '..');
const FFMPEG =
  process.env.FFMPEG ?? join(process.env.LOCALAPPDATA ?? '', 'Microsoft/WinGet/Links/ffmpeg.exe');
const port = 9333;
const base = resolve(repo, 'scratch/take');
const profile = join(base, `profile-${lang}`);
const folder = join(base, lang, 'tiny-orders');
const frameDir = join(base, `frames-${lang}`);
const SOURCE = process.env.TINY_ORDERS ?? resolve(repo, '../tiny-orders');

const TEXT = {
  ja: {
    command: 'AI エージェント',
    prompt:
      'このリポジトリの構成を architecture.dav に図にして。注文から決済までの正常な流れと、決済プロバイダーが落ちてリトライした末に注文が失敗する流れをステップで見せて。',
  },
  en: {
    command: 'AI Agent',
    prompt:
      'Diagram this repository’s architecture in architecture.dav. Show the normal flow from order to payment, and the flow where the payment provider is down, retries fail and the order fails, as steps.',
  },
}[lang];

// ---------- a fresh copy of the demo service, with an empty diagram file ----------
rmSync(join(base, lang), { recursive: true, force: true });
rmSync(frameDir, { recursive: true, force: true });
mkdirSync(join(base, lang), { recursive: true });
mkdirSync(frameDir, { recursive: true });
const clone = spawnSync('git', ['clone', '-q', SOURCE, folder], { stdio: 'inherit' });
if (clone.status !== 0) throw new Error(`could not copy the demo service from ${SOURCE}`);
const davFile = join(folder, 'architecture.dav');
writeFileSync(davFile, '');

launch({ folder, profile, lang, port });
const { browser, page } = await connect(port);
const client = await page.context().newCDPSession(page);
const wait = (ms) => page.waitForTimeout(ms);
const snap = async (name) => {
  const { data } = await client.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
  writeFileSync(join(base, `${lang}-${name}.jpg`), Buffer.from(data, 'base64'));
};

try {
  // A new profile greets with a sign-in dialog and a theme picker: neither is used.
  await wait(6000);
  for (let i = 0; i < 4; i++) {
    const skip = page.getByRole('button', {
      name: /サインインしないで続行|Continue without Signing In/i,
    });
    if (await skip.count()) await skip.first().click();
    else await page.keyboard.press('Escape');
    await wait(900);
  }

  // The diagram file and its preview.
  await page.keyboard.press('Control+P');
  await wait(600);
  await page.keyboard.type('architecture.dav', { delay: 30 });
  await wait(800);
  await page.keyboard.press('Enter');
  await wait(1500);
  await page.keyboard.press('Control+Shift+V');
  await wait(3500);
  await snap('ready');

  // ---------- recording ----------
  const t0 = Date.now();
  const now = () => (Date.now() - t0) / 1000;
  const marks = {};
  const mark = (name) => {
    if (!(name in marks)) {
      marks[name] = Number(now().toFixed(2));
      console.log(`${marks[name].toFixed(1).padStart(6)}  ${name}`);
    }
  };
  const frames = [];
  client.on('Page.screencastFrame', (f) => {
    const name = `f${String(frames.length).padStart(5, '0')}.jpg`;
    frames.push([name, now()]);
    writeFileSync(join(frameDir, name), Buffer.from(f.data, 'base64'));
    client.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    maxWidth: 2560,
    maxHeight: 1440,
    everyNthFrame: 1,
  });
  await wait(1200);

  // 1. The agent skills, from the Command Palette.
  mark('paletteOpen');
  await page.keyboard.press('F1');
  await wait(900);
  mark('paletteType');
  await page.keyboard.type(TEXT.command, { delay: 85 });
  await wait(1100);
  mark('palettePicks');
  await page.keyboard.press('Enter');
  await wait(1700);
  mark('palettePick');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 40 && !existsSync(join(folder, '.claude/skills/dav-diagrams/SKILL.md')); i++)
    await wait(100);
  mark('skillInstalled');
  await wait(3200);

  // 2. Claude Code, beside the preview. Its input is an editable element, not a form field.
  const INPUT = '[contenteditable]:not([contenteditable="false"]), [role="textbox"]';
  mark('claudeOpen');
  await page.keyboard.press('Control+Shift+Escape');
  let claude = null;
  for (let i = 0; i < 60 && !claude; i++) {
    await wait(500);
    for (const frame of page.frames()) {
      // The panel is a webview; the preview is one too, and is told apart by its own root.
      if (!frame.url().startsWith('vscode-webview://')) continue;
      try {
        if ((await frame.locator('.dav-app').count()) > 0) continue;
        if ((await frame.locator(INPUT).count()) > 0) claude = frame;
      } catch {}
    }
  }
  if (!claude) {
    await snap('no-panel');
    throw new Error('no Claude Code panel');
  }
  await wait(1500);
  const input = claude.locator(INPUT).first();
  await input.click();
  await wait(500);
  mark('promptType');
  await page.keyboard.type(TEXT.prompt, { delay: lang === 'ja' ? 28 : 16 });
  mark('promptTyped');
  await wait(900);
  await page.keyboard.press('Enter');
  mark('promptSent');

  // 3. Wait while it works. Its permission questions are answered only for the checker of the skill;
  // anything else stops the take.
  const text = () => claude.evaluate(() => document.body.innerText).catch(() => '');
  let last = '';
  let lastChange = now();
  let written = false;
  for (;;) {
    await wait(300);
    const body = await text();
    if (body !== last) {
      last = body;
      lastChange = now();
    }
    if (/dav-diagrams/.test(body)) mark('skill');
    if (/\bRead\b/.test(body)) mark('read');
    if (!written && statSync(davFile).size > 0) {
      written = true;
      mark('write');
    }
    if (/architecture\.dav: ok \(/.test(body)) mark('check');
    const buttons = await claude
      .evaluate(() =>
        [...document.querySelectorAll('button')]
          .filter((b) => b.offsetParent !== null)
          .map((b) => b.innerText.trim())
          .filter(Boolean),
      )
      .catch(() => []);
    // The choices are numbered: "1 Yes", "2 Yes, allow ... for this project", "3 No".
    const once = /^(\d+\s*)?(Yes|はい)$/i;
    const asks = buttons.some((b) => once.test(b.replace(/\s+/g, ' ')));
    if (asks) {
      await snap(`ask-${Math.round(now())}`);
      if (/dav-check/.test(body.slice(-1500))) {
        // Yes, this once: the choice that allows it for the whole project is left alone.
        const index = buttons.findIndex((b) => once.test(b.replace(/\s+/g, ' ')));
        console.log(
          `${now().toFixed(1).padStart(6)}  answering "${buttons[index]}" of ${JSON.stringify(buttons)}`,
        );
        await claude.locator('button:visible').filter({ hasText: /\S/ }).nth(index).click();
        mark('allowed');
        await wait(800);
      } else {
        throw new Error(
          `Claude Code asks for something the take does not expect: ${JSON.stringify(buttons)}`,
        );
      }
    }
    // Done: the checker passed and nothing has changed in the panel for a while.
    if (marks.check && now() - lastChange > 7) break;
    // Or the file is written and the panel has been still for long, whatever the checker printed.
    if (written && !asks && now() - lastChange > 40) break;
    if (now() > 420) throw new Error('the take ran for seven minutes without finishing');
  }
  mark('done');
  await snap('done');

  // 4. The diagram, played in the preview.
  let preview = null;
  for (const frame of page.frames()) {
    try {
      if (await frame.locator('.dav-app').count()) preview = frame;
    } catch {}
  }
  if (preview) {
    await wait(1500);
    mark('play');
    await preview.locator('[data-testid=btn-play-all]').click();
    await wait(24000);
    mark('playEnd');
  }
  await client.send('Page.stopScreencast');
  await snap('end');

  // Where the panes are, in the pixels of the recording.
  const size = await page.evaluate(() => [innerWidth, innerHeight]);
  const k = 2560 / size[0];
  const boxOf = async (frame) => {
    const el = await frame.frameElement();
    const box = await el.boundingBox();
    return box && [box.x, box.y, box.width, box.height].map((v) => Math.round(v * k));
  };
  const boxes = { window: [0, 0, 2560, Math.round(size[1] * k)] };
  boxes.claude = await boxOf(claude);
  if (preview) boxes.preview = await boxOf(preview);

  // ---------- files ----------
  mkdirSync(join(pv1, 'recordings'), { recursive: true });
  copyFileSync(davFile, join(pv1, `architecture-${lang}.dav`));
  const duration = now();
  const list = frames
    .map(
      ([name, t], i) =>
        `file '${name}'\nduration ${((frames[i + 1]?.[1] ?? duration) - t).toFixed(4)}\n`,
    )
    .join('');
  writeFileSync(join(frameDir, 'list.txt'), `${list}file '${frames.at(-1)[0]}'\n`);
  const video = join(pv1, 'recordings', `take-${lang}.mp4`);
  const r = spawnSync(
    FFMPEG,
    [
      '-y',
      '-v',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      join(frameDir, 'list.txt'),
      '-vf',
      'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '16',
      '-movflags',
      '+faststart',
      video,
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );
  if (r.status !== 0) throw new Error('ffmpeg failed');
  writeFileSync(
    join(pv1, 'recordings', `take-${lang}.json`),
    `${JSON.stringify({ lang, prompt: TEXT.prompt, duration: Number(duration.toFixed(2)), frames: frames.length, marks, boxes }, null, 2)}\n`,
  );
  console.log(`take-${lang}.mp4: ${duration.toFixed(1)} s, ${frames.length} frames`);
  console.log(readFileSync(davFile, 'utf8').split('\n').length, 'lines in architecture.dav');
} finally {
  await browser.close().catch(() => {});
  quit(profile);
}
