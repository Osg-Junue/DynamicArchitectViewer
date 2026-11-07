import { describe, expect, it } from 'vitest';
import {
  addEdge,
  addGroup,
  addNode,
  addStep,
  applyChanges,
  EditError,
  insertStepStatement,
  moveStep,
  parse,
  removeElement,
  removeStep,
  removeStepStatement,
  renameId,
  replaceStepStatement,
  setAttribute,
  setLabel,
  setPlacement,
  setStepTitle,
  type TextChange,
} from '../index';

const BASE = `dav 1
title "Demo" // title comment

// --- nodes ---
group vpc "VPC" [color: #3b82f6] {
  node api "API" [icon: server] // api comment
  node db "DB" [icon: database, sub: "pg"] @pos(10, 20)
}
node client "Client"

// --- edges ---
client --> api : "HTTPS"
api --> db [id: q]

step one "First" {
  desc "d"
  focus client, api, db
  state db [status: error]
  state q [visible: true]
  animate client --> api : "GET"
  animate api --> db
}

step "Second" {
  focus api
}
`;

function apply(text: string, changes: TextChange[]): string {
  const out = applyChanges(text, changes);
  const { diagnostics } = parse(out);
  expect(diagnostics, out).toEqual([]);
  return out;
}

/** Every comment line of the original must survive unless explicitly deleted. */
function expectCommentsKept(before: string, after: string, except: string[] = []): void {
  const comments = before.match(/\/\/.*$/gm) ?? [];
  for (const c of comments) {
    if (except.some((e) => c.includes(e))) continue;
    expect(after).toContain(c);
  }
}

describe('edit: placement', () => {
  it('inserts @pos without touching anything else', () => {
    const out = apply(BASE, setPlacement(BASE, 'api', { pos: { x: 100.4, y: 200.6 } }));
    expect(out).toContain('node api "API" [icon: server] @pos(100, 201) // api comment');
    expect(out.replace(' @pos(100, 201)', '')).toBe(BASE);
  });

  it('replaces existing @pos and inserts @size after it', () => {
    const out = apply(
      BASE,
      setPlacement(BASE, 'db', { pos: { x: 1, y: 2 }, size: { width: 30, height: 40 } }),
    );
    expect(out).toContain('node db "DB" [icon: database, sub: "pg"] @pos(1, 2) @size(30, 40)');
  });

  it('inserts @pos before an existing @size', () => {
    const text = 'dav 1\nnode a @size(5, 6)\n';
    expect(apply(text, setPlacement(text, 'a', { pos: { x: 1, y: 2 } }))).toBe(
      'dav 1\nnode a @pos(1, 2) @size(5, 6)\n',
    );
  });

  it('places group @pos before the body', () => {
    const out = apply(BASE, setPlacement(BASE, 'vpc', { pos: { x: 5, y: 6 } }));
    expect(out).toContain('group vpc "VPC" [color: #3b82f6] @pos(5, 6) {');
  });

  it('removes placement with null', () => {
    const out = apply(BASE, setPlacement(BASE, 'db', { pos: null }));
    expect(out).toContain('node db "DB" [icon: database, sub: "pg"]\n');
  });
});

describe('edit: attributes and labels', () => {
  it('replaces an existing attribute value', () => {
    const out = apply(BASE, setAttribute(BASE, 'db', 'sub', 'mysql "8"'));
    expect(out).toContain('[icon: database, sub: "mysql \\"8\\""]');
  });

  it('appends an attribute to an existing list', () => {
    const out = apply(BASE, setAttribute(BASE, 'api', 'status', 'active'));
    expect(out).toContain('node api "API" [icon: server, status: active] // api comment');
  });

  it('creates an attribute list after the label', () => {
    const out = apply(BASE, setAttribute(BASE, 'client', 'icon', 'browser'));
    expect(out).toContain('node client "Client" [icon: browser]');
  });

  it('creates an attribute list on an edge after its label', () => {
    const out = apply(BASE, setAttribute(BASE, 'client->api', 'color', '#F00'));
    expect(out).toContain('client --> api : "HTTPS" [color: #f00]');
  });

  it('handles trailing commas and empty lists', () => {
    const t1 = 'dav 1\nnode a [sub: "x",]\n';
    expect(apply(t1, setAttribute(t1, 'a', 'badge', 'B'))).toBe(
      'dav 1\nnode a [sub: "x", badge: "B"]\n',
    );
    const t2 = 'dav 1\nnode a []\n';
    expect(apply(t2, setAttribute(t2, 'a', 'visible', false))).toBe(
      'dav 1\nnode a [visible: false]\n',
    );
  });

  it('removes attributes (middle, last, only)', () => {
    const text = 'dav 1\nnode a [icon: server, sub: "x", badge: "b"]\n';
    expect(apply(text, setAttribute(text, 'a', 'sub', undefined))).toBe(
      'dav 1\nnode a [icon: server, badge: "b"]\n',
    );
    expect(apply(text, setAttribute(text, 'a', 'badge', undefined))).toBe(
      'dav 1\nnode a [icon: server, sub: "x"]\n',
    );
    const only = 'dav 1\nnode a "A" [icon: server] @pos(1, 2)\n';
    expect(apply(only, setAttribute(only, 'a', 'icon', undefined))).toBe(
      'dav 1\nnode a "A" @pos(1, 2)\n',
    );
  });

  it('rejects invalid values', () => {
    expect(() => setAttribute(BASE, 'api', 'icon', 'databse')).toThrow(/did you mean "database"/);
    expect(() => setAttribute(BASE, 'api', 'color', 'red')).toThrow(EditError);
    expect(() => setAttribute(BASE, 'api', 'shape', 'x')).toThrow(EditError);
    expect(() => setAttribute(BASE, 'q', 'id', 'x')).toThrow(/renameId/);
  });

  it('sets, adds and removes labels', () => {
    expect(apply(BASE, setLabel(BASE, 'api', 'Gateway'))).toContain('node api "Gateway"');
    expect(apply(BASE, setLabel(BASE, 'q', 'SQL'))).toContain('api --> db : "SQL" [id: q]');
    expect(apply(BASE, setLabel(BASE, 'client->api', undefined))).toContain('client --> api\n');
    expect(apply(BASE, setLabel(BASE, 'one', 'Primero'))).toContain('step one "Primero" {');
    expect(apply(BASE, setStepTitle(BASE, 1, '2nd'))).toContain('step "2nd" {');
  });
});

