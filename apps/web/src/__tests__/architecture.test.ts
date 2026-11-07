import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Enforces the dependency direction from docs/05-roadmap/productization-strategy.md:
 *   model  -> (nothing)
 *   dsl    -> model
 * Neither may depend on React or the DOM-facing layers.
 */
const SRC = resolve(__dirname, '..');

const RULES: Record<string, { allowedLayers: string[]; forbiddenPackages: RegExp }> = {
  model: { allowedLayers: ['model'], forbiddenPackages: /^(react|react-dom|@lezer\/)/ },
  dsl: { allowedLayers: ['dsl', 'model', 'samples'], forbiddenPackages: /^(react|react-dom)/ },
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('architecture: layer boundaries', () => {
  for (const [layer, rule] of Object.entries(RULES)) {
    it(`${layer}/ respects its allowed dependencies`, () => {
      const violations: string[] = [];
      for (const file of sourceFiles(join(SRC, layer))) {
        const isTest = file.includes('__tests__');
        const content = readFileSync(file, 'utf8');
        for (const [, spec] of content.matchAll(/from\s+'([^']+)'/g)) {
          if (!spec) continue;
          if (spec.startsWith('.')) {
            const target = relative(SRC, resolve(join(file, '..'), spec)).split(/[\\/]/)[0] ?? '';
            const allowed = isTest ? [...rule.allowedLayers, 'samples'] : rule.allowedLayers;
            if (!allowed.includes(target) && !target.endsWith('.grammar')) {
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
