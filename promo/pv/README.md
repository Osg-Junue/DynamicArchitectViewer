# Promotional video and animations

This folder renders the DynamicArchitectViewer promotional video and the animations in the READMEs and docs.

| Output | Where |
| --- | --- |
| Main video, 77.5 s, Japanese and English captions | `out/pv-ja.mp4`, `out/pv-en.mp4` |
| Short video for social media, about 26 s | `out/pv-short-ja.mp4`, `out/pv-short-en.mp4` |
| README animation | `apps/vscode/media/demo.gif` |
| Docs animations | `docs/media/follow.gif`, `docs/media/skill-install.gif`, `docs/media/docs-guide.gif` |

`out/` is not committed. The videos can be rendered again from this folder; the GIFs are committed where the READMEs use them.

## What is real and what is rebuilt

The video shows nothing the extension does not do.

- **Real preview.** Every preview on screen is the extension's own webview, run from `apps/vscode` with Vite and driven the way the extension host drives it: `docChanged` and `cursorMoved` messages and real button clicks. The exported HTML in cut 9 comes from the real exporter.
- **Real recording.** Cut 5 is a screen recording (`recordings/jp_take5.mp4`) of Claude Code generating `architecture.dav` for a small demo service, sped up with the factor shown on screen. `architecture.dav` is the file it wrote, unedited.
- **Rebuilt.** The VS Code window (title bar, explorer, tabs, command palette, notifications) is drawn by `stage.html`. Cuts 3 and 4 follow recordings of the real steps; their strings come from the extension (`package.nls*.json`, `extension/skillInstall.ts`) and from VS Code as recorded. The editor text is highlighted with the extension's TextMate grammar and VS Code's Dark+ theme.
- `architecture-en.dav` is a translation of `architecture.dav` for the English docs animations. It is not presented as generated.

## Rendering

Requirements: Node.js 26, `npm ci` at the repository root (for Vite and Playwright), and an ffmpeg with libx264 on `FFMPEG` (on Windows the winget install, `Gyan.FFmpeg`, is found automatically).

```bash
cd promo/pv
npm install
node highlight.mjs
```

The video, with captions in Japanese and in English:

```bash
node capture.mjs all ja
node capture.mjs all en
node build-rec.mjs all
node sfx.mjs
node sfx.mjs short
node assemble.mjs pv
node assemble.mjs short
```

The README and docs animations (English screen, no captions):

```bash
node capture.mjs c04_skill,c06_cursor,c07_follow,c08_docs x --docs
node assemble.mjs gifs
```

`capture.mjs` takes a comma-separated list of cuts from `cuts.mjs`; rendering one cut takes 10 to 60 seconds.

## How it works

| File | Role |
| --- | --- |
| `stage.html` | Everything drawn around the preview: the VS Code window, captions, the pointer, the title and end cards |
| `cuts.mjs` | Each cut: its scene, length and a timeline of clicks and messages |
| `capture.mjs` | Renders cuts frame by frame at 60 fps |
| `build-rec.mjs` | Trims and speeds up the recording for cut 5 and overlays captions |
| `sfx.mjs` | Synthesizes the sound track (no samples) |
| `assemble.mjs` | Joins cuts, adds sound, makes the GIFs |
| `variant.mjs` | Video (Japanese screen) or docs (`--docs`, English screen) |
| `recording-guide.md` | How the recordings were made |

Two details keep the animation at its real speed:

- Playwright's clock is installed and then paused, so only `runFor()` moves time. With `install()` alone, real time keeps passing between frames, and slow screenshots would speed the packets up.
- The fake clock does not reach into iframes. The preview runs in its own tab, and each frame its screenshot is placed in the window drawn by `stage.html`.

The demo service that Claude Code diagrammed (`tiny-orders`) is not in this repository.
