import { describe, expect, it } from 'vitest';
import { SAMPLE_TEMPLATES } from '../../samples';
import { format, parse } from '../index';

describe('format', () => {
  it('normalizes spacing and indentation', () => {
    const input = `title    "T"
group   g "G"   [color:#fff ,  ]   {
node a "A"[icon:server,sub:"x"]
      group inner{
 node b
}
}
step   "S"{
desc "d"
focus a,b
state a[ badge: "x" ]
animate a  ..>  b :"x"[parallel:true]
static b  <.>  a :"sync"[color:teal]
}
`;
    expect(format(input)).toBe(`title "T"
group g "G" [color: #fff] {
  node a "A" [icon: server, sub: "x"]
  group inner {
    node b
  }
}
step "S" {
  desc "d"
  focus a, b
  state a [badge: "x"]
  animate a ..> b : "x" [parallel: true]
  static b <.> a : "sync" [color: teal]
}
`);
  });

  it('preserves comments and collapses blank lines to one', () => {
    const input = `// header comment
title "T"


// nodes
node a   // trailing
group g {
  // inside group
  node b
}



step "s" {
  animate a --> b // animate comment
}
`;
    expect(format(input)).toBe(`// header comment
title "T"

// nodes
node a // trailing
group g {
  // inside group
  node b
}

step "s" {
  animate a --> b // animate comment
}
`);
  });

  it('keeps statements containing inner comments verbatim', () => {
    const input = `node a [
    icon: server, // why
    sub: "x"
  ]
step "s" {}
`;
    const out = format(input);
    expect(out).toContain('// why');
    expect(parse(out).document).toEqual(parse(input).document);
  });

  it('keeps the code of a statement it keeps as written', () => {
    // A comment before the `{` keeps the animate as written. The code fence in it is indented
    // less than the animate, and must keep the indentation of its lines relative to each other.
    const input = [
      'node a',
      'node b',
      'step "S" {',
      '  animate a --> b : "x" // note',
      '  {',
      '    code json ```',
      '{',
      '  "a": 1',
      '}',
      '```',
      '  }',
      '}',
      '',
    ].join('\n');
    const out = format(input);
    expect(parse(out).document).toEqual(parse(input).document);
    expect(parse(out).document.steps[0]?.animations[0]?.code?.body).toBe('{\n  "a": 1\n}');
    expect(format(out)).toBe(out);
  });

  it('keeps every word of a statement it keeps as written, a lone CR in it included', () => {
    const input = 'node a\r[ // c\ncolor: red]\nnode b\nstep "s" {}\n';
    const out = format(input);
    expect(out).toContain('node a');
    expect(parse(out).document).toEqual(parse(input).document);
  });

  it('keeps statements it keeps as written free of trailing spaces, and their meaning', () => {
    const blank =
      'node a\nnode b\nstep "S" {\n  animate a --> b // c\n  {\n\n    desc "d"\n  }\n}\n';
    expect(format(blank)).not.toMatch(/ +\n/);
    // In code, a lone CR is a line break: the blank line it makes stays.
    const cr =
      'node a\nnode b\nstep "S" {\n  animate a --> b // c\n  {\n    code ```\na\r   \nb\n```\n  }\n}\n';
    expect(parse(format(cr)).document).toEqual(parse(cr).document);
    // Unicode spaces before a fence on its own line: the same text on a second run.
    for (const space of ['\u00a0', '\u0085']) {
      const text = `node a\nnode b\nstep "S" {\n  animate a --> b {\n    code json // c\n${space}\`\`\`\n{}\n\`\`\`\n  }\n}\n`;
      expect(format(format(text))).toBe(format(text));
    }
    // A lone CR in code is a line break on the line that opens the fence too, and whitespace is
    // the language's: U+FEFF at the end of a line of code is kept.
    for (const fence of ['```x\r   \ny\n```', '```\r \n  y\n```', '```\nx\ufeff\n```']) {
      const text = `node a\nnode b\nstep "S" {\n  animate a --> b // c\n  {\n    code ${fence}\n  }\n}\n`;
      expect(parse(format(text)).document).toEqual(parse(text).document);
      expect(format(format(text))).toBe(format(text));
    }
    // After the fence on its closing line, a lone CR is no line end, even where it ends a comment.
    for (const after of ['\r}\n', '\r// t\n  }\n', ' // c\r}\n  }\n']) {
      const text = `node a\nnode b\nstep "S" {\n  animate a --> b // c\n  {\n    code \`\`\`\n      x\n    \`\`\`${after}}\n`;
      expect(parse(format(text)).document).toEqual(parse(text).document);
      expect(format(format(text))).toBe(format(text));
    }
    // A string that runs over a line break is left as it is: re-indenting the line it goes on
    // to would change its text.
    const string = 'group g {\n    node a [ // c\n      sub: "x\\\ny"]\n}\nstep "s" {}\n';
    expect(format(string)).toBe(string);
  });

  it('prints empty blocks compactly', () => {
    expect(format('group g {\n}\nstep "s" {\n}\n')).toBe('group g {}\nstep "s" {}\n');
  });

  it('keeps CRLF line endings, leaving canonical text unchanged', () => {
    const canonical = '// c\r\nnode a\r\ngroup g {\r\n  node b\r\n}\r\nstep "s" {}\r\n';
    expect(format(canonical)).toBe(canonical);
    expect(format('node   a\r\nstep "s" {}\r\n')).toBe('node a\r\nstep "s" {}\r\n');
  });

  it('returns text with syntax errors unchanged', () => {
    const broken = 'node a ]\nstep "s" {}\n';
    expect(format(broken)).toBe(broken);
  });

  it('formats all code forms in AnimateBody canonically and idempotently', () => {
    const messy = `node a
node b
step "S" {
  animate a --> b {
    desc   "send"
    code   json   "Order Request"   \`\`\`
          {
            "id": 1,

            "ok": true
          }
        \`\`\`
  }
  animate a --> b {
    code sql \`\`\` SELECT 1; \`\`\`
  }
  animate a --> b {
    code   "Title"   \`\`\`
      body
    \`\`\`
  }
  animate a --> b {
    code \`\`\`
      raw
    \`\`\`
  }
  animate a --> b {
    code   json   "{\\"a\\":1}"
  }
  animate a --> b {
    code   "plain"
  }
  animate a --> b {
    code   dav   ".dav Source"   \`\`\`
      node api "Order API" [icon: api]
    \`\`\`
  }
}
`;
    const expected = `node a
node b
step "S" {
  animate a --> b {
    desc "send"
    code json "Order Request" \`\`\`
      {
        "id": 1,

        "ok": true
      }
    \`\`\`
  }
  animate a --> b {
    code sql \`\`\`
      SELECT 1;
    \`\`\`
  }
  animate a --> b {
    code "Title" \`\`\`
      body
    \`\`\`
  }
  animate a --> b {
    code \`\`\`
      raw
    \`\`\`
  }
  animate a --> b {
    code json "{\\"a\\":1}"
  }
  animate a --> b {
    code "plain"
  }
  animate a --> b {
    code dav ".dav Source" \`\`\`
      node api "Order API" [icon: api]
    \`\`\`
  }
}
`;
    const once = format(messy);
    expect(once).toBe(expected);
    expect(format(once)).toBe(once);
    expect(parse(once).document).toEqual(parse(messy).document);
  });

  it('preserves CRLF line endings inside formatted code fences', () => {
    const crlf = [
      'node a',
      'node b',
      'step "S" {',
      '  animate a --> b {',
      '    code json "Req" ```',
      '      {',
      '        "ok": true',
      '      }',
      '    ```',
      '  }',
      '}',
      '',
    ].join('\r\n');
    expect(format(crlf)).toBe(crlf);
    expect(parse(crlf).document.steps[0]?.animations[0]?.code).toEqual({
      lang: 'json',
      title: 'Req',
      body: '{\n  "ok": true\n}',
    });
  });

  it.each(SAMPLE_TEMPLATES.map((s) => [s.id, s.dsl] as const))(
    '%s: is idempotent and preserves semantics',
    (_, dsl) => {
      const once = format(dsl);
      expect(format(once)).toBe(once);
      expect(parse(once).document).toEqual(parse(dsl).document);
    },
  );
});
