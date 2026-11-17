# Releasing

How a release is published: the extension in `apps/vscode` to the Visual Studio Marketplace and to Open VSX, and the command line in `apps/cli` to npm. This is for maintainers.

## Versioning

- The extension follows [Semantic Versioning](https://semver.org/). Fixes bump the patch version, and new features bump the minor version.
- `0.x` was a preview, marked with `"preview": true` in `package.json`.
- Since `1.0.0` the extension is stable, and `"preview"` is gone.
- The language version follows the major version: every `1.x.x` release is `dav 1`. A change that cannot stay compatible with `dav 1` needs a major release `n.0.0`, which introduces `dav n`. See [Compatibility](specification.md#compatibility).
- The npm package `dynamic-architect-viewer-cli` is released with the extension, under the same version.

## Branches

- `develop` is the default branch. Every change reaches it by a pull request.
- `main` holds what was released. A release is a pull request from `develop` into `main`, and the tag is put on its merge commit.
- A fix for a released version that cannot wait for the next release goes in a pull request into `main`, and then into `develop` as well.
- Both branches take changes only by pull request, with the `check` workflow passing.
- The Marketplace page and the agent skills link to `main`, so they show the released documentation and images rather than what is still on `develop`.

## How a release is published

Pushing the tag of a release starts the `Release` workflow (`.github/workflows/release.yml`), which publishes everything. Nothing is published from a maintainer's machine.

The workflow stores no token. Each registry is told once to trust the workflow file `release.yml` of this repository, in the GitHub environment `release` (trusted publishing over OpenID Connect). For each run, GitHub Actions gives the workflow a token that says where it runs, and the registry exchanges it for a short-lived one.

## First-time setup

On GitHub, in the repository's Settings, under Environments, create the environment `release`. Under "Deployment branches and tags", allow only the tags `v*`. A registry trusts the workflow file on any branch; the environment narrows that to the tags of releases.

Then register the workflow in each registry, with the same four values:

| Field | Value |
| :--- | :--- |
| Owner | `Osg-Junue` |
| Repository | `DynamicArchitectViewer` |
| Workflow | `release.yml` |
| Environment | `release` |

| Registry | Where |
| :--- | :--- |
| Visual Studio Marketplace | In the [management page](https://marketplace.visualstudio.com/manage), open the publisher `osg-junue`, then Trusted Publishing, then Create |
| npm | On npmjs.com, in the settings of the package `dynamic-architect-viewer-cli`, under Trusted Publisher, choose GitHub Actions and allow `npm publish` |
| Open VSX | On [open-vsx.org](https://open-vsx.org), in Settings, under Trusted Publishers, choose the namespace `osg-junue` |

Open VSX takes the registration only from the owner of the namespace. Whoever creates a namespace can publish to it but does not own it: ownership is claimed in an issue of [EclipseFdn/open-vsx.org](https://github.com/EclipseFdn/open-vsx.org/issues/new/choose). For `osg-junue` it was granted in [issue 15769](https://github.com/EclipseFdn/open-vsx.org/issues/15769).

## Before a release

- [ ] The extension was checked in a real VS Code window.
- [ ] For a patch or minor release: every change to the language is a [compatible change](specification.md#compatibility).
- [ ] `version` in `apps/vscode/package.json` and in `apps/cli/package.json` is the new version, and `apps/vscode/CHANGELOG.md` has a heading for it in place of "Unreleased".
- [ ] The version in `skills/dav-cli/SKILL.md`, and in the line for CI (`dynamic-architect-viewer-cli@<version>`) of `README.md` and `apps/cli/README.md`, is the new version. A test fails when the skill and the package differ.
- [ ] The animations in the READMEs and docs show the current look. [`promo/pv`](../promo/pv/README.md) renders them again.
- [ ] The release pull request from `develop` into `main` is merged: README images are read from `main` on GitHub.

To see what the workflow would publish, without publishing, run it by hand. It builds and inspects the packages and stops there:

```bash
gh workflow run Release --ref main
```

With `--ref develop` it builds what is not released yet.

## Release

Tag the merge commit of the release pull request, and push the tag:

```bash
git tag -a v<version> -m "DynamicArchitectViewer <version>" <commit>
git push origin v<version>
```

The `Release` workflow then:

1. Checks that the tag is on `main`, that it is the version of both packages, and that the changelog has a heading for it.
2. Runs `npm run check` and the end-to-end tests.
3. Builds the extension (`dynamic-architect-viewer-<version>.vsix`) and the npm package once, and checks what they hold (see below). The summary of the run gives the SHA-256 of both files.
4. Publishes the same VSIX to the Visual Studio Marketplace and to Open VSX, and the npm package to npm, each in a job of its own.
5. Creates a draft GitHub release with the VSIX attached.

A version can be published once in each place. When a job fails, run that job again and not the whole workflow, so that the places that have the version are left alone:

```bash
gh run rerun <run-id> --failed
```

The `Playground` workflow runs for the same tag; see [Playground](#playground).

### What the packages hold

`.github/scripts/inspect-packages.sh` fails the workflow when a package holds a file that is not expected in it, or lacks one it needs. The `check` workflow runs it for the extension on every pull request. The VSIX is a ZIP file, and under `extension/` it holds only:

| Path | Contents |
| :--- | :--- |
| `dist/extension.cjs`, `dist/chunks/` | The extension host, with its dependencies bundled |
| `dist/webview/` | The preview webview |
| `dist/skill/` | The agent skills for the install command |
| `media/icon.png`, `media/file-icon-*.svg` | The extension icon and `.dav` file icons |
| `syntaxes/`, `language-configuration.json` | Language definition |
| `package.json`, `package.nls*.json` | Manifest and translations |
| `readme.md`, `changelog.md`, `LICENSE.txt` | Documents |

If the script reports `src/`, `e2e/`, `node_modules/` or source maps, fix `.vscodeignore`. If it reports a file that belongs in the package, add it to the script.

The npm package holds only `package.json`, `README.md`, `LICENSE` and `dist/dav.mjs`.

## After the workflow

- The Marketplace lists the new version a few minutes later. Check that README images appear on the page.
- Check that the page of the extension on open-vsx.org shows the new version.
- npm serves the new version a few minutes later. Try it from a folder outside this repository, where `npx` does not take the copy in the workspace:

```bash
npx dynamic-architect-viewer-cli@<version> --version
```

- Write the notes of the GitHub release, and publish it:

```bash
gh release edit v<version> --notes-file notes.md --draft=false
```

The notes follow the release before:

- A sentence on what the release brings, where to install the extension and the command line, and whether the language stays `dav 1`.
- Under "New since \<previous version\>", the changes that matter to a reader, grouped by subject. The changelog has the full list.
- Links that point at the tag (`blob/v<version>/...`), so that they keep showing this release.

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
