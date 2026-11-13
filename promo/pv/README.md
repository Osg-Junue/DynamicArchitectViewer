# Promotional video and animations

This folder renders the DynamicArchitectViewer promotional video and the animations in the READMEs and docs.

| Output | Where |
| --- | --- |
| Main video: Japanese (77.5 s) and English (77.2 s) | `out/pv-ja.mp4`, `out/pv-en.mp4` |
| Short video for social media, about 26 s | `out/pv-short-ja.mp4`, `out/pv-short-en.mp4` |
| README animations, as SVG | `docs/media/failover.svg`, `docs/media/screen-flow.svg` |
| Marketplace README animation | `apps/vscode/media/demo.gif` |
| Docs animations | `docs/media/skill-install.gif`, `docs/media/docs-guide.gif` |

`out/` is not committed. The videos can be rendered again from this folder; the SVGs and GIFs are committed where the READMEs use them.

An animation of a diagram alone is an SVG from the extension's own exporter: it stays sharp, follows the reader's light or dark theme, and is a tenth of the size of a GIF. The GIFs that remain show what an SVG export cannot: the editor and VS Code itself. The README on the Marketplace keeps a GIF as well, because `vsce` refuses SVG images in an extension's README.

## What is real and what is rebuilt

The video shows nothing the extension does not do. Each language is a version of its own: the Japanese video has a Japanese screen and the diagram from the Japanese take, the English video an English screen and the diagram from the English take.

- **Real preview.** Every preview on screen is the extension's own webview, run from `apps/vscode` with Vite and driven the way the extension host drives it: `docChanged` and `cursorMoved` messages and real button clicks. The exported HTML in cut 9 comes from the real exporter.
- **Real recording.** Cut 5 is a screen recording of Claude Code diagramming a small demo service, sped up with the factor shown on screen: `recordings/jp_take5.mp4` wrote `architecture.dav`, and `recordings/en_take5.mp4` wrote `architecture-en.dav`. Both files are as written, unedited.
- In the English take, the checker's first run fails (no Node in Bash); Claude Code runs it again in PowerShell and it passes. The cut shows both.
- **Rebuilt.** The VS Code window (title bar, explorer, tabs, command palette, notifications) is drawn by `stage.html`. Cuts 3 and 4 follow recordings of the real steps; their strings come from the extension (`package.nls*.json`, `extension/skillInstall.ts`) and from VS Code as recorded. The editor text is highlighted with the extension's TextMate grammar and VS Code's Dark+ theme.

## Rendering

Requirements: Node.js 26, `npm ci` at the repository root (for Vite and Playwright), and an ffmpeg with libx264 on `FFMPEG` (on Windows the winget install, `Gyan.FFmpeg`, is found automatically).

```bash
cd promo/pv
npm install
node highlight.mjs
```

The videos, in Japanese and in English:

```bash
node capture.mjs all ja
node capture.mjs all en
node build-rec.mjs all
node sfx.mjs full ja
node sfx.mjs full en
node sfx.mjs short ja
node sfx.mjs short en
node assemble.mjs pv
node assemble.mjs short
```

The README and docs animations (English screen and diagram, no captions):

```bash
node svg.mjs
node capture.mjs c04_skill,c06_cursor,c08_docs x --docs
node assemble.mjs gifs
```

Render them again when the look of a diagram changes. `svg.mjs` exports the files listed at its top from `examples/`; with a file, a target and optionally a camera and a step, it exports that one instead, to try an image out.

`capture.mjs` takes a comma-separated list of cuts from `cuts.mjs`; rendering one cut takes 10 to 60 seconds.

## How it works

| File | Role |
| --- | --- |
| `stage.html` | Everything drawn around the preview: the VS Code window, captions, the pointer, the title and end cards |
| `cuts.mjs` | Each cut: its scene, length and a timeline of clicks and messages |
| `capture.mjs` | Renders cuts frame by frame at 60 fps |
| `build-rec.mjs` | Trims, speeds up and frames the recording of each language for cut 5, and overlays captions |
| `sfx.mjs` | Synthesizes the sound track (no samples) |
| `assemble.mjs` | Joins cuts, adds sound, makes the GIFs |
| `svg.mjs` | Exports the SVG animations of the READMEs with `exportSvg` |
| `variant.mjs` | Screen language, diagram and captions: `ja`, `en`, or `--docs` (English, no captions) |
| `recording-guide.md` | How the recordings were made |

Two details keep the animation at its real speed:

- Playwright's clock is installed and then paused, so only `runFor()` moves time. With `install()` alone, real time keeps passing between frames, and slow screenshots would speed the packets up.
- The fake clock does not reach into iframes. The preview runs in its own tab, and each frame its screenshot is placed in the window drawn by `stage.html`.

The demo service that Claude Code diagrammed (`tiny-orders`) is not in this repository.
