# DynamicArchitectViewer

Write architecture and screen-flow diagrams as text, then play them step by step. A VS Code extension for `.dav` files.

**[Try it in the playground](https://osg-junue.github.io/DynamicArchitectViewer/).** It plays the samples in your browser, draws what you type and saves it as HTML or SVG, with nothing to install.

**[Watch the video](https://youtu.be/wFpWjMfTAGQ).** It shows diagrams playing step by step, a coding agent writing one from a request, and the SVG and HTML exports.

<a href="https://youtu.be/wFpWjMfTAGQ"><img src="apps/vscode/media/video.jpg" width="480" alt="The video on YouTube: Play your architecture"></a>

![A request passing the edge, a cache hit, a write with replication, and a database failover, played step by step](docs/media/examples/01-infra-ha-failover.svg)

*This animation is an SVG file, exported by the extension from [`examples/01-infra-ha-failover.dav`](examples/01-infra-ha-failover.dav).*

A static diagram struggles to show what happens over time. Requests, failovers and retries end up as a tangle of numbered arrows, or in a separate sequence diagram. Here, one diagram plays out in steps, while the structure stays in place.

```dav
dav 1
title "Checkout"

node browser "Browser" [icon: browser]
group backend "Backend" {
  node api "API" [icon: api]
  node db "Orders DB" [icon: database]
}
node psp "Payment provider" [icon: external]

browser --> api : "HTTPS"
api --> db : "SQL"
api --> psp : "Charge"

step "Place an order" {
  animate browser --> api : "POST /orders" [icon: file]
  animate api --> db : "Insert"
}

step "The payment provider fails" {
  state psp [badge: "503", color: red]
  animate api --> psp : "Charge" [icon: payment, color: red]
}
```

## Features

- **Automatic layout.** No coordinates to maintain, and small diffs in Git.
- **Live preview** that follows the editor, with playback, step-by-step navigation and speed control.
- **Language support:** highlighting, diagnostics with Quick Fixes, completions, a formatter that keeps comments, and an outline.
- **Standalone HTML export.** One file with all steps that works offline, with no external requests. The source can be extracted from it again.
- **SVG export for READMEs.** An animated or still SVG covers every step or just the step in the preview, with the camera following the flow or keeping the whole diagram in view. It runs no script, so GitHub and GitLab play it as an image.
- **Command line.** [`dav`](#command-line) exports, checks and formats diagrams in a terminal, and keeps the SVG in a README up to date from CI.
- **AI-friendly.** [Agent skills](#ai-agent-skills) let coding agents write, validate and explain `.dav` files, and a command copies a prompt for chat assistants.
- **Japanese and English UI**, following the VS Code display language.

![A checkout screen flow with the calls behind each screen: signing in, adding to the cart, charging the card and showing the confirmation](docs/media/examples/02-screen-flow-checkout.svg)

*A screen flow, exported the same way from [`examples/02-screen-flow-checkout.dav`](examples/02-screen-flow-checkout.dav). [All examples](docs/examples.md) play like this.*

## Install

Install [DynamicArchitectViewer](https://marketplace.visualstudio.com/items?itemName=osg-junue.dynamic-architect-viewer) from the Visual Studio Marketplace. It needs VS Code 1.96 or later. To try it first, the [playground](https://osg-junue.github.io/DynamicArchitectViewer/) runs its preview and language support in a browser.

To build it from source, you also need [Node.js](https://nodejs.org/) 26:

```bash
npm ci
npm run package
code --install-extension apps/vscode/dist/dynamic-architect-viewer.vsix
```

Then open a `.dav` file, or run **DynamicArchitectViewer: New Diagram from Sample Template...** from the Command Palette, and press `Ctrl+Shift+V` (`⌘⇧V` on macOS) for the preview. More examples are in [`examples/`](examples/), and [docs/examples.md](docs/examples.md) plays each of them.

## Command line

The `dav` command does what the extension does with a `.dav` file, without the editor: in a terminal or in CI. It is the npm package [`dynamic-architect-viewer-cli`](apps/cli/README.md), which needs Node.js 20 or later and has no dependencies.

```bash
npx dynamic-architect-viewer-cli export docs/checkout.dav
```

| Command | Does |
| :--- | :--- |
| `dav export` | Writes an animated or still SVG, or a standalone HTML file, next to each diagram |
| `dav check` | Reports what the editor reports. `--detail` adds hints and describes the layout |
| `dav format` | Formats files in place. `--check` fails when a file is not formatted |
| `dav outline` | Prints what a diagram says, with every reference resolved |

`dav export --check` writes nothing and fails when a file is missing or is not what its diagram exports now. In CI, this keeps the SVG in a README up to date:

```yaml
- run: npx dynamic-architect-viewer-cli@1.1.0 export --check docs/*.dav
```

## AI agent skills

Two skills teach coding agents to work with `.dav` files. Their scripts need Node.js 18 or later.

| Skill | For | Its script |
| :--- | :--- | :--- |
| [`dav-diagrams`](skills/dav-diagrams/SKILL.md) | Writing and changing diagrams: the language, how layout works, how to structure steps, and how much detail a diagram needs | `dav-check` runs the parser and formatter of the editor, and with `--detail` also reports missing descriptions and code and text too long to be shown in full, and describes the layout |
| [`dav-reading`](skills/dav-reading/SKILL.md) | Reading diagrams: explaining the architecture and the data flows a `.dav` file describes | `dav-outline` prints what the file says, with every reference resolved and the packets of each step in order |

**From VS Code:** run **DynamicArchitectViewer: Install AI Agent Skill...** from the Command Palette, then choose Claude Code, GitHub Copilot or Codex, and either the workspace or all projects. It installs both skills.

![Installing the skill for Claude Code in this workspace from the Command Palette](docs/media/skill-install.gif)

**As a Claude Code plugin:**

```bash
claude plugin marketplace add Osg-Junue/DynamicArchitectViewer
claude plugin install dynamic-architect-viewer@osg-junue
```

**For other agents** that support [Agent Skills](https://agentskills.io/), with the third-party [`skills`](https://github.com/vercel-labs/skills) CLI:

```bash
npx skills add Osg-Junue/DynamicArchitectViewer --skill dav-diagrams
npx skills add Osg-Junue/DynamicArchitectViewer --skill dav-reading
```

Then ask your agent as usual, such as "Diagram this repository's login flow in `auth.dav`" or "Explain how an order flows through `checkout.dav`".

## Documentation

- [Examples](docs/examples.md)
- [Language specification](docs/specification.md)
- [How diagrams are laid out](docs/layout.md)
- [Architecture](docs/architecture.md)
- [Contributing](CONTRIBUTING.md)

## License

[MIT](LICENSE)
