# DynamicArchitectViewer (`dav 1`)

DynamicArchitectViewer is a lightweight VS Code extension for authoring **time-stepped architecture & screen-transition diagrams** with a compact, code-only text DSL (`.dav`), 100% deterministic auto-layout, a modern live preview with Visual Studio-style top playback controls, and **zero-dependency single-file HTML export** with round-trip re-import.

## Features

- **`.dav` Language Support**:
  - Syntax highlighting, bracket matching, and code folding
  - Real-time diagnostics with Quick Fix suggestions (`Ctrl+.` / `⌘.`)
  - Context-aware autocomplete for node/group IDs, keywords, attributes, color names, and 35 built-in icons
  - Comment-preserving formatter (`Shift+Alt+F`) and Document Outline / Breadcrumbs
- **Code-Only Auto-Layout & Modern Live Preview (`Ctrl+Shift+V` / `⌘⇧V`)**:
  - 100% deterministic automatic layout from topology and group hierarchy — no manual coordinate (`@pos` / `@size`) maintenance
  - Pure Vanilla TypeScript DOM runtime (zero React dependency) for instant startup and minimal memory footprint
  - Visual Studio-style top playback toolbar (step selector, `▶ Play` / `❚❚ Pause`, Play All, animation on/off for a still view of each step, `0.5x`–`2x` speed; `←` / `→` keys move between steps)
  - Cursor-to-canvas highlight and double-click jump from canvas node/group to `.dav` source line
- **AI Agent Ready**:
  - Run **DynamicArchitectViewer: Copy AI Prompt Template (DSL v1 Spec)** to copy a self-contained specification prompt for Claude Code, Antigravity, ChatGPT, or Copilot.
- **Zero-Dependency Single-File HTML Export**:
  - Run **DynamicArchitectViewer: Export Standalone HTML** to generate a single `.html` file (~30 KB) with a strict SHA-256 Content-Security-Policy that works offline from `file://` and can be re-imported via **Extract DSL from Standalone HTML...**.
