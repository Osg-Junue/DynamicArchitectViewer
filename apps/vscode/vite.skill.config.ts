import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lezer } from '@lezer/generator/rollup';
import { defineConfig, type Plugin } from 'vite';

const ROOT = resolve(import.meta.dirname, '../..');
const DOCS_URL = 'https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/docs/';

/** What is generated into each agent skill. `vite build --mode <key>` builds one of them. */
const SKILLS = {
  // The default mode of `vite build`.
  production: {
    name: 'dav-diagrams',
    entry: 'src/skill/checkEntry.ts',
    script: 'dav-check.mjs',
    docs: ['specification.md', 'layout.md'],
    examples: true,
  },
  reading: {
    name: 'dav-reading',
    entry: 'src/skill/outlineEntry.ts',
    script: 'dav-outline.mjs',
    docs: ['specification.md'],
    examples: false,
  },
} as const;

type Skill = (typeof SKILLS)[keyof typeof SKILLS];

function assembleSkill(skill: Skill): Plugin {
  const dir = resolve(ROOT, 'skills', skill.name);
  // Links to a document the skill carries stay relative; the others point at GitHub.
  const carried = skill.docs.map((name) => name.replace('.', '\\.')).join('|');
  const elsewhere = new RegExp(`\\]\\((?!https?:|#|${carried})([^)]+)\\)`, 'g');
  return {
    name: 'assemble-skill',
    closeBundle() {
      const references = resolve(dir, 'references');
      rmSync(references, { recursive: true, force: true });
      mkdirSync(references, { recursive: true });
      for (const name of skill.docs) {
        const text = readFileSync(resolve(ROOT, 'docs', name), 'utf8').replace(
          elsewhere,
          (_, target: string) => `](${new URL(target, DOCS_URL).href})`,
        );
        writeFileSync(resolve(references, name), text);
      }

      if (skill.examples) {
        const examples = resolve(dir, 'assets/examples');
        rmSync(examples, { recursive: true, force: true });
        cpSync(resolve(ROOT, 'examples'), examples, { recursive: true });
        if (readdirSync(examples).length === 0) throw new Error('No examples to bundle');
      }

      // The VSIX contains only apps/vscode, so the install command needs its own copy.
      const packaged = resolve(import.meta.dirname, 'dist/skill', skill.name);
      rmSync(packaged, { recursive: true, force: true });
      cpSync(dir, packaged, { recursive: true });
    },
  };
}

/**
 * Bundles a skill's script, then assembles the skill's other generated files. The script
 * carries the parser, so that it needs no install.
 * The output is committed, because the skills can be installed directly from the repository.
 */
export default defineConfig(({ mode }) => {
  const skill = SKILLS[mode as keyof typeof SKILLS];
  if (!skill) throw new Error(`No skill is built in mode "${mode}"`);
  return {
    plugins: [lezer(), assembleSkill(skill)],
    build: {
      outDir: resolve(ROOT, 'skills', skill.name, 'scripts'),
      emptyOutDir: true,
      minify: true,
      target: 'node18',
      lib: {
        entry: resolve(import.meta.dirname, skill.entry),
        formats: ['es'],
        fileName: () => skill.script,
      },
      rollupOptions: {
        external: [/^node:/],
        output: {
          banner: `// Generated from apps/vscode/${skill.entry}. Do not edit.`,
        },
      },
    },
  };
});
