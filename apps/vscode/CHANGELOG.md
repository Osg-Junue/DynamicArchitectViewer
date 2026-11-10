# Changelog

This project follows [Semantic Versioning](https://semver.org/). The `0.x` series is a preview.
The `dav` language version is separate from the extension version.

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
