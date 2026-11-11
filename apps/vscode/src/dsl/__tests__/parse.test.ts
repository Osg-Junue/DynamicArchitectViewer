import { describe, expect, it } from 'vitest';
import { KEYWORD_NAMES } from '../../model/types';
import { SAMPLE_TEMPLATES } from '../../samples';
import {
  type DiagnosticCode,
  formatDiagnostic,
  hasFatalError,
  parse,
  unescapeCodeFence,
} from '../index';

const codes = (text: string) => parse(text).diagnostics.map((d) => d.code);

describe('parse: samples', () => {
  it.each(SAMPLE_TEMPLATES.map((s) => [s.id, s.dsl] as const))(
    '%s parses without diagnostics',
    (_, dsl) => {
      const { document, diagnostics } = parse(dsl);
      expect(diagnostics).toEqual([]);
      expect(document.nodes.length).toBeGreaterThan(0);
      expect(document.edges.length).toBeGreaterThan(0);
      expect(document.steps.length).toBeGreaterThan(0);
    },
  );
});

describe('parse: model', () => {
  const text = `dav 1
title "T \\"quoted\\"\\nline2"

group vpc "VPC" [color: BLUE] {
  node a "A" [icon: database, sub: "s", badge: "B", visible: false, color: teal]
  group sub {
    node b
  }
}
node c "C"

a --> b : "ab"
b ..> c [id: bc, visible: false]
c <-> a
a <.> c

step "First" {
  desc "line1"
  desc "line2"
  focus a, vpc
  state a [badge: "DOWN"]
  state bc [visible: true]
  animate a --> b : "go" [color: red, desc: "send request"]
  animate b --> c [parallel: true] {
    desc "forward to c"
  }
}

step "Second" {}
`;
  const { document: doc, diagnostics, sourceMap } = parse(text);

  it('has no diagnostics', () => {
    expect(diagnostics).toEqual([]);
  });

  it('decodes title escapes', () => {
    expect(doc.version).toBe(1);
    expect(doc.title).toBe('T "quoted"\nline2');
  });

  it('reads nested groups with parent links', () => {
    expect(doc.groups).toEqual([
      {
        id: 'vpc',
        label: 'VPC',
        color: 'blue',
      },
      { id: 'sub', label: 'sub', parentId: 'vpc' },
    ]);
  });

  it('reads node attributes and defaults', () => {
    expect(doc.nodes[0]).toEqual({
      id: 'a',
      label: 'A',
      icon: 'database',
      sub: 's',
      badge: 'B',
      visible: false,
      color: 'teal',
      parentId: 'vpc',
    });
    expect(doc.nodes[1]).toEqual({
      id: 'b',
      label: 'b',
      icon: 'server',
      visible: true,
      parentId: 'sub',
    });
    expect(doc.nodes[2]?.parentId).toBeUndefined();
  });

  it('reads edges with implicit and explicit IDs', () => {
    expect(doc.edges.map((e) => [e.id, e.explicitId, e.style, e.direction, e.visible])).toEqual([
      ['a->b', false, 'solid', 'forward', true],
      ['bc', true, 'dashed', 'forward', false],
      ['c->a', false, 'solid', 'bidirectional', true],
      ['a->c', false, 'dashed', 'bidirectional', true],
    ]);
    expect(doc.edges[0]?.label).toBe('ab');
  });

  it('reads steps', () => {
    const [first, second] = doc.steps;
    expect(first).toEqual({
      index: 0,
      title: 'First',
      description: 'line1\nline2',
      focus: ['a', 'vpc'],
      states: [
        { target: 'a', badge: 'DOWN' },
        { target: 'bc', visible: true },
      ],
      animations: [
        {
          from: 'a',
          to: 'b',
          direction: 'forward',
          label: 'go',
          description: 'send request',
          color: 'red',
          parallel: false,
        },
        {
          from: 'b',
          to: 'c',
          direction: 'forward',
          description: 'forward to c',
          parallel: true,
        },
      ],
    });
    expect(second).toMatchObject({ index: 1, title: 'Second' });
  });

  it('records source ranges', () => {
    const a = sourceMap.elements.get('a');
    expect(a?.kind).toBe('node');
    expect(a?.idRange && text.slice(a.idRange.from, a.idRange.to)).toBe('a');
    expect(sourceMap.elements.get('a->b')?.kind).toBe('edge');
    expect(sourceMap.steps).toHaveLength(2);
  });

  it('accepts a brace on the next line', () => {
    const r = parse('dav 1\ngroup g\n{\n  node n\n}\n');
    expect(r.diagnostics).toEqual([]);
    expect(r.document.nodes[0]?.parentId).toBe('g');
  });
});

