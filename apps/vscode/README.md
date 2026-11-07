# DynamicArchitectViewer (`dav 1`)

DynamicArchitectViewer is a VS Code extension for authoring **time-stepped architecture & screen-transition diagrams** with a concise text DSL (`.dav`), a two-way interactive SVG canvas & inspector, and **zero-dependency single-file HTML export** with round-trip re-import.

## Features

- **`.dav` Language Support**:
  - Syntax highlighting, bracket matching, and code folding
  - Real-time diagnostics with Quick Fix suggestions (`Ctrl+.` / `⌘.`)
  - Context-aware autocomplete for node/group IDs, keywords, attributes, 18 built-in icons, and 5 node statuses
  - Comment-preserving formatter (`Shift+Alt+F`) and Document Outline / Breadcrumbs
- **Interactive Canvas & Inspector (`Ctrl+Shift+V` / `⌘⇧V`)**:
  - Drag to position (`@pos`) with 10px grid snap and smart alignment guides
  - Resize handles (`@size`), port drag to connect edges (`-->`), and multi-selection alignment
  - Element Inspector & Step Timeline Inspector powered by non-destructive text edits (preserves comments and formatting)
  - Cursor-to-canvas highlight and double-click jump to code
- **AI Agent Ready**:
  - Run **DynamicArchitectViewer: Copy AI Prompt Template (DSL v1 Spec)** to copy a self-contained specification prompt for Claude Code, Antigravity, ChatGPT, or Copilot.
- **Zero-Dependency Single-File HTML Export**:
  - Run **DynamicArchitectViewer: Export Standalone HTML** to generate a single `.html` file (~30 KB) with a strict SHA-256 Content-Security-Policy that works offline from `file://` and can be re-imported via **Extract DSL from Standalone HTML...**.
