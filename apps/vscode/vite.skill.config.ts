import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lezer } from '@lezer/generator/rollup';
import { defineConfig, type Plugin } from 'vite';

const ROOT = resolve(import.meta.dirname, '../..');
const REPOSITORY_URL = 'https://github.com/Osg-Junue/DynamicArchitectViewer/blob/main/';

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

/**
 * Skills without a script, so no mode builds them. Each carries documents alone: the name in
 * `references/`, and the file of the repository it is a copy of.
 */
const WITHOUT_SCRIPT = [
  { name: 'dav-cli', references: { 'manual.md': 'apps/cli/README.md' } },
] as const;

/**
 * A document as a skill carries it. Links to a document the skill carries too stay relative;
 * the others would lead out of the skill, and point at GitHub.
 */
function carriedText(source: string, carried: readonly string[]): string {
  const kept = ['https?:', '#', ...carried.map((name) => name.replace('.', '\\.'))].join('|');
  const elsewhere = new RegExp(`\\]\\((?!${kept})([^)]+)\\)`, 'g');
  const base = new URL(source, REPOSITORY_URL);
  return readFileSync(resolve(ROOT, source), 'utf8').replace(
    elsewhere,
    (_, target: string) => `](${new URL(target, base).href})`,
  );
}

/** Writes the documents of a skill anew, so that one it no longer carries does not stay. */
function writeReferences(skill: string, sources: Readonly<Record<string, string>>): void {
  const references = resolve(ROOT, 'skills', skill, 'references');
  rmSync(references, { recursive: true, force: true });
  mkdirSync(references, { recursive: true });
  for (const [name, source] of Object.entries(sources)) {
    writeFileSync(resolve(references, name), carriedText(source, Object.keys(sources)));
  }
}

/** The VSIX contains only apps/vscode, so the install command needs its own copy of a skill. */
function packageSkill(name: string): void {
  const packaged = resolve(import.meta.dirname, 'dist/skill', name);
  rmSync(packaged, { recursive: true, force: true });
  cpSync(resolve(ROOT, 'skills', name), packaged, { recursive: true });
}

function assembleSkill(skill: Skill): Plugin {
  const dir = resolve(ROOT, 'skills', skill.name);
  return {
    name: 'assemble-skill',
    closeBundle() {
      writeReferences(
        skill.name,
        Object.fromEntries(skill.docs.map((name) => [name, `docs/${name}`])),
      );

      if (skill.examples) {
        const examples = resolve(dir, 'assets/examples');
        rmSync(examples, { recursive: true, force: true });
        cpSync(resolve(ROOT, 'examples'), examples, { recursive: true });
        if (readdirSync(examples).length === 0) throw new Error('No examples to bundle');
      }

      packageSkill(skill.name);
      // The skills without a script go with the first build, so that `build:skill` covers them all.
      if (skill === SKILLS.production) {
        for (const { name, references } of WITHOUT_SCRIPT) {
          writeReferences(name, references);
          packageSkill(name);
        }
      }
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