describe('hasFatalError', () => {
  it.each([
    ['an error with nothing to draw', 'dav 1\n]', true],
    ['an empty text', '', true],
    ['an error next to something to draw', 'dav 1\nnode a\n]', false],
    ['a group alone with an error', 'dav 1\ngroup g {}\n]', false],
    ['an empty diagram without errors', 'dav 1', false],
  ])('%s', (_name, text, fatal) => {
    expect(hasFatalError(parse(text))).toBe(fatal);
  });
});

describe('parse: diagnostics', () => {
  const cases: Array<[string, string, DiagnosticCode[]]> = [
    ['missing header', 'node a', ['missing-header']],
    ['unsupported version', 'dav 2', ['unsupported-version']],
    ['fractional version equal to 1', 'dav 1.0', ['unsupported-version']],
    ['zero-padded version', 'dav 01', ['unsupported-version']],
    ['duplicate title', 'dav 1\ntitle "a"\ntitle "b"', ['duplicate-title']],
    ['duplicate node id', 'dav 1\nnode a\nnode a', ['duplicate-id']],
    ['id shared across kinds', 'dav 1\nnode a\ngroup a {}', ['duplicate-id']],
    ['duplicate implicit edge', 'dav 1\nnode a\nnode b\na --> b\na ..> b', ['duplicate-edge']],
    ['explicit id resolves duplicate', 'dav 1\nnode a\nnode b\na --> b\na ..> b [id: e2]', []],
    ['undefined edge endpoint', 'dav 1\nnode a\na --> b', ['undefined-reference']],
    ['edge to group', 'dav 1\nnode a\ngroup g {}\na --> g', ['reference-kind-mismatch']],
    ['undefined focus', 'dav 1\nstep "s" { focus x }', ['undefined-reference']],
    ['self-loop', 'dav 1\nnode a\na --> a\na ..> a [id: e2]', []],
    ['bidirectional self-loop', 'dav 1\nnode a\na <-> a', ['invalid-self-arrow']],
    ['dashed bidirectional self-loop', 'dav 1\nnode a\na <.> a', ['invalid-self-arrow']],
    [
      'round trip on a self-loop',
      'dav 1\nnode a\nstep "s" { animate a <-> a }',
      ['invalid-self-arrow'],
    ],
    [
      'focus on an edge',
      'dav 1\nnode a\nnode b\na --> b [id: e]\nstep "s" { focus e }',
      ['reference-kind-mismatch'],
    ],
    [
      'undefined state target',
      'dav 1\nstep "s" { state x [visible: true] }',
      ['undefined-reference'],
    ],
    [
      'animate to group',
      'dav 1\nnode a\ngroup g {}\nstep "s" { animate a --> g }',
      ['reference-kind-mismatch'],
    ],
    ['implicit edge not referable', 'dav 1\nnode a\nnode b\na --> b\nstep "s" { focus a }', []],
    ['unknown attribute', 'dav 1\nnode a [shape: box]', ['unknown-attribute']],
    ['duplicate attribute', 'dav 1\nnode a [sub: "x", sub: "y"]', ['duplicate-attribute']],
    ['string attr type', 'dav 1\nnode a [sub: 1]', ['invalid-attribute-value']],
    ['bool attr type', 'dav 1\nnode a [visible: "no"]', ['invalid-attribute-value']],
    ['removed status attribute', 'dav 1\nnode a [status: active]', ['unknown-attribute']],
    ['unknown icon', 'dav 1\nnode a [icon: databse]', ['unknown-icon']],
    ['invalid color', 'dav 1\nnode a [color: #12345]', ['invalid-color']],
    ['unknown color name', 'dav 1\nnode a [color: yelow]', ['invalid-color']],
    ['color type', 'dav 1\nnode a [color: "red"]', ['invalid-attribute-value']],
    ['invalid escape', 'dav 1\ntitle "a\\qb"', ['invalid-escape']],
    [
      'state attr not applicable',
      'dav 1\nnode a\nnode b\na --> b [id: e]\nstep "s" { state e [badge: "x"] }',
      ['attribute-not-applicable'],
    ],
    ['empty state', 'dav 1\nnode a\nstep "s" { state a [] }', ['empty-state']],
    ['syntax error', 'dav 1\nnode a ]', ['syntax-error']],
    ['unclosed block', 'dav 1\ngroup g {\n  node a\n', ['unexpected-eof']],
    ['hyphen in id', 'dav 1\nnode a-b', ['syntax-error']],
    ['keyword as id', 'dav 1\nnode step', ['syntax-error']],
  ];

  it.each(cases)('%s', (_, text, expected) => {
    expect(codes(text)).toEqual(expected);
  });

  it('suggests the closest icon', () => {
    const [d] = parse('dav 1\nnode a [icon: databse]').diagnostics;
    expect(d && formatDiagnostic(d, 'en')).toBe(
      'Unknown icon "databse" (did you mean "database"?)',
    );
    expect(d && formatDiagnostic(d, 'ja')).toContain('もしかして "database"');
  });

  it('localizes kind names', () => {
    const [d] = parse('dav 1\nnode a\ngroup g {}\na --> g').diagnostics;
    expect(d && formatDiagnostic(d, 'ja')).toBe('"g" はグループです（ノードを指定してください）');
  });

  it('keeps valid content around errors', () => {
    const r = parse('dav 1\nnode a [icon: nope]\nnode b\na --> b');
    expect(r.document.nodes.map((n) => n.icon)).toEqual(['server', 'server']);
    expect(r.document.edges).toHaveLength(1);
  });

  it('points diagnostics at the offending token', () => {
    const text = 'dav 1\nnode a [color: #12345]';
    const [d] = parse(text).diagnostics;
    expect(d && text.slice(d.from, d.to)).toBe('#12345');
  });
});

