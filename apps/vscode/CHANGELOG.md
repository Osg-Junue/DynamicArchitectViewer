# Changelog

This project follows [Semantic Versioning](https://semver.org/). The `0.x` series is a preview.
The `dav` language version is separate from the extension version.

## Unreleased

- Export SVG Image: an animated SVG that plays every step with the camera following the flow or kept on the whole diagram, or a still one of the whole diagram. It runs no script, so GitHub and GitLab show it in a README
- The preview's Export button opens a menu: standalone HTML, animated SVG, animated SVG of the whole diagram, or still SVG
- The Export menu can export only the step the preview shows, animated or as a still picture of that step
- `animate` takes a `code` block: a monospace snippet with an optional language and title, shown inside the packet's callout in the preview and in exported HTML and SVG
- Callouts sit next to their rail, on any side of it, instead of far above or below a steep one or outside a nest of zones. They no longer hide a rail of the step
- A callout has no pointer any more. It carries the number of its packet's stop on the rail, and packets that run in one phase are told apart by a letter (`5a`, `5b`)
- The preview opens faster: its styles and the document are part of the page, and the documentation loads when first opened
- Opening the preview leaves the focus in the editor, and the preview comes back after the window reloads
- New Diagram from Sample Template describes each sample, in Japanese when that is the display language
- The outline nests nodes and groups inside their group
- Completions no longer open after every space on an empty line; `Ctrl+Space` still lists the statements
- The minimap covers nodes outside any zone, so the camera frame stays inside it
- Edge labels sit a little further from their rail, clear of the numbered stops
- A step that emphasizes something draws only the edges it is about: those it runs packets on or sets the state of, and those between two emphasized nodes. The others used to stay as faint lines behind them
- Nothing is exported while the text has a syntax error and nothing to draw: the preview's Export button is disabled, and the export commands say why

## 0.3.3 (2026-11-10)

- Fix: a group nested in a top-level group that has no nodes was left out of the layout when zones were placed freely

## 0.3.2 (2026-11-10)

- Marketplace metadata: spaces in `displayName` (`Dynamic Architect Viewer`), search keywords, and the `Linters` category

## 0.3.1 (2026-11-10)

- The README shows the preview in motion: clicking into a step in the editor plays it

## 0.3.0 (2026-11-10)

- Zones are placed freely when that shortens links that would otherwise be too long
- Column gaps no longer grow with group nesting, so diagrams with groups are narrower
- Packets are timed by the distance they travel and stay under a readable speed, so a long rail takes longer instead of going faster
- The player shows which zones a phase moves between, keeps zone names on screen, and moves the camera less
- A minimap you can turn on next to the zoom controls
- Playback speeds of 0.75x and 1.25x

## 0.2.0 (2026-11-09)

- AI agent skill for writing and validating `.dav` files, with a command to install it for Claude Code, GitHub Copilot and Codex
- New sample diagram showing how the extension turns a `.dav` file into a live preview and a standalone HTML file

## 0.1.0 (2026-11-09)

First public preview.

- `.dav` language support: file icon, syntax highlighting, diagnostics with Quick Fix, completions, formatter, and outline
- Automatic layout from edges and groups, with crossing reduction
- Live preview with step playback, pause, and speed control
- Self-contained HTML export, and extracting the DSL back from an exported file
- 42 built-in icons for nodes and packets
- AI prompt template for writing `.dav` files
- Japanese and English UI, following the VS Code display language
