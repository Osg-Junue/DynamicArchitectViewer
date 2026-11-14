# Changelog

This project follows [Semantic Versioning](https://semver.org/). The `0.x` series was a preview.
The `dav` language version follows the major version: every `1.x.x` release is `dav 1`.

## Unreleased

- The preview and exported HTML have one bar above the diagram instead of four strips: previous and next, the step's title with its description below it, then play, stop and speed. The title is also the list of steps. The steps are a thin line along the bar's lower edge, and the zones a phase moves between show as a chip over the top of the diagram, so the diagram is up to about 90 px taller
- The play button plays the current step. The arrow beside it opens a menu that plays all steps, or the step, at once, and the button then plays the same. "Play step" reads "Play this step"
- The controls of the bar, Export and the documentation button among them, look and behave alike: lit under the pointer or while their menu is open, in the pressed color while on, and outlined only after keyboard input. Choosing a speed or a step with the mouse no longer leaves an outline, the speed button keeps its width, and a long title is shortened in a narrow pane instead of running under the play buttons
- A move inside one zone shows the zone's name alone, without "inside", in the preview, exported HTML and exported SVG
- Export is drawn as the other controls instead of as a filled button
- An edge's label is set at 11.5 px, the size of a node's `sub`, instead of 11 px. Its room grows with it, so a label fits the same number of characters as before

## 1.1.0 (2026-11-14)

- A command line, `dav`, in the npm package `dynamic-architect-viewer-cli`. `dav export` writes the SVG or the standalone HTML of a diagram without the editor, and with `--check` fails when the file there is missing or out of date, which keeps the SVG in a README up to date from CI. `dav check`, `dav format` and `dav outline` report what the editor reports, format files and print what a diagram says
- The extension stays on in Restricted Mode: it declares that it supports workspaces that are not trusted, so a `.dav` file in a folder from someone else has its highlighting, diagnostics and preview. It runs nothing from the workspace and reads no settings

## 1.0.0 (2026-11-13)

The first stable release: the extension is no longer marked as a preview.

- In the preview and in exported HTML, a callout is exactly as wide as its text: the text is measured in the font it is drawn in instead of estimated, so no room is left beside it for fonts the reader does not have. An exported SVG, which is made without a browser, keeps the estimate
- The preview picks up a new build's stylesheet when it is opened again, without a reload of the window
- Code in a callout is drawn in the editor's monospaced font in the preview and in exported HTML. A style rule had made it take the font of the interface, so its columns did not line up and its box was wider than the code
- A callout is as wide as what it holds, and no wider: a tall one is no longer widened to keep its proportion. A description that fits on one line gets one, even where that makes the callout wider than its code; a longer one takes as few lines as fit, as long as the callout allows, and a word or two is not left alone on the last. The heading alone moves in for the number, so the description and the code use the room below it
- Text takes the room it needs and little more: each Latin character is counted at its own width instead of an average, so a callout, a badge and the room kept for a label are about a sixth narrower, and more of a long name fits before it is cut
- Japanese breaks between phrases: after a particle or a comma, and never inside a word in katakana or kanji
- A callout is spaced evenly: its number stands as far from the edge as the text does on the other side, the description starts a little below the heading, the code box follows at the same distance, and the code has as much room above as below. A heading with a number before it starts right after the number
- Every text is measured the same way, by its weight and with capitals counted as wider than small letters. A badge all in capitals is no longer tight in its pill; a node's name and sub-label may use the whole width of the node; a callout with Japanese text is a little narrower, since a CJK character is counted as exactly one em; and a label that is cut loses the space before its ellipsis
- An exported HTML file is about 9 KB smaller: the callouts are placed in one pass instead of two, with the same result
- Callouts are easier to read: the heading, the description and the code are each set a size larger, and a callout holds as many characters as before. In an exported SVG the step title and description above the diagram are larger too
- The button that stops the animation shows a square, the usual sign for stop, instead of a dot on a line
- The preview stays responsive on large diagrams: the search for where to place the zones, which takes over a second on three hundred nodes, runs in a worker, and the preview shows the diagram it has until the new layout is ready
- Copy AI Prompt Template asks for the same detail as the agent skill: a `sub` on every node, a label on every edge, a `desc` on every step and packet, `code` where the content matters, packets that follow declared edges, and how long each text can be
- The agent skill asks for more detail and can check it: `dav-check --detail` reports an edge or packet without a label, a step or packet without a description, a packet that travels where no edge is declared, a diagram without any `code`, and text too long to be shown in full. For a packet without an edge it names the nodes to send it through instead, or the edges to make two-way. It also describes the layout the preview will draw, for an agent that cannot see it: the size and proportion of the diagram, the columns and rows of its nodes and zones, and connections that cross. The skill gives the sizes that fit and shows how to write descriptions and code blocks
- A second agent skill, `dav-reading`, explains the architecture and the data flows a `.dav` file describes. Its `dav-outline` script prints the file with every reference resolved and the packets of each step in order. To compare a diagram with code, it says where the code shows each thing the diagram claims, and tells what contradicts the code from what the diagram only leaves out. Install AI Agent Skill installs both skills
- The sample of the extension's own pipeline shows the SVG export beside the HTML export
- The samples show a code block in every diagram, and three labels in the last sample that were cut off are shorter
- Export SVG Image: an animated SVG that plays every step with the camera following the flow or kept on the whole diagram, or a still one of the whole diagram. It runs no script, so GitHub and GitLab show it in a README
- The preview's Export button opens a menu: standalone HTML, animated SVG, animated SVG of the whole diagram, or still SVG
- The Export menu can export only the step the preview shows, animated or as a still picture of that step
- `animate` takes a `code` block: a monospace snippet with an optional language and title, shown inside the packet's callout in the preview and in exported HTML and SVG
- Callouts sit next to their rail, on any side of it: each takes the free place nearest its rail instead of one above or below it and clear of every zone and node cell. Half of them are now within 40 units of their rail, where half used to be 100 or more away. A callout may lie across the side or bottom border of a zone and use the empty part of a node's cell when that brings it clearly closer; it never covers a station, a badge, a label, a rail or a zone's name
- A callout has no pointer any more. It carries the number of its packet's stop on the rail, and packets that run in one phase are told apart by a letter (`5a`, `5b`)
- The preview opens faster: its styles and the document are part of the page, and the documentation loads when first opened
- Opening the preview leaves the focus in the editor, and the preview comes back after the window reloads
- New Diagram from Sample Template describes each sample, in Japanese when that is the display language
- The outline nests nodes and groups inside their group
- Completions no longer open after every space on an empty line; `Ctrl+Space` still lists the statements
- The minimap covers nodes outside any zone, so the camera frame stays inside it
- Rails are drawn as level and upright stretches with rounded corners instead of curves. A rail no longer runs through another node or over a zone's name, goes round the zones it has nothing to do with, and runs beside the rails that share its way instead of on top of them
- Edge labels are written beside a free stretch of their rail, clear of nodes, zone names, other labels and other rails
- Rails are darker against the background, so that they stand out inside a colored zone too; a zone has a thin outline in its own color
- Small text on a colored badge or numbered stop reads better: yellow and pink in light themes and red and purple in dark themes moved a little, and the number on an orange stop is dark in a dark theme
- Stations stay level across zones: a node outside a zone lines up with the nodes inside the zone next to it, and a self-loop no longer lowers only its own zone, so the rails between them run straight
- A long chain of zones is no longer laid out as one very wide strip: its zones are placed freely even when that costs a crossing, as long as it shortens the links by more than the crossing is worth
- Zones that are placed freely sit closer to the zones they are linked to: the links between them are about 5% shorter, and no zone is left further from its neighbors than it has to be
- Zones that are placed freely line up the stations they link: about three times as many links between zones run level or straight down, where they used to be a few units off
- Zones that are placed freely fill the canvas better instead of stretching sideways, so a large diagram is shown larger when it is fitted to the preview
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