describe('unescapeCodeFence', () => {
  it('trims single-line fenced blocks and expands tabs', () => {
    expect(unescapeCodeFence('```  { "ok": true }  ```')).toBe('{ "ok": true }');
    expect(unescapeCodeFence('```\thello\t```')).toBe('hello');
    expect(unescapeCodeFence('``````')).toBe('');
    expect(unescapeCodeFence('```  unclosed  ')).toBe('unclosed');
  });

  it('dedents multi-line blocks, normalizes CRLF/tabs, and trims trailing spaces', () => {
    const raw = [
      '```   ',
      '      {   ',
      '\t\t\t\t"id": "ord_1",  ',
      '   ',
      '        "ok": true',
      '      }',
      '    ```',
    ].join('\r\n');
    expect(unescapeCodeFence(raw)).toBe('{\n  "id": "ord_1",\n\n  "ok": true\n}');
  });

  it('preserves single and double backticks inside fenced blocks', () => {
    expect(unescapeCodeFence('```\n  const q = `a` + ``b``;\n```')).toBe('const q = `a` + ``b``;');
  });
});

describe('parse: animate code blocks', () => {
  it('supports all 6 Code forms inside AnimateBody plus [code: "..."] attribute', () => {
    const dsl = `dav 1
node client
node api
client --> api

step "Code forms" {
  animate client --> api {
    desc "with lang and title"
    code json "Order Request" \`\`\`
      {
        "orderId": "ord_1",
        "amount": 4200
      }
    \`\`\`
  }
  animate client --> api {
    code sql \`\`\`
      SELECT * FROM orders
      WHERE id = 1;
    \`\`\`
  }
  animate client --> api {
    code "Payload" \`\`\`
      raw-body
    \`\`\`
  }
  animate client --> api {
    code \`\`\`
      plain-fence
    \`\`\`
  }
  animate client --> api {
    code json "{\\"ok\\": true}"
  }
  animate client --> api {
    code "line1\\nline2"
  }
  animate client --> api [code: "{\\"status\\": 201}"]
}
`;
    const { document, diagnostics } = parse(dsl);
    expect(diagnostics).toEqual([]);
    const anims = document.steps[0]?.animations ?? [];
    expect(anims.map((a) => a.code)).toEqual([
      {
        lang: 'json',
        title: 'Order Request',
        body: '{\n  "orderId": "ord_1",\n  "amount": 4200\n}',
      },
      {
        lang: 'sql',
        body: 'SELECT * FROM orders\nWHERE id = 1;',
      },
      {
        title: 'Payload',
        body: 'raw-body',
      },
      {
        body: 'plain-fence',
      },
      {
        lang: 'json',
        body: '{"ok": true}',
      },
      {
        body: 'line1\nline2',
      },
      {
        body: '{"status": 201}',
      },
    ]);
    expect(anims[0]?.description).toBe('with lang and title');
  });

  it('ignores empty or whitespace-only code blocks so animation.code stays unset', () => {
    const dsl = `dav 1
node a
node b
step "Empty" {
  animate a --> b [code: ""]
  animate a --> b [code: "   \\n\\t "]
  animate a --> b { code "" }
  animate a --> b { code json "  " }
  animate a --> b { code \`\`\`   \`\`\` }
  animate a --> b {
    code json "Header Only" \`\`\`
      
    \`\`\`
  }
}
`;
    const { document, diagnostics } = parse(dsl);
    expect(diagnostics).toEqual([]);
    for (const anim of document.steps[0]?.animations ?? []) {
      expect('code' in anim).toBe(false);
    }
  });

  it('emits duplicate-code warning and keeps the last non-empty code block', () => {
    const both = parse(`dav 1
node a
node b
step "Dup" {
  animate a --> b [code: "attr"] {
    code json "from-body"
  }
  animate a --> b {
    code "first"
    code sql "Title" \`\`\`
      SELECT 1;
    \`\`\`
  }
  animate a --> b [code: "keep-non-empty"] {
    code "   "
  }
}
`);
    expect(both.diagnostics.map((d) => [d.code, d.severity])).toEqual([
      ['duplicate-code', 'warning'],
      ['duplicate-code', 'warning'],
      ['duplicate-code', 'warning'],
    ]);
    const [d] = both.diagnostics;
    expect(d && formatDiagnostic(d, 'ja')).toBe(
      'code は1つの animate に1つだけ指定できます（後の値が使われます）',
    );
    expect(d && formatDiagnostic(d, 'en')).toBe(
      'Only one code block is allowed per animate (the last value wins)',
    );
    expect(both.document.steps[0]?.animations.map((a) => a.code)).toEqual([
      { lang: 'json', body: 'from-body' },
      { lang: 'sql', title: 'Title', body: 'SELECT 1;' },
      { body: 'keep-non-empty' },
    ]);
  });

  it('keeps code unreserved so node code and group code remain valid', () => {
    expect(KEYWORD_NAMES).not.toContain('code');
    const dsl = `dav 1
group code_zone "Zone" {
  node code "Code Service"
}
node api "API"
code --> api : "gRPC"

step "Run" {
  focus code, code_zone
  state code [badge: "v2"]
  animate code --> api [code: "ping"]
  animate api --> code {
    code code "pong"
  }
}
`;
    const { document, diagnostics } = parse(dsl);
    expect(diagnostics).toEqual([]);
    expect(document.nodes.map((n) => n.id)).toEqual(['code', 'api']);
    expect(document.steps[0]?.animations[0]?.from).toBe('code');
    expect(document.steps[0]?.animations[0]?.code).toEqual({ body: 'ping' });
    expect(document.steps[0]?.animations[1]?.to).toBe('code');
    expect(document.steps[0]?.animations[1]?.code).toEqual({ lang: 'code', body: 'pong' });
  });
});
