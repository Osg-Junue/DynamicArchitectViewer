import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import runtimeScript from '../../runtime/generated/player.js?raw';
import { SAMPLE_TEMPLATES } from '../../samples';
import { ICON_SHAPES } from '../../scene/icons';
import { EXPORT_DATA_ELEMENT_ID, escapeJsonForHtml, exportHtml, importContent } from '../index';

const SAMPLE = SAMPLE_TEMPLATES[0]?.dsl ?? '';

const RUNTIME_BUDGET_GZIP = 50 * 1024;

function extract(html: string, re: RegExp): string {
  const m = re.exec(html);
  if (!m?.[1]) throw new Error(`No match for ${re}`);
  return m[1];
}

async function sha256Base64(content: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Buffer.from(digest).toString('base64');
}

describe('exportHtml', () => {
  it('produces a self-contained document without external references', async () => {
    const html = await exportHtml(SAMPLE);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).not.toMatch(/(src|href)=["']?(https?:)?\/\//i);
    expect(html).not.toMatch(/@import|url\(\s*["']?https?:/i);
    expect(html).toContain('<title>AWS multi-AZ web architecture &amp; database failover</title>');
  });

  it('sets a strict CSP whose hashes match the inline script and style', async () => {
    const html = await exportHtml(SAMPLE);
    const csp = extract(html, /http-equiv="Content-Security-Policy" content="([^"]+)"/);
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');

    const script = extract(html, /<script>([\s\S]*?)<\/script>/);
    const style = extract(html, /<style>([\s\S]*?)<\/style>/);
    expect(csp).toContain(`'sha256-${await sha256Base64(script)}'`);
    expect(csp).toContain(`'sha256-${await sha256Base64(style)}'`);
  });

  it('embeds hostile DSL text without breaking out of the data element', async () => {
    const dsl = 'dav 1\ntitle "</script><script>alert(1)</script><!--"\nnode a "\\u2028 & <b>"';
    const html = await exportHtml(dsl);
    const scripts = html.match(/<script\b/g) ?? [];
    expect(scripts).toHaveLength(2);
    expect(html).not.toContain('<script>alert(1)');
    const json = extract(html, new RegExp(`id="${EXPORT_DATA_ELEMENT_ID}">([\\s\\S]*?)</script>`));
    expect(JSON.parse(json).dsl).toBe(dsl);
  });

  it('escapes JSON so it stays valid and inert', () => {
    const raw = JSON.stringify({ s: '</script><!-- & \u2028\u2029' });
    const escaped = escapeJsonForHtml(raw);
    expect(escaped).not.toMatch(/[<>&\u2028\u2029]/);
    expect(JSON.parse(escaped)).toEqual(JSON.parse(raw));
  });

  it('includes document, layout and format metadata in the payload', async () => {
    const html = await exportHtml(SAMPLE, { locale: 'en' });
    const json = JSON.parse(
      extract(html, new RegExp(`id="${EXPORT_DATA_ELEMENT_ID}">([\\s\\S]*?)</script>`)),
    );
    expect(json).toMatchObject({ format: 'dynamic-architect-viewer', version: 1, locale: 'en' });
    expect(Object.keys(json.layout.nodes)).toHaveLength(json.document.nodes.length);
    expect(html).toContain('<html lang="en">');
  });
});

describe('embedded icons', () => {
  const payloadOf = (html: string) =>
    JSON.parse(extract(html, new RegExp(`id="${EXPORT_DATA_ELEMENT_ID}">([\\s\\S]*?)</script>`)));

  it('keeps icon artwork out of the runtime bundle', () => {
    for (const shapes of [ICON_SHAPES.container, ICON_SHAPES.runtime]) {
      const d = shapes.find(([tag]) => tag === 'path')?.[1].d;
      expect(d).toBeTypeOf('string');
      expect(runtimeScript).not.toContain(d);
    }
  });

  it('embeds exactly the node and packet icons a document uses', async () => {
    const dsl = [
      'dav 1',
      'node a [icon: browser]',
      'node b [icon: database]',
      'a --> b',
      'step "s" {',
      '  animate a --> b [icon: key]',
      '}',
    ].join('\n');
    const { document } = parse(dsl);
    expect(document.steps[0]?.animations[0]?.icon).toBe('key');
    const { icons } = payloadOf(await exportHtml(dsl));
    expect(Object.keys(icons).sort()).toEqual(['browser', 'database', 'key']);
    expect(icons.key).toEqual(ICON_SHAPES.key);
  });

  it.each(SAMPLE_TEMPLATES.map((s) => [s.id, s.dsl] as const))(
    '%s: embeds every icon its document references',
    async (_, dsl) => {
      const { document, icons } = payloadOf(await exportHtml(dsl));
      const referenced = [
        ...document.nodes.map((n: { icon: string }) => n.icon),
        ...document.steps.flatMap((s: { animations: { icon?: string }[] }) =>
          s.animations.flatMap((a) => a.icon ?? []),
        ),
      ];
      expect(new Set(Object.keys(icons))).toEqual(new Set(referenced));
    },
  );
});

describe('importContent', () => {
  it.each(SAMPLE_TEMPLATES.map((s) => [s.id, s.dsl] as const))(
    '%s: round-trips the exact DSL through exported HTML',
    async (_, dsl) => {
      const result = importContent(await exportHtml(dsl));
      expect(result).toEqual({ ok: true, dsl, source: 'html' });
    },
  );

  it('accepts plain DSL text', () => {
    expect(importContent('dav 1\nnode a')).toEqual({
      ok: true,
      dsl: 'dav 1\nnode a',
      source: 'dsl',
    });
  });

  it.each(['<!-- saved page --><html></html>', '<head></head>', '﻿  <p>hi</p>'])(
    'treats markup with another start as HTML: %s',
    (html) => {
      expect(importContent(html)).toEqual({ ok: false, reason: 'unrecognized-html' });
    },
  );

  it('still finds the DSL when the exported HTML has content before <!DOCTYPE>', async () => {
    const dsl = 'dav 1\nnode a';
    expect(importContent(`<!-- saved from url -->\n${await exportHtml(dsl)}`)).toEqual({
      ok: true,
      dsl,
      source: 'html',
    });
  });

  it('rejects unrelated or corrupt HTML', () => {
    expect(importContent('<!DOCTYPE html><html><body>hi</body></html>')).toEqual({
      ok: false,
      reason: 'unrecognized-html',
    });
    expect(
      importContent(
        `<html><script type="application/json" id="${EXPORT_DATA_ELEMENT_ID}">{oops</script>`,
      ),
    ).toEqual({ ok: false, reason: 'corrupt' });
    expect(
      importContent(
        `<html><script type="application/json" id="${EXPORT_DATA_ELEMENT_ID}">{"format":"dynamic-architect-viewer","version":99,"dsl":""}</script>`,
      ),
    ).toEqual({ ok: false, reason: 'unsupported-version' });
  });
});

describe('runtime bundle', () => {
  it(`stays within the size budget (${RUNTIME_BUDGET_GZIP / 1024} KB gzip)`, () => {
    expect(gzipSync(runtimeScript).length).toBeLessThan(RUNTIME_BUDGET_GZIP);
  });

  it('does not use innerHTML, eval or inline style attributes', () => {
    expect(runtimeScript).not.toMatch(
      /\.innerHTML|outerHTML|insertAdjacentHTML|\beval\(|new Function/,
    );
    expect(runtimeScript).not.toMatch(/setAttribute\(\s*["']style["']/);
  });
});
