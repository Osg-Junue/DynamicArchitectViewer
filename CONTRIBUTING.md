# Contributing

## Setup

You need the [Node.js](https://nodejs.org/) version in [`.node-version`](.node-version).

```bash
npm ci
npm run dev
```

`npm run dev` serves the preview in a browser with a sample diagram, which is the fastest way to work on rendering.

To run the real extension, open this repository in VS Code and press `F5`. Run `npm run build` first, since the launch configuration uses the built files.

## Commands

Run these from the repository root.

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Preview in a browser |
| `npm run build` | Build the extension |
| `npm run check` | Lint, typecheck and unit tests. CI runs this |
| `npm test` | Unit tests only |
| `npm run lint:fix` | Fix formatting and lint errors |
| `npm run package` | Build the `.vsix` |

End-to-end tests run from `apps/vscode`, against a production build. CI runs them too:

```bash
npx playwright install chromium
npx playwright test
```

## Where things are

The [architecture guide](docs/architecture.md) describes each module and the dependency rules, which a test enforces. Before proposing a feature, check [Design decisions](docs/design-decisions.md).

## Common changes

**Add an icon**

1. Add the name to `ICON_NAMES` in `src/model/types.ts`.
2. Add its description to `ICON_META` in `src/model/icons.ts`.
3. Add its artwork to `ICON_SHAPES` in `src/scene/icons.ts`, on a 24×24 grid.
4. Add the name to `syntaxes/dav.tmLanguage.json`, in the same position.
5. Update the list and counts in `docs/specification.md`, and the count in `apps/vscode/README.md` and `CHANGELOG.md`.
6. Add the name to the list in `skills/dav-diagrams/SKILL.md`.

The type checker catches a missing step 2 or 3, and tests catch steps 4 and 6. Check that a misspelling of an existing icon still suggests the right name, because ties go to the earlier name in `ICON_NAMES`.

**Add a sample**

1. Add the file to `examples/`, then import it with `?raw` and list it in `SAMPLE_TEMPLATES` in `src/samples/index.ts`. A test fails when a file in `examples/` is not listed. Then add it to `docs/examples.md`, with the SVG that `node svg.mjs` in `promo/pv` exports for it.
2. Add its limit to `CROSSING_BUDGET` in `src/layout/__tests__/layout.test.ts`, once for each.

**Add an attribute**

1. Add it to `ATTRIBUTE_SCHEMA` in `src/dsl/schema.ts`, which drives validation.
2. For a new attribute name, add it to `ATTRIBUTE_KEYS` in `src/dsl/complete.ts` and to the attribute pattern in `syntaxes/dav.tmLanguage.json`.
3. Read it in `src/dsl/analyze.ts`, and add it to the model.
4. Update `docs/specification.md`, the in-app docs in `src/editor/docs/`, the prompt in `src/prompt/index.ts`, and `skills/dav-diagrams/SKILL.md`.

Only make [compatible changes](docs/specification.md#compatibility) to `dav 1`.

**Change the language, specification or layout guide**

`npm test` and `npm run build` regenerate the files in `skills/dav-diagrams/` that come from the parser, `docs/` and `examples/`. Commit them with your change, or CI fails.

**Change the layout**

Read the [exact rules and invariants](docs/layout.md#exact-rules) first.

## Pull requests

- Keep each pull request to one purpose.
- Add a test for a bug fix or new behavior.
- `npm run check` should pass, and the end-to-end tests too if the preview or export changed.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), with the module as the scope, such as `fix(layout): ...`.
- All documentation and code comments are in English.