describe('edit: adding elements', () => {
  it('adds a node at top level after the last declaration', () => {
    const out = apply(
      BASE,
      addNode(BASE, { id: 'cache', label: 'Cache', attrs: { icon: 'cache' } }),
    );
    expect(out).toContain('node client "Client"\nnode cache "Cache" [icon: cache]\n');
    expectCommentsKept(BASE, out);
  });

  it('adds a node inside a group with matching indentation', () => {
    const out = apply(BASE, addNode(BASE, { id: 'w', parentId: 'vpc', pos: { x: 1, y: 2 } }));
    expect(out).toContain(
      '  node db "DB" [icon: database, sub: "pg"] @pos(10, 20)\n  node w @pos(1, 2)\n}',
    );
  });

  it('adds into an empty inline group body', () => {
    const text = 'dav 1\ngroup g {}\n';
    const withGroup = apply(text, addNode(text, { id: 'a', parentId: 'g' }));
    expect(withGroup).toBe('dav 1\ngroup g {\n  node a\n}\n');
  });

  it('adds nested groups', () => {
    const text = apply(BASE, addGroup(BASE, { id: 'sub', label: 'Subnet', parentId: 'vpc' }));
    const out = apply(text, addNode(text, { id: 'n', parentId: 'sub' }));
    expect(parse(out).document.nodes.find((n) => n.id === 'n')?.parentId).toBe('sub');
    expect(out).toContain('  group sub "Subnet" {\n    node n\n  }\n');
  });

  it('adds an edge after the last edge', () => {
    const out = apply(BASE, addEdge(BASE, { from: 'client', to: 'db', arrow: '-.->', label: 'x' }));
    expect(out).toContain('api --> db [id: q]\nclient -.-> db : "x"\n');
  });

  it('adds to an empty document', () => {
    let text = 'dav 1\n';
    text = apply(text, addNode(text, { id: 'a' }));
    text = apply(text, addNode(text, { id: 'b' }));
    text = apply(text, addEdge(text, { from: 'a', to: 'b' }));
    expect(text).toBe('dav 1\nnode a\nnode b\na --> b\n');
  });

  it('rejects conflicting and invalid IDs', () => {
    expect(() => addNode(BASE, { id: 'api' })).toThrow(EditError);
    expect(() => addNode(BASE, { id: 'q' })).toThrow(EditError);
    expect(() => addNode(BASE, { id: 'bad-id' })).toThrow(EditError);
    expect(() => addNode(BASE, { id: 'step' })).toThrow(EditError);
    expect(() => addEdge(BASE, { from: 'client', to: 'api' })).toThrow(/attrs.id/);
    expect(() => addNode(BASE, { id: 'x', parentId: 'nope' })).toThrow(EditError);
  });
});

