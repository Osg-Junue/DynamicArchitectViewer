import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Enforces the dependency direction from docs/architecture.md:
 *   model -> (nothing); dsl, layout -> model; scene -> layout, model;
 *   runtime -> scene, layout, model; exporter -> dsl, layout, model, scene, runtime.
 * No layer may depend on React.
 */
const SRC = resolve(__dirname, '..');

const RULES: Record<string, { allowedLayers: string[]; forbiddenPackages: RegExp }> = {
  model: { allowedLayers: ['model'], forbiddenPackages: /^(react|react-dom|@lezer\/)/ },
  dsl: { allowedLayers: ['dsl', 'model'], forbiddenPackages: /^(react|react-dom)/ },
  layout: { allowedLayers: ['layout', 'model'], forbiddenPackages: /^(react|react-dom|@lezer\/)/ },
  scene: {
    allowedLayers: ['scene', 'layout', 'model'],
    forbiddenPackages: /^(react|react-dom|@lezer\/)/,
  },
  // The runtime is inlined into exported HTML: it must not pull in the parser or React.
  runtime: {
    allowedLayers: ['runtime', 'scene', 'layout', 'model'],
    forbiddenPackages: /^(react|react-dom|@lezer\/)/,
  },
  exporter: {
    allowedLayers: ['exporter', 'dsl', 'layout', 'model', 'scene', 'runtime'],
    forbiddenPackages: /^(react|react-dom|vscode)/,
  },
  protocol: {
    allowedLayers: ['protocol'],
    forbiddenPackages: /^(react|react-dom|vscode|@lezer\/)/,
  },
  samples: {
    allowedLayers: ['samples'],
    forbiddenPackages: /^(react|react-dom|vscode|@lezer\/)/,
  },
  prompt: {
    allowedLayers: ['prompt', 'model'],
    forbiddenPackages: /^(react|react-dom|vscode|@lezer\/)/,
  },
  skill: {
    allowedLayers: ['skill', 'dsl', 'model'],
    forbiddenPackages: /^(react|react-dom|vscode)/,
  },
  editor: {
    allowedLayers: [
      'editor',
      'dsl',
      'exporter',
      'layout',
      'model',
      'prompt',
      'protocol',
      'runtime',
      'samples',
      'scene',
    ],
    forbiddenPackages: /^(react|react-dom|vscode)/,
  },
  extension: {
    allowedLayers: [
      'extension',
      'protocol',
      'prompt',
      'dsl',
      'exporter',
      'samples',
      'model',
      'layout',
    ],
    forbiddenPackages: /^(react|react-dom)/,
  },
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('architecture: layer boundaries', () => {
  it('covers every layer directory under src/', () => {
    const dirs = readdirSync(SRC)
      .filter((name) => name !== '__tests__' && statSync(join(SRC, name)).isDirectory())
      .sort();
    expect(dirs).toEqual(Object.keys(RULES).sort());
  });

  for (const [layer, rule] of Object.entries(RULES)) {
    it(`${layer}/ respects its allowed dependencies`, () => {
      const violations: string[] = [];
      for (const file of sourceFiles(join(SRC, layer))) {
        const isTest = file.includes('__tests__');
        const content = readFileSync(file, 'utf8');
        for (const [, spec] of content.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
          if (!spec) continue;
          if (spec.startsWith('.')) {
            const target = relative(SRC, resolve(join(file, '..'), spec)).split(/[\\/]/)[0] ?? '';
            // Tests may build fixtures with the parser and samples.
            const allowed = isTest
              ? [...rule.allowedLayers, 'samples', 'dsl', 'layout']
              : rule.allowedLayers;
            if (
              !allowed.includes(target) &&
              !target.endsWith('.grammar') &&
              !spec.endsWith('.dav?raw')
            ) {
              violations.push(`${relative(SRC, file)} -> ${spec}`);
            }
          } else if (rule.forbiddenPackages.test(spec)) {
            violations.push(`${relative(SRC, file)} -> ${spec}`);
          }
        }
      }
      expect(violations).toEqual([]);
    });
  }
});
