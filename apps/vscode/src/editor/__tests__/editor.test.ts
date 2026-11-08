import { describe, expect, it } from 'vitest';
import { computeCompletions, findAtOffset, parse } from '../../dsl';

describe('findAtOffset', () => {
  const sample = [
    'dav 1',
    'group vpc "VPC" {',
    '  node web "Web" [icon: server]',
    '}',
    'node db "DB" [icon: database]',
    'web --> db : "SQL"',
    'step "Step 1" {',
    '  desc "Query"',
    '  focus web, db',
    '  state db [badge: "x"]',
    '  animate web --> db : "SELECT"',
    '}',
  ].join('\n');

  it('locates innermost element and step at offset', () => {
    const { sourceMap } = parse(sample);
    const webPos = sample.indexOf('node web') + 5;
    expect(findAtOffset(sourceMap, webPos)).toEqual({
      elementId: 'web',
      stepIndex: null,
    });

    const vpcPos = sample.indexOf('group vpc') + 6;
    expect(findAtOffset(sourceMap, vpcPos)).toEqual({
      elementId: 'vpc',
      stepIndex: null,
    });

    const stepPos = sample.indexOf('animate web') + 4;
    expect(findAtOffset(sourceMap, stepPos)).toEqual({
      elementId: null,
      stepIndex: 0,
    });
  });
});

describe('computeCompletions', () => {
  const dsl = 'dav 1\ngroup vpc "VPC" {\n  node api "API" [icon: router]\n}\nnode db "DB"\n';

  it('completes icon names after icon:', () => {
    const text = `${dsl}node x [icon: dat`;
    const res = computeCompletions(text, text.length);
    expect(res?.items.some((i) => i.label === 'database')).toBe(true);
  });

  it('completes color names after color:', () => {
    const text = `${dsl}node x [color: ye`;
    const res = computeCompletions(text, text.length);
    expect(res?.items.map((i) => i.label)).toContain('yellow');
  });

  it('completes attribute keys inside brackets', () => {
    const text = `${dsl}node x [`;
    const res = computeCompletions(text, text.length, true);
    expect(res?.items.map((i) => i.label)).toEqual(
      expect.arrayContaining(['icon', 'badge', 'color']),
    );
  });

  it('completes defined node and group IDs after arrow or focus', () => {
    const text = `${dsl}api --> `;
    const res = computeCompletions(text, text.length, true);
    expect(res?.items.map((i) => i.label)).toEqual(expect.arrayContaining(['api', 'db', 'vpc']));
  });
});