describe('edit: removing and renaming', () => {
  it('removes a node with dependent edges and step references', () => {
    const out = apply(BASE, removeElement(BASE, 'db'));
    const doc = parse(out).document;
    expect(doc.nodes.map((n) => n.id)).toEqual(['api', 'client']);
    expect(doc.edges.map((e) => e.id)).toEqual(['client->api']);
    expect(doc.steps[0]?.focus).toEqual(['client', 'api']);
    expect(doc.steps[0]?.states).toEqual([]);
    expect(doc.steps[0]?.animations).toHaveLength(1);
    expectCommentsKept(BASE, out);
  });

  it('removes a group with all descendants', () => {
    const out = apply(BASE, removeElement(BASE, 'vpc'));
    const doc = parse(out).document;
    expect(doc.nodes.map((n) => n.id)).toEqual(['client']);
    expect(doc.edges).toEqual([]);
    expect(doc.steps[0]?.focus).toEqual(['client']);
    expect(doc.steps[1]?.focus).toEqual([]);
    expectCommentsKept(BASE, out, ['api comment']);
  });

  it('removes an explicit edge and its state references', () => {
    const out = apply(BASE, removeElement(BASE, 'q'));
    expect(out).not.toContain('[id: q]');
    expect(out).not.toContain('state q');
    expect(out).toContain('animate api --> db');
  });

  it('removes a step by id', () => {
    const out = apply(BASE, removeElement(BASE, 'one'));
    expect(parse(out).document.steps.map((s) => s.title)).toEqual(['Second']);
  });

  it('renames an ID everywhere it is referenced', () => {
    const out = apply(BASE, renameId(BASE, 'db', 'database'));
    expect(out).not.toMatch(/\bdb\b/);
    expect(out).toContain('focus client, api, database');
    expect(out).toContain('api --> database [id: q]');
  });

  it('renames an explicit edge ID including its attribute', () => {
    const out = apply(BASE, renameId(BASE, 'q', 'query'));
    expect(out).toContain('[id: query]');
    expect(out).toContain('state query [visible: true]');
  });

  it('does not rename attribute values that happen to match', () => {
    const text = 'dav 1\nnode server [icon: server]\n';
    expect(apply(text, renameId(text, 'server', 'srv'))).toBe('dav 1\nnode srv [icon: server]\n');
  });

  it('rejects invalid renames', () => {
    expect(() => renameId(BASE, 'db', 'api')).toThrow(EditError);
    expect(() => renameId(BASE, 'client->api', 'x')).toThrow(EditError);
    expect(() => renameId(BASE, 'nope', 'x')).toThrow(EditError);
  });
});

describe('edit: steps', () => {
  const titles = (text: string) => parse(text).document.steps.map((s) => s.title);

  it('appends a step with statements', () => {
    const out = apply(
      BASE,
      addStep(BASE, {
        id: 'three',
        title: 'Third',
        statements: [
          { kind: 'desc', text: 'hello' },
          { kind: 'focus', ids: ['api', 'db'] },
          { kind: 'state', target: 'db', attrs: { status: 'normal', badge: '' } },
          { kind: 'animate', from: 'api', to: 'db', label: 'x', attrs: { parallel: true } },
        ],
      }),
    );
    expect(titles(out)).toEqual(['First', 'Second', 'Third']);
    expect(
      out.endsWith(
        '\n\nstep three "Third" {\n  desc "hello"\n  focus api, db\n  state db [status: normal, badge: ""]\n  animate api --> db : "x" [parallel: true]\n}\n',
      ),
    ).toBe(true);
  });

  it('inserts a step at an index', () => {
    const out = apply(BASE, addStep(BASE, { title: 'Zero' }, 0));
    expect(titles(out)).toEqual(['Zero', 'First', 'Second']);
    expectCommentsKept(BASE, out);
  });

  it('removes a step by index', () => {
    expect(titles(apply(BASE, removeStep(BASE, 0)))).toEqual(['Second']);
  });

  it('moves steps in both directions', () => {
    const three = apply(BASE, addStep(BASE, { title: 'Third' }));
    expect(titles(apply(three, moveStep(three, 0, 2)))).toEqual(['Second', 'Third', 'First']);
    expect(titles(apply(three, moveStep(three, 2, 0)))).toEqual(['Third', 'First', 'Second']);
    expect(titles(apply(three, moveStep(three, 0, 1)))).toEqual(['Second', 'First', 'Third']);
    const moved = apply(three, moveStep(three, 2, 0));
    expect(moved).not.toMatch(/\n\n\n/);
  });

  it('edits step statements', () => {
    let out = apply(BASE, insertStepStatement(BASE, 1, { kind: 'desc', text: 'new' }));
    expect(out).toContain('step "Second" {\n  focus api\n  desc "new"\n}');
    out = apply(out, replaceStepStatement(out, 1, 0, { kind: 'focus', ids: ['db'] }));
    expect(out).toContain('step "Second" {\n  focus db\n  desc "new"\n}');
    out = apply(out, removeStepStatement(out, 1, 1));
    expect(out).toContain('step "Second" {\n  focus db\n}');
  });

  it('rejects invalid step statements', () => {
    expect(() => insertStepStatement(BASE, 0, { kind: 'focus', ids: [] })).toThrow(EditError);
    expect(() => insertStepStatement(BASE, 0, { kind: 'state', target: 'db', attrs: {} })).toThrow(
      EditError,
    );
    expect(() => insertStepStatement(BASE, 9, { kind: 'desc', text: '' })).toThrow(EditError);
  });
});

describe('edit: line endings', () => {
  it('preserves CRLF', () => {
    const crlf = BASE.replace(/\n/g, '\r\n');
    const out = apply(crlf, addNode(crlf, { id: 'x', parentId: 'vpc' }));
    expect(out.replace(/\r\n/g, '')).not.toContain('\n');
  });
});
