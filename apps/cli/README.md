# dynamic-architect-viewer-cli

The `dav` command of [DynamicArchitectViewer](https://github.com/Osg-Junue/DynamicArchitectViewer): write architecture and screen-flow diagrams as text in `.dav` files, and play them step by step. The command does what the VS Code extension does with a `.dav` file, without the editor: in a terminal or in CI.

It needs [Node.js](https://nodejs.org/) 20 or later, and has no dependencies.

```bash
npx dynamic-architect-viewer-cli export docs/checkout.dav
```

This writes `docs/checkout.svg`: an animated SVG that plays every step without a script, so GitHub and GitLab show it in a README. Installed, the command is `dav`.

## Commands

| Command | Does |
| :--- | :--- |
| `dav export` | Writes an SVG image or a standalone HTML file next to each diagram |
| `dav check` | Reports what the editor reports. `--detail` adds hints and describes the layout, and `--write` formats the file first |
| `dav format` | Formats files in place. `--check` writes nothing and fails when a file is not formatted |
| `dav outline` | Prints what a diagram says, with every reference resolved. `--json` prints it as JSON |

`dav <command> --help` lists the options of a command.

## Exporting

```bash
dav export docs/*.dav                       # an animated SVG next to each diagram
dav export --camera whole checkout.dav      # the whole diagram stays in view
dav export --still checkout.dav             # a still picture
dav export --step 2 checkout.dav            # only step 2, as checkout-step2.svg
dav export --format html checkout.dav       # a standalone HTML file with the player
dav export --out-dir docs/media docs/*.dav  # into another directory
dav export -o site/flow.svg checkout.dav    # under another name
```

A diagram with an error is not exported; the errors are printed with their line and column. Warnings are printed and do not stop the export.

## Keeping a README up to date in CI

`--check` writes nothing. It fails when a file is missing or is not what its diagram exports now:

```yaml
- run: npx dynamic-architect-viewer-cli@1.1.0 export --check docs/*.dav
```

Give the version in full. An export depends only on the text and the options, but a later version may lay out a diagram differently, and then the check fails until the files are exported again.

## Exit codes

| Code | Meaning |
| :--- | :--- |
| 0 | Nothing to report |
| 1 | Something was reported: a diagnostic, a file that is not formatted, an export that is missing or out of date |
| 2 | The command was not understood, or a file could not be read |

## License

[MIT](LICENSE)
