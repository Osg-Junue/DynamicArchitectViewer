# Releasing

How to publish the extension in `apps/vscode` to the Visual Studio Marketplace. This is for maintainers.

## Versioning

- The extension follows [Semantic Versioning](https://semver.org/). Fixes bump the patch version, and new features bump the minor version.
- `0.x` was a preview, marked with `"preview": true` in `package.json`.
- Since `1.0.0` the extension is stable, and `"preview"` is gone.
- The language version follows the major version: every `1.x.x` release is `dav 1`. A change that cannot stay compatible with `dav 1` needs a major release `n.0.0`, which introduces `dav n`. See [Compatibility](specification.md#compatibility).

## First-time setup

1. Create a publisher with the ID `osg-junue` in the [Marketplace management page](https://marketplace.visualstudio.com/manage).
2. In Azure DevOps, create a personal access token with the Marketplace (Manage) scope.
3. Register the token from `apps/vscode`:

```bash
npx vsce login osg-junue
```

## Before publishing

- [ ] The extension was checked in a real VS Code window.
- [ ] For a patch or minor release: every change to the language is a [compatible change](specification.md#compatibility).
- [ ] `version` in `apps/vscode/package.json` and `apps/vscode/CHANGELOG.md` are updated.
- [ ] The commit to publish is on the default branch, because README images are read from GitHub's `HEAD`.
- [ ] The animations in the READMEs and docs show the current look. [`promo/pv`](../promo/pv/README.md) renders them again.
- [ ] `npm run check` passes at the repository root.
- [ ] `npx playwright test` passes in `apps/vscode`.
- [ ] `version` in `apps/cli/package.json` is the version of the extension. A test fails when the two differ.

## Package and inspect

From the repository root:

```bash
npm run package
```

This creates `apps/vscode/dist/dynamic-architect-viewer.vsix`, which is a ZIP file. Under `extension/`, it should contain only:

| Path | Contents |
| :--- | :--- |
| `dist/extension.cjs` | The extension host, with its dependencies bundled |
| `dist/webview/` | The preview webview |
| `dist/skill/` | The agent skills for the install command |
| `media/icon.png`, `media/file-icon-*.svg` | The extension icon and `.dav` file icons |
| `syntaxes/`, `language-configuration.json` | Language definition |
| `package.json`, `package.nls*.json` | Manifest and translations |
| `readme.md`, `changelog.md`, `LICENSE.txt` | Documents |

If `src/`, `e2e/`, `node_modules/` or source maps appear, fix `.vscodeignore`.

## Publish

From `apps/vscode`, publish the package you inspected:

```bash
npx vsce publish --packagePath dist/dynamic-architect-viewer.vsix
```

Then check that README images appear on the Marketplace page, and tag the commit `v<version>`.

## Publish the command line

The npm package `dynamic-architect-viewer-cli` in `apps/cli` is released with the extension, under the same version. The first time, log in with `npm login`. From `apps/cli`, look at what the package holds:

```bash
npm pack --dry-run
```

It should list only `package.json`, `README.md`, `LICENSE` and `dist/dav.mjs`. `prepack` builds `dist/dav.mjs` first. Then publish:

```bash
npm publish
```

The READMEs give the version in the line for CI (`dynamic-architect-viewer-cli@<version>`). Update it in `README.md` and `apps/cli/README.md`.
