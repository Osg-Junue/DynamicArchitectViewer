// Records the diagram of a take being played in real VS Code: node take/play.mjs <ja|en>
// Opens the folder take.mjs left (scratch/take/<lang>/tiny-orders) with the file Claude Code wrote,
// puts the preview beside the editor and presses "play all". No agent runs here.
// Writes recordings/play-<lang>.mp4 and recordings/play-<lang>.json.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { connect, launch, quit, repo } from './vscode.mjs';

const lang = process.argv[2] === 'en' ? 'en' : 'ja';
const pv1 = resolve(import.meta.dirname, '..');
const FFMPEG =
  process.env.FFMPEG ?? join(process.env.LOCALAPPDATA ?? '', 'Microsoft/WinGet/Links/ffmpeg.exe');
const port = 9334;
const base = resolve(repo, 'scratch/take');
const profile = join(base, `profile-play-${lang}`);
const folder = join(base, lang, 'tiny-orders');
const frameDir = join(base, `frames-play-${lang}`);
const SECONDS = 26;

rmSync(frameDir, { recursive: true, force: true });
mkdirSync(frameDir, { recursive: true });
launch({ folder, profile, lang, port });
const { browser, page } = await connect(port);
const client = await page.context().newCDPSession(page);
const wait = (ms) => page.waitForTimeout(ms);

try {
  await wait(6000);
  for (let i = 0; i < 4; i++) {
    const skip = page.getByRole('button', {
      name: /サインインしないで続行|Continue without Signing In/i,
    });
    if (await skip.count()) await skip.first().click();
    else await page.keyboard.press('Escape');
    await wait(900);
  }
  await page.keyboard.press('Control+P');
  await wait(600);
  await page.keyboard.type('architecture.dav', { delay: 30 });
  await wait(800);
  await page.keyboard.press('Enter');
  await wait(1500);
  // The side bar is closed, so the editor and the preview share the whole window.
  await page.keyboard.press('Control+B');
  await wait(800);
  await page.keyboard.press('Control+Shift+V');
  await wait(4000);
  let preview = null;
  for (let i = 0; i < 40 && !preview; i++) {
    for (const frame of page.frames()) {
      try {
        if (await frame.locator('.dav-app').count()) preview = frame;
      } catch {}
    }
    if (!preview) await wait(250);
  }
  if (!preview) throw new Error('no preview');

  // Frames are timed by when the window drew them, not by when they arrive here.
  let t0 = null;
  let wall0 = null;
  let last = 0;
  // The same clock for what this script does: the window is still before the click, and sends nothing.
  const now = () => (wall0 === null ? 0 : (Date.now() - wall0) / 1000);
  const frames = [];
  const writes = [];
  let size = null;
  client.on('Page.screencastFrame', (f) => {
    client.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    t0 ??= f.metadata.timestamp;
    wall0 ??= Date.now();
    last = f.metadata.timestamp - t0;
    const name = `f${String(frames.length).padStart(5, '0')}.jpg`;
    frames.push([name, last]);
    size = [f.metadata.deviceWidth, f.metadata.deviceHeight];
    writes.push(writeFile(join(frameDir, name), Buffer.from(f.data, 'base64')));
  });
  // The window is 3840 device pixels wide: recorded at that size, the camera can move in on it.
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 93,
    maxWidth: 3840,
    maxHeight: 2160,
    everyNthFrame: 1,
  });
  await wait(1500);
  const play = Number(now().toFixed(2));
  await preview.locator('[data-testid=btn-play-all]').click();
  await wait(SECONDS * 1000);
  await client.send('Page.stopScreencast');
  await Promise.all(writes);
  const duration = last + 0.02;

  const css = await page.evaluate(() => [innerWidth, innerHeight]);
  const el = await preview.frameElement();
  const box = await el.boundingBox();
  const out = 2560;
  const k = out / css[0];
  const boxes = {
    window: [0, 0, out, Math.round(css[1] * k)],
    preview: [box.x, box.y, box.width, box.height].map((v) => Math.round(v * k)),
  };
  // The middle of "play all", for the pointer the video draws on the click.
  const b = await preview.locator('[data-testid=btn-play-all]').boundingBox();
  const button = [b.x + b.width / 2, b.y + b.height / 2].map((v) => Math.round(v * k));

  mkdirSync(join(pv1, 'recordings'), { recursive: true });
  const list = frames
    .map(
      ([name, t], i) =>
        `file '${name}'\nduration ${((frames[i + 1]?.[1] ?? duration) - t).toFixed(4)}\n`,
    )
    .join('');
  writeFileSync(join(frameDir, 'list.txt'), `${list}file '${frames.at(-1)[0]}'\n`);
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
      'fps=60,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '15',
      '-movflags',
      '+faststart',
      join(pv1, 'recordings', `play-${lang}.mp4`),
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );
  if (r.status !== 0) throw new Error('ffmpeg failed');
  writeFileSync(
    join(pv1, 'recordings', `play-${lang}.json`),
    `${JSON.stringify({ lang, duration: Number(duration.toFixed(2)), frames: frames.length, recorded: size, play, button, boxes }, null, 2)}\n`,
  );
  console.log(
    `play-${lang}.mp4: ${duration.toFixed(1)} s, ${frames.length} frames at ${size?.join('x')}`,
  );
} finally {
  await browser.close().catch(() => {});
  quit(profile);
}
