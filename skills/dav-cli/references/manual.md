# dynamic-architect-viewer-cli

The `dav` command of [DynamicArchitectViewer](https://github.com/Osg-Junue/DynamicArchitectViewer): write architecture and screen-flow diagrams as text in `.dav` files, and play them step by step. The command does what the VS Code extension does with a `.dav` file, without the editor: in a terminal or in CI.

```bash
npx dynamic-architect-viewer-cli export docs/checkout.dav
```

This writes `docs/checkout.svg`: an animated SVG that plays every step without a script, so GitHub and GitLab show it in a README.

- [Install](#install)
- [Commands](#commands)
- [`dav export`](#dav-export)
- [`dav check`](#dav-check)
- [`dav format`](#dav-format)
- [`dav outline`](#dav-outline)
- [Exit codes](#exit-codes)

## Install

The package is [`dynamic-architect-viewer-cli`](https://www.npmjs.com/package/dynamic-architect-viewer-cli) on npm. It needs [Node.js](https://nodejs.org/) 22.17 or later, and has no dependencies.

| Where | Install | Run |
| :--- | :--- | :--- |
| Nowhere: npm fetches the package when it is run | | `npx dynamic-architect-viewer-cli <command>` |
| In one project, as a development dependency | `npm install --save-dev dynamic-architect-viewer-cli` | `npx dav <command>` |
| On the machine, for every project | `npm install --global dynamic-architect-viewer-cli` | `dav <command>` |

The rest of this page writes `dav`. Without an install, write `npx dynamic-architect-viewer-cli` in its place.

`dav --version` prints the version. In CI and in scripts, name the version in full, as in `npx dynamic-architect-viewer-cli@<version>`: see [Keeping a README up to date in CI](#keeping-a-readme-up-to-date-in-ci).

## Commands

```
dav <command> [options] <file.dav>...
```

| Command | Does | Writes |
| :--- | :--- | :--- |
| [`dav export`](#dav-export) | Exports each diagram as an SVG image or a standalone HTML file | The exported files. Nothing with `--check` |
| [`dav check`](#dav-check) | Reports the errors and warnings the editor reports. `--detail` adds hints and describes the layout, and `--map` says which node is where | Nothing. With `--write`, the formatted `.dav` files |
| [`dav format`](#dav-format) | Formats each file, as the editor's formatter does | The `.dav` files, in place. Nothing with `--check` |
| [`dav outline`](#dav-outline) | Prints what one diagram says, with every reference resolved | Nothing |

- `dav --help` lists the commands, and `dav <command> --help` the options of a command.
- Options and files can be given in any order.
- A pattern such as `docs/*.dav` works in every shell: where the shell does not list the files, as in PowerShell and cmd.exe, the command does.
- What a command reports is one line for each finding, which starts with the file. An error or a warning of the language is `file:line:column: severity code: message`, and [the specification](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/docs/specification.md#diagnostics) lists the codes.

## `dav export`

```
dav export [options] <file.dav>...
```

Exports each diagram with the exporters of the editor. The file is written next to the diagram, under the same name: `docs/checkout.dav` gives `docs/checkout.svg`. Each file written is printed with its size, as `docs/checkout.svg: 25 KB`.

| Option | Does |
| :--- | :--- |
| `--format svg`, `--format html` | What to write. The default is `svg`, or `html` when `--out` ends in `.html` |
| `-o <file>`, `--out <file>` | The file to write, for one diagram |
| `--out-dir <dir>` | The directory to write to, instead of next to each diagram. Each file keeps the name of its diagram |
| `--camera follow`, `--camera whole` | SVG: `follow`, the default, moves the camera with the flow as the preview does. `whole` keeps the whole diagram in view, and only the flows move |
| `--still` | SVG: a still picture instead of an animation |
| `--labels` | SVG (`--still`): draw edge labels on the still image. On an overview still, each endpoint pair takes its first non-empty label across steps (checking `animate` before `static` within each step); with `--step <n>`, `static` labels show as usual and pairs without one take that step's first `animate` label |
| `--step <n>` | SVG: only step `n`, numbered from 1 as in the preview. The file is `checkout-step2.svg` |
| `--locale en`, `--locale ja` | The language of the texts around the diagram. The default is `en` |
| `--check` | Writes nothing, and fails when a file is missing or out of date. See [below](#keeping-a-readme-up-to-date-in-ci) |
| `-h`, `--help` | Shows the help |

What each form is:

| Options | Result |
| :--- | :--- |
| none | An animated SVG. It plays every step in a loop and runs no script, so GitHub and GitLab play it as an image |
| `--still` | A still SVG of the whole diagram (unlabeled overview), for print, slides or a place that shows no animation |
| `--still --labels` | A still SVG of the whole diagram with one representative edge label drawn per connection pair |
| `--step 2` | An animated SVG that repeats the flows of step 2 |
| `--step 2 --still` | A still SVG of the diagram as it is in step 2 (add `--labels` to also draw that step's `animate` labels) |
| `--format html` | One HTML file with every step and the controls of the preview. It works offline and makes no external requests, and it contains the source of the diagram |

A diagram without steps is exported as a still picture.

A directory that is not there yet is created.

```bash
dav export docs/*.dav                       # an animated SVG next to each diagram
dav export --camera whole checkout.dav      # the whole diagram stays in view
dav export --still checkout.dav             # a still picture
dav export --still --labels checkout.dav    # a still picture with representative edge labels
dav export --step 2 checkout.dav            # only step 2, as checkout-step2.svg
dav export --format html checkout.dav       # a standalone HTML file with the player
dav export --out-dir docs/media docs/*.dav  # into another directory
dav export -o site/flow.svg checkout.dav    # under another name
```

What stops an export:

| Case | Result |
| :--- | :--- |
| The diagram has an error | It is not exported. The errors are printed with their line and column, and the command exits with `1`. The other diagrams are still exported |
| The diagram has only warnings | They are printed, and the diagram is exported |
| `--step` names a step the diagram does not have | That diagram is not exported, and the command exits with `1` |
| `--camera`, `--still`, `--labels` or `--step` with HTML | Exit code `2`: they apply to an SVG |
| `--out` with several diagrams, or with `--out-dir` | Exit code `2` |
| Two diagrams of one name sent to one directory | Exit code `2`, and nothing is written: one file would replace the other |

### Keeping a README up to date in CI

`--check` writes nothing. For each diagram it says whether the file there is what the diagram exports now:

| Line | Meaning |
| :--- | :--- |
| `docs/checkout.svg: up to date` | The file is what the diagram exports |
| `docs/checkout.svg: out of date; ...` | The diagram, the options or the version changed since the export |
| `docs/checkout.svg: missing; ...` | No file is there |

It exits with `1` when a file is missing or out of date. Line endings that a checkout changed are not a difference.

```yaml
- run: npx dynamic-architect-viewer-cli@1.5.4 export --check docs/*.dav
```

- **Give the version in full.** An export depends only on the text and the options, but a later version may lay out a diagram differently, and then the check fails until the files are exported again.
- **Check with the options the files were exported with.** A file written with `--camera whole` is out of date for a check without it. One command line serves both: with `--check` it checks, and without it it exports.
- **One line for each form.** A diagram exported as an SVG and as HTML needs a second line, with `--format html`.

## `dav check`

```
dav check [--write] [--detail] [--map] <file.dav>...
```

Reports the errors and warnings of each file, as the editor shows them.

| Option | Does |
| :--- | :--- |
| `--write` | Formats each file in place before it is checked, as `dav format` does |
| `--detail` | Also gives hints, where the diagram says less than it could or shows a text cut off, and describes the layout |
| `--map` | Also says which node is where |
| `-h`, `--help` | Shows the help |

Hints, the layout and the map describe a diagram that compiles, so they are printed only for a file without errors and warnings.

| Line | Meaning | Fails the check |
| :--- | :--- | :--- |
| `file:line:column: error code: message` | The file does not compile | Yes |
| `file:line:column: warning code: message` | Part of the file is being ignored | Yes |
| `file: hint code: message` | With `--detail`: a description or a code block is missing, or a text is too long to be shown in full (e.g. `text-cut` on a >55-character `code` line). The message says what to fix. Hints fail `dav check --detail` (exit code `1`), but do not block `dav export` | Yes |
| `file: layout: ...` | With `--detail`: the size of the layout, and the columns and rows its nodes take | No |
| `file: note code: message` | With `--detail`: a shape of the layout that is often not meant, such as a diagram taller than wide, or an edge that closes a loop and so does not count for the columns | No |
| `file: map: ...` | With `--map`: which node is where | No |
| `file: ok (4 nodes, 3 edges, 2 steps)` | Nothing was reported for the file | No |

[What the checker prints](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/docs/checker.md) explains every line: each hint and note by its code and what to do about it, the layout lines, and how to read the map. [How diagrams are laid out](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/docs/layout.md) says what to write to get another arrangement.

## `dav format`

```
dav format [--check] <file.dav>...
```

Formats each file in place, as the editor's formatter does. Comments are kept.

| Option | Does |
| :--- | :--- |
| `--check` | Writes nothing, and fails when a file is not formatted |
| `-h`, `--help` | Shows the help |

| Line | Meaning |
| :--- | :--- |
| `file: formatted` | The file was written again |
| `file: unchanged` | The file was formatted already |
| `file: not formatted; ...` | With `--check`: `dav format` would change the file. The command exits with `1` |
| `file: not formatted, because it has a syntax error` | The file is left as it is. The error is printed with its line and column, and the command exits with `1` |

## `dav outline`

```
dav outline [--json] <file.dav>
```

Prints what one diagram says, as Markdown. The source gives IDs, nesting and attributes that last from step to step; the outline has them worked out, by the parser of the editor:

```
# Checkout

docs/checkout.dav: 4 nodes, 1 zones, 3 edges, 2 steps

## Zones and nodes

- Zone "Backend" (backend)
  - API (api): api
  - Orders DB (db): database
- Outside every zone
  - Browser (browser): browser
  - Payment provider (psp): external

## Connections

`-->` one way, `<->` both ways, `..>` and `<.>` the same drawn dashed.

- Browser (browser) --> API (api) : "HTTPS"
- API (api) --> Orders DB (db) : "SQL"
- API (api) --> Payment provider (psp) : "Charge"

Entry points (nothing points at them): Browser (browser)
End points (they point at nothing): Orders DB (db), Payment provider (psp)

## Steps

Packets are listed in the order they travel. Packets with the same number and a letter (2a, 2b) travel at the same time.

### Step 1: Place an order

1. Browser (browser) → API (api) : "POST /orders" [carries file]
2. API (api) → Orders DB (db) : "Insert"

### Step 2: The payment provider fails

Changes from this step on: psp: badge "503", color red

1. API (api) → Payment provider (psp) : "Charge" [carries payment; red]
```

| Part | Says |
| :--- | :--- |
| Zones and nodes | Every node under its zone, with its label, ID, icon, and badge or color. A hidden node is given with the step that shows it |
| Connections | Every edge with the labels of both ends, and the nodes that nothing points at or that point at nothing |
| Steps | The packets of each step in the order they travel. Packets with one number and a letter, `2a` and `2b`, travel at the same time. A step also says what it changes, and which badges and colors of earlier steps still show |
| Not part of any step | Nodes that no step touches, and edges that no packet travels along |

| Option | Does |
| :--- | :--- |
| `--json` | Prints the same outline as JSON, for a script |
| `-h`, `--help` | Shows the help |

It takes one file. For a file with an error, the outline says what could be read, the errors are printed after it, and the command exits with `1`.

## Exit codes

| Code | Meaning |
| :--- | :--- |
| 0 | Nothing to report |
| 1 | Something was reported: an error, a warning or a hint, a file that is not formatted, an export that is missing or out of date |
| 2 | The command was not understood, or a file could not be read |

`layout`, `note` and `map` lines of `dav check` do not change the exit code. Warnings alone do not stop `dav export`, which then exits with `0`.

## License

[MIT](https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/apps/cli/LICENSE)
