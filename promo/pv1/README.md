# Promotional video for 1.0

This folder renders the promotional video of DynamicArchitectViewer 1.0, in Japanese and in English.

| Output | Where |
| --- | --- |
| Main video, 94 s | `out/DynamicArchitectViewer-1.0-long-ja.mp4`, `-en.mp4` |
| Cut for social media, 38 s | `out/DynamicArchitectViewer-1.0-sns-ja.mp4`, `-en.mp4` |

Both are 1920x1080 at 60 fps with sound. `out/` is not committed; everything in it can be rendered again from this folder. The README and docs animations are still made by [`promo/pv`](../pv/README.md).

## What the video says

| Scene | Message |
| --- | --- |
| Hook, title | A diagram stands still; a system does not. Play it. |
| 01 Flow | Infrastructure, sequence and architecture diagrams, written as text, play their data flow step by step; a packet can carry code that explains what runs |
| 02 Skills | With the agent skills, a coding agent writes the language; the user only writes a request |
| 03 SVG | An animated SVG export plays on GitHub as an image, stays sharp at any zoom and follows the theme |
| 04 HTML | A standalone HTML export is one interactive file that works offline |
| End | Name, version, where to get it |

## What is real and what is rebuilt

The video shows nothing the extension does not do.

- **Real VS Code.** Chapter 2 is a recording of VS Code itself, made by `take/take.mjs`: the extension at the current commit (loaded as an extension under development, hence "Extension Development Host" in the title bar), the Japanese or English display language, and the Claude Code extension. The script does what a user does, through the window's debugging port: it installs the agent skills from the Command Palette, types the request into Claude Code and sends it, and allows the skill's checker to run when Claude Code asks. `take/play.mjs` then records the diagram being played in the preview. Nothing in the recordings is edited; they are cut and sped up, with the speed on screen.
- **What Claude Code wrote.** `architecture-ja.dav` and `architecture-en.dav` are the files of the two takes, unedited. They are the diagrams of chapters 2 to 4. The check marks beside the recording light up when the recording shows that step, and the node, step and code counts are counted from the files.
- In both takes, the checker's first run reports a syntax error; Claude Code corrects the file and the second run passes. The cut shows both runs.
- In the English take, Claude Code did nothing for three minutes after the request was sent (its panel reported that it had stopped responding, then it carried on). The cut leaves that wait out instead of speeding through it.
- The recordings show Claude Code's panel as it was: the file paths of this machine and the usage notice of the account are visible.
- **Real preview.** In chapters 1 and 3, every preview is the extension's own webview, run from `apps/vscode` with Vite at the current commit and driven the way the extension host drives it: `docChanged` and `cursorMoved` messages and real button clicks, among them play, pause and the Export menu.
- **Real exports.** The hook and the README in chapter 3 show SVG files from `exportSvg`; the browser in chapter 4 shows the HTML file from `exportHtml`. The file sizes on screen are those of the files (`out/meta.json`). The SVGs are played by the browser's own SMIL engine and stepped with `setCurrentTime`; nothing in them is changed.
- **Rebuilt.** The VS Code window around the previews of chapters 1 and 3, the repository page and the browser frames are drawn by `stage.js`. The editor text there is highlighted with the extension's TextMate grammar and VS Code's Dark+ theme. The repository `you/tiny-orders` and its README are an illustration: the demo service is not public. Pointers and key caps are drawn where the script clicked and pressed.

The sound track is synthesized by `score.mjs` (no samples). Its levels are measured, but nobody has listened to it for you: listen before publishing.

## Recording a take

A take needs VS Code with the Claude Code extension signed in, the Japanese language pack for the Japanese take, and the demo service in `../tiny-orders` beside this repository (or its path in `TINY_ORDERS`). Build the extension first (`npm run build` at the repository root).

```bash
node take/take.mjs ja
```

```bash
node take/play.mjs ja
```

The first opens a copy of the demo service (`scratch/take/<lang>/tiny-orders`) in a VS Code window with a profile of its own, records the take and writes `recordings/take-<lang>.mp4`, `recordings/take-<lang>.json` and `architecture-<lang>.dav`. It uses the Claude account of the machine. The second records the playback into `recordings/play-<lang>.mp4`. Both close their window when done and leave the user's own VS Code settings alone. A take answers Claude Code's permission questions only for the skill's checker, with "Yes" for that one run; any other question stops it.

## Rendering

Requirements: Node.js 26, `npm ci` at the repository root (for Vite and Playwright), `npm install` in `promo/pv` (for the highlighter), and an ffmpeg with libx264 on `FFMPEG` (on Windows the winget install, `Gyan.FFmpeg`, is found automatically).

```bash
cd promo/pv1
node prepare.mjs all
```

Then, for each language (`ja`, `en`) and each cut (`long`, `short`):

```bash
node capture.mjs all ja long
node score.mjs long ja
node assemble.mjs long ja
```

`node assemble.mjs` without arguments joins all four videos. A cut of the main video renders in about twelve minutes. Several `capture.mjs` can run at once when each gets its own `--port=` (two ports are used, the given one and the next).

To look at single moments instead of rendering a video:

```bash
node capture.mjs svg ja long --stills=7.5,9.8
```

writes PNGs of those seconds of the scene to `out/stills/`.

## How it works

| File | Role |
| --- | --- |
| `timing.js` | Every scene's length and the moments in it, for both cuts, and how a take is cut. The stage, the capture and the score read it |
| `stage.html`, `stage.css`, `stage.js` | Everything drawn: backgrounds, type, devices, captions. `stage.render(t)` draws any moment on its own |
| `lib.js` | The stage's animation kit: easing, a stateless timeline |
| `live.mjs` | What happens in the live pages of each scene: clicks and messages, and the pointer's path |
| `capture.mjs` | Renders scenes frame by frame at 60 fps |
| `prepare.mjs` | Exports the SVG and HTML files, highlights the editor text, cuts the recordings into frames |
| `take/` | Records VS Code: `take.mjs` the agent at work, `play.mjs` the playback, `vscode.mjs` the window |
| `score.mjs` | Synthesizes music and sound effects |
| `assemble.mjs` | Joins scenes and adds the sound |

Two details keep the animation of the live pages at its real speed:

- Live pages run in their own browser context whose clock is installed and then paused, so only `runFor()` moves time. With `install()` alone, real time keeps passing between frames, and slow screenshots would speed the packets up.
- The paused clock does not reach into iframes, so a live page is its own tab; each frame its screenshot is placed in the device drawn by the stage. Live pages render at 1.5 device pixels per pixel, so they stay sharp when the camera moves in.

A take is cut into phases (`REC_PHASES` in `timing.js`). Each phase has a fixed length in the video and plays at the speed that fits the part of the recording it shows, so both languages keep the same rhythm whatever the agent's pace was.

The music is at 120 BPM. Scenes start on a bar line; when a time in `timing.js` changes, the score follows without edits.
