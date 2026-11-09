import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lezer } from '@lezer/generator/rollup';
import { defineConfig, type Plugin } from 'vite';

const ROOT = resolve(import.meta.dirname, '../..');
const SKILL_NAME = 'dav-diagrams';
const SKILL_DIR = resolve(ROOT, 'skills', SKILL_NAME);
const DOCS_URL = 'https://github.com/Osg-Junue/DynamicArchitectViewer/blob/HEAD/docs/';

/** Links that would break outside `docs/` point at GitHub instead. */
function copyDoc(name: string): void {
  const text = readFileSync(resolve(ROOT, 'docs', name), 'utf8').replace(
    /\]\((?!https?:|#|layout\.md|specification\.md)([^)]+)\)/g,
    (_, target: string) => `](${new URL(target, DOCS_URL).href})`,
  );
  writeFileSync(resolve(SKILL_DIR, 'references', name), text);
}

function assembleSkill(): Plugin {
  return {
    name: 'assemble-skill',
    closeBundle() {
      mkdirSync(resolve(SKILL_DIR, 'references'), { recursive: true });
      copyDoc('specification.md');
      copyDoc('layout.md');

      const examples = resolve(SKILL_DIR, 'assets/examples');
      rmSync(examples, { recursive: true, force: true });
      cpSync(resolve(ROOT, 'examples'), examples, { recursive: true });
      if (readdirSync(examples).length === 0) throw new Error('No examples to bundle');

      // The VSIX contains only apps/vscode, so the install command needs its own copy.
      const packaged = resolve(import.meta.dirname, 'dist/skill', SKILL_NAME);
      rmSync(packaged, { recursive: true, force: true });
      cpSync(SKILL_DIR, packaged, { recursive: true });
    },
  };
}

/**
 * Bundles the checker into the agent skill, then assembles the skill's other generated files.
 * The output is committed, because the skill can be installed directly from the repository.
 */
export default defineConfig({
  plugins: [lezer(), assembleSkill()],
  build: {
    outDir: resolve(SKILL_DIR, 'scripts'),
    emptyOutDir: true,
    minify: true,
    target: 'node18',
    lib: {
      entry: resolve(import.meta.dirname, 'src/skill/check.ts'),
      formats: ['es'],
      fileName: () => 'dav-check.mjs',
    },
    rollupOptions: {
      external: [/^node:/],
      output: {
        banner: '// Generated from apps/vscode/src/skill/check.ts. Do not edit.',
      },
    },
  },
});
