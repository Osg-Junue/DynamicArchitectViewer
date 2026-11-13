import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The contrast of the diagram's own colors against the built-in backgrounds, which exported
 * files and the preview outside VS Code use. Inside VS Code the background comes from the theme.
 */
const css = readFileSync(resolve(__dirname, '../runtime/scene.css'), 'utf8');

type Rgb = [number, number, number];
type Theme = 'light' | 'dark';
const THEMES: Theme[] = ['light', 'dark'];

const hex = (value: string): Rgb => {
  const n = Number.parseInt(value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** A token defined as `light-dark(#light, #dark)`. */
function token(name: string): Record<Theme, Rgb> {
  const match = new RegExp(`--dav-${name}: light-dark\\((#[0-9a-f]{6}), (#[0-9a-f]{6})\\)`).exec(
    css,
  );
  if (!match?.[1] || !match[2]) throw new Error(`no light-dark colors for --dav-${name}`);
  return { light: hex(match[1]), dark: hex(match[2]) };
}

/** A `--raw-*` value: the first definition is the light one, the second the dark one. */
function raw(name: string): Record<Theme, Rgb> {
  const found = [...css.matchAll(new RegExp(`--raw-${name}: (#[0-9a-f]{6})`, 'g'))];
  if (!found[0]?.[1] || !found[1]?.[1])
    throw new Error(`no light and dark value for --raw-${name}`);
  return { light: hex(found[0][1]), dark: hex(found[1][1]) };
}

const mix = (top: Rgb, under: Rgb, share: number): Rgb =>
  top.map((v, i) => v * share + (under[i] ?? 0) * (1 - share)) as Rgb;

function luminance(color: Rgb): number {
  const [r, g, b] = color.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const PALETTE = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'gray'];
const bg = raw('bg');
const fg = raw('fg');

/** The share of the text color in a rail, as scene.css mixes it for each theme. */
function railShares(): Record<Theme, number> {
  const match =
    /--dav-edge: light-dark\(\s*color-mix\(in srgb, var\(--dav-fg\) (\d+)%, var\(--dav-bg\)\),\s*color-mix\(in srgb, var\(--dav-fg\) (\d+)%, var\(--dav-bg\)\)\s*\)/.exec(
      css,
    );
  if (!match) throw new Error('no rail color mixed per theme');
  return { light: Number(match[1]) / 100, dark: Number(match[2]) / 100 };
}

describe('the diagram palette', () => {
  it.each(THEMES)('%s: text in the background color reads on every palette color', (theme) => {
    // Badges and numbered stops: 11px text, so 4.5 and not the 3 that large text may have.
    for (const name of PALETTE) {
      const ratio = contrast(bg[theme], token(`c-${name}`)[theme]);
      expect(ratio, `${name} in the ${theme} theme`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(THEMES)('%s: the number on an accent-colored stop reads', (theme) => {
    expect(contrast(token('on-accent')[theme], token('accent')[theme])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)('%s: a rail stands out from the background and from every zone', (theme) => {
    const rail = mix(fg[theme], bg[theme], railShares()[theme]);
    expect(contrast(rail, bg[theme])).toBeGreaterThanOrEqual(3);
    // A zone is its color at 14% over the background, or the text color at 7%.
    const tints = [
      ...PALETTE.map((name) => mix(token(`c-${name}`)[theme], bg[theme], 0.14)),
      mix(fg[theme], bg[theme], 0.07),
    ];
    for (const tint of tints) expect(contrast(rail, tint)).toBeGreaterThanOrEqual(3);
  });
});
