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
      expect(document.steps.length).toBeGreaterThan(0);
    },
  );
});

describe('parse: model', () => {
  const text = `title "T \\"quoted\\"\\nline2"

group vpc "VPC" [color: BLUE] {
  node a "A" [icon: database, sub: "s", badge: "B", visible: false, color: teal]
  group sub {
    node b
  }
}
node c "C"

step "First" {
  desc "line1"
  desc "line2"
  focus a, vpc
  state a [badge: "DOWN"]
  animate a --> b : "go" [color: red, desc: "send request"]
  animate b ..> c [parallel: true] {
    desc "forward to c"
  }
  static c <.> a : "Sync" [color: teal]
}

step "Second" {}
`;
  const { document: doc, diagnostics, sourceMap } = parse(text);

  it('has no diagnostics', () => {
    expect(diagnostics).toEqual([]);
  });

  it('decodes title escapes', () => {
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

  it('reads steps, animations, and static links', () => {
    const [first, second] = doc.steps;
    expect(first).toEqual({
      index: 0,
      title: 'First',
      description: 'line1\nline2',
      focus: ['a', 'vpc'],
      states: [{ target: 'a', badge: 'DOWN' }],
      animations: [
        {
          from: 'a',
          to: 'b',
          style: 'solid',
          direction: 'forward',
          label: 'go',
          description: 'send request',
          color: 'red',
          parallel: false,
        },
        {
          from: 'b',
          to: 'c',
          style: 'dashed',
          direction: 'forward',
          description: 'forward to c',
          parallel: true,
        },
      ],
      statics: [
        {
          from: 'c',
          to: 'a',
          style: 'dashed',
          direction: 'bidirectional',
          label: 'Sync',
          color: 'teal',
        },
      ],
    });
    expect(second).toMatchObject({ index: 1, title: 'Second' });
  });

  it('records source ranges', () => {
    const a = sourceMap.elements.get('a');
    expect(a?.kind).toBe('node');
    expect(a?.idRange && text.slice(a.idRange.from, a.idRange.to)).toBe('a');
    expect(sourceMap.elements.get('vpc')?.kind).toBe('group');
    expect(sourceMap.steps).toHaveLength(2);
  });

  it('accepts a brace on the next line', () => {
    const r = parse('group g\n{\n  node n\n}\nstep "s" {}\n');
    expect(r.diagnostics).toEqual([]);
    expect(r.document.nodes[0]?.parentId).toBe('g');
  });
});

describe('hasFatalError', () => {
  it.each([
    ['an error with nothing to draw', ']', true],
    ['an empty text', '', true],
    ['an error next to something to draw', 'node a\nstep "s" {}\n]', false],
    ['a node missing a step is still drawable', 'node a\n', false],
    ['a group alone with an error', 'group g {}\nstep "s" {}\n]', false],
    ['a valid step diagram', 'node a\nstep "s" {}', false],
  ])('%s', (_name, text, fatal) => {
    expect(hasFatalError(parse(text))).toBe(fatal);
  });
});

describe('parse: diagnostics', () => {
  const cases: Array<[string, string, DiagnosticCode[]]> = [
    ['missing step', 'node a', ['missing-step']],
    ['top-level edge syntax rejected', 'node a\nnode b\na --> b\nstep "s" {}', ['syntax-error', 'syntax-error', 'syntax-error']],
    ['legacy dav header rejected', 'dav 1\nnode a\nstep "s" {}', ['syntax-error', 'syntax-error']],
    ['duplicate title', 'title "a"\ntitle "b"\nstep "s" {}', ['duplicate-title']],
    ['duplicate node id', 'node a\nnode a\nstep "s" {}', ['duplicate-id']],
    ['id shared across kinds', 'node a\ngroup a {}\nstep "s" {}', ['duplicate-id']],
    ['undefined static endpoint', 'node a\nstep "s" { static a --> b }', ['undefined-reference']],
    ['static to group', 'node a\ngroup g {}\nstep "s" { static a --> g }', ['reference-kind-mismatch']],
    ['undefined focus', 'step "s" { focus x }', ['undefined-reference']],
    ['self-loop in animate and static', 'node a\nstep "s" { animate a --> a\n  static a ..> a }', []],
    [
      'bidirectional self-loop in static',
      'node a\nstep "s" { static a <-> a }',
      ['invalid-self-arrow'],
    ],
    [
      'dashed bidirectional self-loop in static',
      'node a\nstep "s" { static a <.> a }',
      ['invalid-self-arrow'],
    ],
    [
      'round trip on a self-loop',
      'node a\nstep "s" { animate a <-> a }',
      ['invalid-self-arrow'],
    ],
    [
      'dashed round trip on a self-loop',
      'node a\nstep "s" { animate a <.> a }',
      ['invalid-self-arrow'],
    ],
    [
      'undefined state target',
      'step "s" { state x [visible: true] }',
      ['undefined-reference'],
    ],
    [
      'animate to group',
      'node a\ngroup g {}\nstep "s" { animate a --> g }',
      ['reference-kind-mismatch'],
    ],
    ['unknown attribute', 'node a [shape: box]\nstep "s" {}', ['unknown-attribute']],
    ['unknown static attribute', 'node a\nnode b\nstep "s" { static a --> b [parallel: true] }', ['unknown-attribute']],
    ['duplicate attribute', 'node a [sub: "x", sub: "y"]\nstep "s" {}', ['duplicate-attribute']],
    ['string attr type', 'node a [sub: 1]\nstep "s" {}', ['invalid-attribute-value']],
    ['bool attr type', 'node a [visible: "no"]\nstep "s" {}', ['invalid-attribute-value']],
    ['removed status attribute', 'node a [status: active]\nstep "s" {}', ['unknown-attribute']],
    ['unknown icon', 'node a [icon: databse]\nstep "s" {}', ['unknown-icon']],
    ['invalid color', 'node a [color: #12345]\nstep "s" {}', ['invalid-color']],
    ['unknown color name', 'node a [color: yelow]\nstep "s" {}', ['invalid-color']],
    ['color type', 'node a [color: "red"]\nstep "s" {}', ['invalid-attribute-value']],
    ['invalid escape', 'title "a\\qb"\nstep "s" {}', ['invalid-escape']],
    [
      'state attr not applicable on group',
      'group g {}\nstep "s" { state g [badge: "x"] }',
      ['attribute-not-applicable'],
    ],
    ['empty state', 'node a\nstep "s" { state a [] }', ['empty-state']],
    ['syntax error', 'node a ]\nstep "s" {}', ['syntax-error']],
    ['unclosed block', 'group g {\n  node a\n', ['missing-step', 'unexpected-eof']],
    ['hyphen in id', 'node a-b\nstep "s" {}', ['syntax-error', 'syntax-error']],
    ['keyword as id', 'node true\nstep "s" {}', ['syntax-error']],
    ['static keyword reserved', 'node static\nstep "s" {}', ['syntax-error']],
  ];

  it.each(cases)('%s', (_, text, expected) => {
    expect(codes(text)).toEqual(expected);
  });

  it('says that a one-line code takes no title', () => {
    for (const lang of ['json ', 'text ', '']) {
      const text = `node a\nnode b\nstep "s" {\n  animate a --> b : "x" {\n    code ${lang}"Schedule" "0 2 * * *"\n  }\n}\n`;
      const { diagnostics } = parse(text);
      expect(diagnostics.map((d) => d.code)).toEqual(['syntax-error']);
      const [d] = diagnostics;
      expect(d && formatDiagnostic(d, 'en')).toBe(
        'Syntax error: unexpected ""0 2 * * *"". A one-line code takes no title: if "Schedule" is one, remove it, or put the code between lines of ``` to keep it',
      );
      expect(d && formatDiagnostic(d, 'ja')).toContain(
        '1行形式の code にはタイトルを付けられません',
      );
    }
    const [long] = parse(
      'node a\nnode b\nstep "s" {\n  animate a --> b {\n    code "A title much longer than the rest" "x"\n  }\n}\n',
    ).diagnostics;
    expect(long && formatDiagnostic(long, 'en')).toContain('if "A title much longer than…" is one');
    const [dollar] = parse(
      'node a\nnode b\nstep "s" {\n  animate a --> b {\n    code "A$`B$&" "x"\n  }\n}\n',
    ).diagnostics;
    expect(dollar && formatDiagnostic(dollar, 'en')).toContain('if "A$`B$&" is one');
    const [fenced] = parse(
      'node a\nnode b\nstep "s" {\n  animate a --> b {\n    code "T" "x" ```y```\n  }\n}\n',
    ).diagnostics;
    expect(fenced && formatDiagnostic(fenced, 'en')).toContain('Syntax error');
    expect(fenced && formatDiagnostic(fenced, 'en')).not.toContain('takes no title');
    const [own] = parse(
      'node a\nnode b\nstep "s" {\n  animate a --> b {\n    code "x"\n    "The order is stored"\n  }\n}\n',
    ).diagnostics;
    expect(own && formatDiagnostic(own, 'en')).not.toContain('takes no title');
    const [other] = parse('node a ]\nstep "s" {}').diagnostics;
    expect(other && formatDiagnostic(other, 'en')).toBe('Syntax error: unexpected "]"');
  });

  it('suggests the closest icon', () => {
    const [d] = parse('node a [icon: databse]\nstep "s" {}').diagnostics;
    expect(d && formatDiagnostic(d, 'en')).toBe(
      'Unknown icon "databse" (did you mean "database"?)',
    );
    expect(d && formatDiagnostic(d, 'ja')).toContain('もしかして "database"');
  });

  it('localizes kind names', () => {
    const [d] = parse('node a\ngroup g {}\nstep "s" { static a --> g }').diagnostics;
    expect(d && formatDiagnostic(d, 'ja')).toBe('"g" はグループです（ノードを指定してください）');
  });

  it('keeps valid content around errors', () => {
    const r = parse('node a [icon: nope]\nnode b\nstep "s" { static a --> b }');
    expect(r.document.nodes.map((n) => n.icon)).toEqual(['server', 'server']);
    expect(r.document.steps[0]?.statics).toHaveLength(1);
  });

  it('points diagnostics at the offending token', () => {
    const text = 'node a [color: #12345]\nstep "s" {}';
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
    const dsl = `node client
node api

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
    const dsl = `node a
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
    const both = parse(`node a
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
      'code は1つの animate に1つだけ指定できます（空でない最後のものが使われます）',
    );
    expect(d && formatDiagnostic(d, 'en')).toBe(
      'Only one code block is allowed per animate (the last one that is not empty is used)',
    );
    expect(both.document.steps[0]?.animations.map((a) => a.code)).toEqual([
      { lang: 'json', body: 'from-body' },
      { lang: 'sql', title: 'Title', body: 'SELECT 1;' },
      { body: 'keep-non-empty' },
    ]);
  });

  it('keeps code and dav unreserved so node code and node dav remain valid', () => {
    expect(KEYWORD_NAMES).not.toContain('code');
    expect(KEYWORD_NAMES).not.toContain('dav');
    const dsl = `group code_zone "Zone" {
  node code "Code Service"
  node dav "Dav Node"
}
node api "API"

step "Run" {
  focus code, code_zone
  state code [badge: "v2"]
  animate code --> api [code: "ping"]
  animate api --> code {
    code code "pong"
  }
  animate api --> dav {
    code dav "node api"
  }
  static dav ..> api : "Sync"
}
`;
    const { document, diagnostics } = parse(dsl);
    expect(diagnostics).toEqual([]);
    expect(document.nodes.map((n) => n.id)).toEqual(['code', 'dav', 'api']);
    expect(document.steps[0]?.animations[0]?.from).toBe('code');
    expect(document.steps[0]?.animations[0]?.code).toEqual({ body: 'ping' });
    expect(document.steps[0]?.animations[1]?.to).toBe('code');
    expect(document.steps[0]?.animations[1]?.code).toEqual({ lang: 'code', body: 'pong' });
    expect(document.steps[0]?.animations[2]?.code).toEqual({ lang: 'dav', body: 'node api' });
  });
});
