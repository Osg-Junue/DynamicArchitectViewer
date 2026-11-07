import { describe, expect, it } from 'vitest';
import { computeCompletions, findAtOffset, listStepStatements, parse } from '../../dsl';
import { alignRects, computeSnap } from '../canvas/snap';
import { canRedo, canUndo, createHistory, pushHistory, redoHistory, undoHistory } from '../history';

describe('findAtOffset & listStepStatements', () => {
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
    '  state db [status: active]',
    '  animate web --> db "SELECT"',
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

  it('lists step statements in order with statementIndex', () => {
    const stmts = listStepStatements(sample, 0);
    expect(stmts.map((s) => ({ index: s.statementIndex, kind: s.kind }))).toEqual([
      { index: 0, kind: 'desc' },
      { index: 1, kind: 'focus' },
      { index: 2, kind: 'state' },
      { index: 3, kind: 'animate' },
    ]);
  });
});

describe('computeCompletions', () => {
  const dsl = 'dav 1\ngroup vpc "VPC" {\n  node api "API" [icon: apigw]\n}\nnode db "DB"\n';

  it('completes icon names after icon:', () => {
    const text = `${dsl}node x [icon: dat`;
    const res = computeCompletions(text, text.length);
    expect(res?.items.some((i) => i.label === 'database')).toBe(true);
  });

  it('completes status values after status:', () => {
    const text = `${dsl}node x [status: act`;
    const res = computeCompletions(text, text.length);
    expect(res?.items.map((i) => i.label)).toContain('active');
    expect(res?.items.map((i) => i.label)).toContain('error');
  });

  it('completes attribute keys inside brackets', () => {
    const text = `${dsl}node x [`;
    const res = computeCompletions(text, text.length, true);
    expect(res?.items.map((i) => i.label)).toEqual(
      expect.arrayContaining(['icon', 'status', 'badge', 'color']),
    );
  });

  it('completes defined node and group IDs after arrow or focus', () => {
    const text = `${dsl}api --> `;
    const res = computeCompletions(text, text.length, true);
    expect(res?.items.map((i) => i.label)).toEqual(expect.arrayContaining(['api', 'db', 'vpc']));
  });
});

describe('history', () => {
  it('supports undo, redo, and coalescing', () => {
    let h = createHistory('v0', 1000);
    expect(canUndo(h)).toBe(false);

    h = pushHistory(h, 'v1', { coalesceKey: 'drag-1', forceCoalesce: true, now: 1100 });
    h = pushHistory(h, 'v2', { coalesceKey: 'drag-1', forceCoalesce: true, now: 1200 });
    expect(h.present.value).toBe('v2');
    expect(h.past.length).toBe(1);

    h = undoHistory(h);
    expect(h.present.value).toBe('v0');
    expect(canRedo(h)).toBe(true);

    h = redoHistory(h);
    expect(h.present.value).toBe('v2');
  });
});

describe('snap and alignRects', () => {
  it('snaps to alignment guide when within threshold, otherwise grid', () => {
    const other = { x: 100, y: 200, width: 160, height: 80 };
    const moving = { x: 103, y: 54, width: 160, height: 80 };
    const res = computeSnap(moving, [other]);
    expect(res.pos.x).toBe(100);
    expect(res.pos.y).toBe(50);
    expect(res.guides.length).toBe(1);
    expect(res.guides[0]?.axis).toBe('x');
  });

  it('aligns multiple rectangles across all 6 modes', () => {
    const items = [
      { id: 'a', rect: { x: 20, y: 40, width: 100, height: 60 } },
      { id: 'b', rect: { x: 220, y: 140, width: 100, height: 60 } },
    ];
    expect(alignRects(items, 'left').get('b')).toEqual({ x: 20, y: 140 });
    expect(alignRects(items, 'right').get('a')).toEqual({ x: 220, y: 40 });
    expect(alignRects(items, 'center').get('a')).toEqual({ x: 120, y: 40 });
    expect(alignRects(items, 'top').get('b')).toEqual({ x: 220, y: 40 });
    expect(alignRects(items, 'bottom').get('a')).toEqual({ x: 20, y: 140 });
    expect(alignRects(items, 'middle').get('a')).toEqual({ x: 20, y: 90 });
  });
});
