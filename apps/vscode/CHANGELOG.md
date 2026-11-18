# Changelog

This project follows [Semantic Versioning](https://semver.org/). The `0.x` series was a preview.
The `dav` language version follows the major version: every `1.x.x` release is `dav 1`.

## Unreleased

- The `dav-diagrams` skill and the layout guide say that the zones of a large diagram follow their links and not the order they are declared in, and that zones nested in one zone stay next to each other. A coding agent wanted related zones to stand together and found nothing in the skill on how to have it. They also say that a hidden edge counts for the columns and keeps its rail while hidden, so it is no clean way to pull zones together
- `dav check --detail` names each edge that the layout leaves out to break a loop, in a note `back-edge`: the loop it closes, where the layout came into the loop, the columns its two ends took, and which node to declare earlier to start the loop elsewhere. The edge that closes a loop points back, and the node it starts from stands at the far end of the loop; a coding agent found such a node many columns to the right of where it was meant, with nothing that said why. A request and its response laid out as declared, the caller on the left, are left out. Where the zones of a large diagram are placed freely, only loops inside one zone are named, since a link between zones sets no column there
- Two rails that run close beside each other no longer cross where one of them turns off. Rails can run on lines of the grid that stand nearer to each other than rails are set apart, in one test diagram less than a unit; they were then moved 7 units apart in the order of their lines, so a rail that turned off within the length of the other could be put on the far side of it and cross it as it turned. A rail that turns off so now goes on the side it turns towards. Over 31 test diagrams two change, each with one crossing fewer, and turns stay as many. Rails can take other places than before, so an exported SVG can be out of date for `dav export --check` until it is exported again
- The `dav-diagrams` skill and the layout guide no longer say that the node declared first goes on the left of every loop. That holds only for a loop that nothing else leads into: the layout enters a loop where its search first reaches it, so in a large diagram a one-way edge that points back could pull a node, and its zone, to the far right where the skill promised the left. They now say how a loop is entered, and that a pair written as one two-way edge keeps the node named first on the left. The skill also says how to write a diagram of about 50 nodes or more: the structure first, checked with `--map`, then the steps a few at a time

## 1.5.4 (2026-11-17)

- Placing the zones freely is tried for a diagram whose links cross in shared columns, and no longer only for one whose links are too long there. Zones linked across one another, each link of them short, stood in columns that made their links cross, and the arrangement that takes the crossings out was never looked for. As before, it is kept only where it leaves fewer crossings or less of the links too long. None of the bundled examples changes: those drawn in columns have no crossing there. A diagram that does change is drawn differently, so an exported SVG of it is out of date for `dav export --check` until it is exported again

## 1.5.3 (2026-11-17)

- A rail no longer runs inside the bundle of rails that another node sends the same way. Where two stations stand a few units off a row, the grid has two lines beside each other there, and a rail took the second one to keep clear of unrelated rails on the first, although the two are drawn together; the rails of both lines were then set in order with no regard to which side each belongs on. An unrelated rail on a line that near now counts as one on the line itself, and a rail that has to cross a bundle either way takes the side outside it. Over 29 test diagrams only one changes, where these crossings at a shared station went from 10 to 5, for one more turn
- A node that stands a little off a node it is linked to moves to stand level with it, or straight above it, where its group has room. The rail between them stepped aside with two bends: columns, rows and the placing of zones put the node there, although it could stand level without moving anything else. A node moves up to 60 units inside the frame it stands in, together with a node it stands level with where that link would bend otherwise, and only where that straightens more links than it bends and makes none of them cross more. Over 29 test diagrams seven nodes move, in three of them, and the rails that step aside went from 23 to 16 and turns from 808 to 794, with as many crossings and the same size
- Rails that leave one node for nodes stacked beside each other no longer cross each other where they turn off. Two rails that share a node were taken never to cross, so the rail to the top node could run along the bottom and up past the others, across every one of them. Such a crossing now costs a rail a quarter of what crossing any other rail does: enough to take the order that keeps them apart where that costs about a bend or less. Over 29 test diagrams these crossings went from 123 to 33, for 5 more turns and 3 more rails that turn three times or more in all. Rails can take other courses than before, so an exported SVG can be out of date for `dav export --check` until it is exported again
- Where zones are placed freely, fewer rails between two zones step aside on their way. Such a rail joins two stations a few units off level and needs two bends for it, where moving one of the zones that little would make it straight. A zone was moved so only where that raised the rest of the arrangement's cost by less than 120; once the arrangement is chosen, it is now moved where the cost rises by less than 300, and the choice of arrangement stays as it was. Over 22 test diagrams, rails between zones that step aside went from 26 to 17 and their turns from 789 to 773, with as many crossings and the same size. Four of them are drawn differently, so an exported SVG of such a diagram can be out of date for `dav export --check` until it is exported again

## 1.5.2 (2026-11-17)

- The outline of a zone is drawn 0.75 px wide instead of 1, and 1.25 px instead of 1.75 while a flow moves to or from the zone. Beside the thinner rails the outlines had come to look heavy: at a zoom of 60% the outline of an active zone was as wide as a rail

## 1.5.1 (2026-11-17)

- The command line of this version is on npm, as `dynamic-architect-viewer-cli@1.5.1`. Version 1.5.0 is not: its release failed at npm, so the `dav-cli` skill that the extension 1.5.0 installs names a package that does not exist. Nothing else changes since 1.5.0

## 1.5.0 (2026-11-17)

- The extension is published to [Open VSX](https://open-vsx.org/extension/osg-junue/dynamic-architect-viewer) as well as to the Visual Studio Marketplace, for Cursor and other editors that install extensions from there
- Install AI Agent Skill offers Cursor as well: `.cursor/skills` in the workspace, or `~/.cursor/skills` for all projects
- The `dav-cli` skill carries the manual of the command, as `references/manual.md`: a copy of the README of the npm package. An agent looks up every option, the lines a command prints and how to read the layout lines, the map and the outline there, without the other two skills
- A large diagram whose zones are placed freely reads from left to right more often. Zones along a flow stood above each other as readily as side by side, so a diagram of five zones could come out taller than wide, with its flow running from the bottom to the top. An upright link between zones now costs more than a level one while the diagram is narrower than twice its height. Diagrams whose zones are placed freely are arranged anew, and an exported SVG of one is out of date for `dav export --check` until it is exported again
- The label of an edge is no longer written over the label of a loop on the node it leaves or reaches
- A rail that only passes a node with a self-loop goes round the loop and its label. It took the room beside the node for a way through, so on a node that many rails pass the loop was drawn across them. Rails that reach the node itself still meet it where the loop leaves and comes back
- The rails of a dense diagram bend and cross less. Rails that only pass a node keep clear of its labels, a rail no longer takes stair steps where a straighter way is open, and the gaps between columns, rows and zones widen where many rails run. Where zones are placed freely, a zone that stands between two linked zones counts against the arrangement, a node that has columns to spare moves towards its links to other zones, and a zone with groups in it or with loops can be turned upside down. Over ten test diagrams of five zones each, the rails that turn three times or more went from 45 to 11 and the crossings from 120 to 80. Diagrams are drawn differently than before, so an exported SVG is out of date for `dav export --check` until it is exported again
- Rails are drawn 3 units wide instead of 4, and many rails that meet one side of a node are set at least 4 units apart, where they could stand 3.5 apart and so touch. Dense diagrams look lighter, and the rails of a crowded node can be told apart
- Two rails that run beside each other are no longer drawn as one thick line. The lines rails are routed on could stand nearer to each other than the 7 units rails keep, and each line set its own rails apart without looking at the next, so rails of two lines ran half a unit apart, in places for hundreds of units. Lines that near are now one line, and rails of neighboring lines are moved apart. Where more than five rails meet one side of a node, they still stand nearer than elsewhere. A rail can take another course than before, so an exported SVG can be out of date for `dav export --check` until it is exported again
- Arranging and drawing a diagram takes 1.1 to 1.4 times as long as in 1.4.0, for the rails that bend and cross less: measured on the export of a still SVG, 0.15 s instead of 0.12 s for a diagram of five zones and about 25 nodes, and 2.1 s instead of 1.4 s for one of 300 nodes
- `dav check --help` and `dav outline --help` say what each option does, as the help of `dav export` and `dav format` does. They printed the usage line alone
- The README of the npm package `dynamic-architect-viewer-cli` is a manual of the command: how to install it, every option of each command, the lines each prints with what they mean, how to read the layout lines and the map of `dav check`, and the exit codes

## 1.4.0 (2026-11-16)

- `dav check`, `dav outline` and the two scripts of the skills print a label that holds a line break on one line. What followed the break started a line of its own, so a diagram could write a line that read as the script's: a heading of the outline, a line of the checker. An agent that takes those lines for facts could be told anything that way
- `dav check --map`, and `--map` of the `dav-check` script of the `dav-diagrams` skill, says which node is where, for a reader that cannot see the diagram: which zones and nodes stand beside each zone, a table of the nodes of each zone by column and row, numbered across the whole diagram so that any two nodes compare by their numbers, and for each connection where its second node lies from its first. It is printed only when asked for, and does not change the exit code. The layout lines of `--detail` give numbers only
- The `dav-cli` skill gives a whole GitHub Actions workflow for checking exported files, instead of two steps of one. It says that each form a diagram is exported in needs its own `--check` line, and when to name the files instead of a pattern
- The `dav-diagrams` skill says that the one-line form of `code` takes no title, which only the form between backticks does, and lists the mistake
- The `dav-diagrams` skill says that the layout lines of the checker give numbers and not which node is where, and that a proportion needs acting on only with the note `tall-diagram`
- The `dav-diagrams` skill says how to write a step that shows another outcome of an earlier step, such as a payment that fails where it succeeded before: named in its title and `desc`, with the badges set back. The `dav-reading` skill reads such a step as a branch, where it took every step to come after the one before

## 1.3.0 (2026-11-15)

- A third agent skill, `dav-cli`, has an agent run the `dav` command: it exports a diagram as an SVG or an HTML file, shows it in a README, and checks in CI that the exported files are up to date. It also checks and formats many files at once. The skill carries no script: it runs the npm package with `npx`, under the version it is released with, so that the version that checks a file is the one that wrote it. Install AI Agent Skill installs all three skills
- `dav` names its version when it is asked for a command or an option it does not have, so that a version older than expected shows: `there is no command "render" in version 1.3.0`
- `dav` takes a pattern such as `docs/*.dav` in PowerShell and cmd.exe, which hand the pattern over instead of the files it matches. Every command failed there with `*.dav: ENOENT`. The files are taken in the order of their names
- `dav` needs Node.js 22.17 or later instead of 20, for the patterns
- `dav export --out-dir` writes nothing and exits with 2 when two diagrams of one name, such as `a/x.dav` and `b/x.dav`, would be written to one file. The second replaced the first without a word, and `--check` then failed for one of them whatever was exported
- `dav constructor`, and any other name every object has, is reported as a command there is not, with exit code 2. It ended in a stack trace with exit code 1

## 1.2.0 (2026-11-15)

- A callout is placed no nearer another line of the step than its own, so it is no longer read as describing the line it sits by. Before, it kept away only from the lines of other packets in its phase. It sits nearer another line only where every place that does not is more than 200 units further away, counting what crossing a zone's border or using a node's cell adds
- A callout may cover a dimmed node, its icon and its name, and cross the border of a dimmed zone, and it crosses the border of any other zone more readily, so it finds a place near its line more often. It still never covers a zone's name, a badge, or the icon or name of a node the step is about
- A callout may sit in the strip across the top of a zone beside the zone's name, instead of keeping off that whole strip. A callout for a line just below the strip no longer has to leave the zone
- Laying out the callouts of a step takes about a quarter of the time it did, with every callout where it was: summed over the 66 steps of the examples and of diagrams of 20, 100 and 300 nodes, 0.17 s instead of 0.63 s, measured outside the editor. In a 100-node diagram the slowest step takes about 17 ms instead of 51. Drawing the step is not part of this
- The preview and exported HTML have one bar above the diagram instead of four strips: previous and next, the step's title with its description below it, then play, stop and speed. The title is also the list of steps. The steps are a thin line along the bar's lower edge, and the zones a phase moves between show as a chip over the top of the diagram, so the diagram is up to about 90 px taller
- The play button always plays the current step, and pauses whatever plays. The arrow beside it opens a menu that plays all steps, or the step, at once. "Play step" reads "Play this step"
- Previous and next take the whole height of the bar beside the title, so they are easier to hit
- The controls of the bar, Export and the documentation button among them, look and behave alike: lit under the pointer or while their menu is open, in the pressed color while on, and outlined only after keyboard input. Choosing a speed or a step with the mouse no longer leaves an outline, the speed button keeps its width, and a long title is shortened in a narrow pane instead of running under the play buttons
- The line of steps under the bar is easier to hit: each step takes the pointer over 16 px of height instead of 8. The line itself is as thin as before, and the diagram starts 8 px lower
- The minimap shows no frame while the whole diagram is in view. It had drawn the frame's upper and lower edges across the map there
- The title block, the zoom buttons and the minimap have the rounded corners of the bar's lists (6 px), instead of square corners on one and 3 px on the others
- A move inside one zone shows the zone's name alone, without "inside", in the preview, exported HTML and exported SVG
- Export is drawn as the other controls instead of as a filled button
- The step list, the speed, the menu of the play button and the Export menu are one kind of dropdown: a button with a caret, and a list in the same panel, with the same items and the current choice in the pressed color. The step list and the speed were the system's own lists before, drawn differently in every theme. Each list takes the arrow keys, Home, End and Escape, and in High Contrast an outline marks the current choice
- Packets are timed by how far they move on screen as the camera frames each step, instead of in the diagram, so they keep one readable top speed: a step the camera shows close up plays slower, and one it shows from far away plays faster. Zooming in by hand slows them too, by half as much as it enlarges them: at four times the zoom they take twice as long. Zooming out or Fit leaves their pace as it is. The exported SVG times them as the camera that follows the flow shows them, with `--camera whole` too
- Packets move more briskly. A packet gets up to speed in the first 15 % of its time, keeps one speed and slows down over the last 30 %, instead of speeding up to the middle and slowing down from there. Its fastest moment is 1.29 times its average speed instead of 1.57 times, so the shortest phase is 1 s instead of 1.3 s and the top average speed 320 px/s instead of 260, with the fastest moment about as fast as before
- A round trip takes at least 1.75 s instead of 2.4 s, and is no longer slowed to three quarters of the top speed on a long line. Its way back starts and stops like its way out
- A packet stays where it arrived for 0.15 s before the next phase starts, in the preview, exported HTML and exported SVG. One phase ran straight into the next, so two moves read as one
- A step is held for 1 s after its last phase instead of 1.8 s, before it plays again or the next step starts
- A packet keeps its pace round a rounded corner instead of speeding up by as much as 16 % there
- An edge's label is set at 11.5 px, the size of a node's `sub`, instead of 11 px. Its room grows with it, so a label fits the same number of characters as before
- A rail that runs level past a node keeps above the room of the node's badge where that costs no more than a small detour, instead of running through the badge. A rail that meets a node from above turns higher for the same reason
- A rail turns towards the node it ends at at least 16 units before it, where it can. A rail that met a node from below turned right under the node's labels, so its arrowhead hid the last stretch and seemed to sit across a level line
- A zone's name stays at the top left of its zone, in the preview, exported HTML and exported SVG. It no longer follows the camera through its zone: the chip over the diagram tells which zones a phase moves between
- Zones that are placed freely leave no band across the diagram that only rails run through. Two parts of a large diagram joined by few links could stay hundreds of units apart, because each zone was moved on its own and none left its neighbors. The parts now come together as wholes, and step past a zone in their way into room that was empty, as long as the diagram gets no wider and no higher for it: a diagram of a hundred nodes in eighteen zones is 24 % narrower and 14 % lower, and one of three hundred nodes 34 % narrower
- The preview of a large diagram, with fifty links between zones or more, appears sooner: the search for where its zones go runs in several workers at once, as many as the machine has cores to spare, up to six. A diagram of three hundred nodes is searched in 0.3 s instead of 1.1 s, and is on screen 0.6 s after it is opened instead of 1.4 s; the layout is the same. While a diagram is shown, such a search waits until the text has stayed as it is for 0.2 s, so typing starts none, and one that a newer text has made pointless is stopped. The extra workers end 30 s after the last such search

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
