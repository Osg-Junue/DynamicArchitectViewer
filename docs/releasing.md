# Releasing

How to publish the extension in `apps/vscode` to the Visual Studio Marketplace. This is for maintainers.

## Versioning

- The extension follows [Semantic Versioning](https://semver.org/). Fixes bump the patch version, and new features bump the minor version.
- `0.x` was a preview, marked with `"preview": true` in `package.json`.
- Since `1.0.0` the extension is stable, and `"preview"` is gone.
- The language version follows the major version: every `1.x.x` release is `dav 1`. A change that cannot stay compatible with `dav 1` needs a major release `n.0.0`, which introduces `dav n`. See [Compatibility](specification.md#compatibility).

## Branches

- `develop` is the default branch. Every change reaches it by a pull request.
- `main` holds what was released. A release is a pull request from `develop` into `main`, and the tag is put on its merge commit.
- A fix for a released version that cannot wait for the next release goes in a pull request into `main`, and then into `develop` as well.
- Both branches take changes only by pull request, with the `check` workflow passing.
- The Marketplace page and the agent skills link to `main`, so they show the released documentation and images rather than what is still on `develop`.

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
- [ ] The release pull request from `develop` into `main` is merged, and the package is built from `main`: README images are read from `main` on GitHub.
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

Note the SHA-256 of the file (`Get-FileHash` in PowerShell). `npm run package` writes other bytes every time, and the GitHub release attaches the file that was published:

```bash
sha256sum apps/vscode/dist/dynamic-architect-viewer.vsix
```

## Publish

From `apps/vscode`, publish the package you inspected:

```bash
npx vsce publish --packagePath dist/dynamic-architect-viewer.vsix
```

The Marketplace lists the new version a few minutes later. A version can be published once: a second `vsce publish` answers that it already exists.

Then check that README images appear on the Marketplace page, and tag the merge commit of the release:

```bash
git tag -a v<version> -m "DynamicArchitectViewer <version>" <commit>
git push origin v<version>
```

## Publish the command line

The npm package `dynamic-architect-viewer-cli` in `apps/cli` is released with the extension, under the same version. The first time, log in with `npm login`. From `apps/cli`, look at what the package holds:

```bash
npm pack --dry-run
```

It should list only `package.json`, `README.md`, `LICENSE` and `dist/dav.mjs`. `prepack` builds `dist/dav.mjs` first. Then publish:

```bash
npm publish
```

The registry serves the new version a few minutes later. Then try it from a folder outside this repository, where `npx` does not take the copy in the workspace:

```bash
npx dynamic-architect-viewer-cli@<version> --version
```

The READMEs give the version in the line for CI (`dynamic-architect-viewer-cli@<version>`). Update it in `README.md` and `apps/cli/README.md`.

## GitHub release

After the tag is pushed, create the release from it, with the file that was published attached as `dynamic-architect-viewer-<version>.vsix`:

```bash
gh release create v<version> dynamic-architect-viewer-<version>.vsix --verify-tag --title "DynamicArchitectViewer <version>" --notes-file notes.md
```

The notes follow the release before:

- A sentence on what the release brings, where to install the extension and the command line, and whether the language stays `dav 1`.
- Under "New since \<previous version\>", the changes that matter to a reader, grouped by subject. The changelog has the full list.
- Links that point at the tag (`blob/v<version>/...`), so that they keep showing this release.

The attached file is the one that was published. If `dist/dynamic-architect-viewer.vsix` was built again since, download the published file from the Marketplace and compare it with the SHA-256 you noted:

```bash
curl -L --compressed -o dynamic-architect-viewer-<version>.vsix https://marketplace.visualstudio.com/_apis/public/gallery/publishers/osg-junue/vsextensions/dynamic-architect-viewer/<version>/vspackage
```

## Playground

The playground (`apps/vscode/src/playground`) is a page on GitHub Pages where a diagram is written and played in the browser: <https://osg-junue.github.io/DynamicArchitectViewer/>. The `Playground` workflow builds and publishes it when a tag `v*` is pushed, so that it behaves as the published extension does. After the tag is pushed, check that the workflow passed and that the page opens.

The first time:

1. In the repository's Settings, under Pages, choose "GitHub Actions" as the source.
2. Under Environments, in `github-pages`, allow the tags `v*` to deploy. Without it only the default branch may, and the run for a tag is refused.

To publish the current `main` between releases, run the workflow by hand on `main`. The `github-pages` environment accepts `main` and the tags `v*`, so a run on `develop` is refused:

```bash
gh workflow run Playground --ref main
```

To try the page locally, from `apps/vscode`:

```bash
npm run dev:playground
```
