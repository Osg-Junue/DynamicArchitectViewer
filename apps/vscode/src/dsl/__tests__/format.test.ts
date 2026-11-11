import { describe, expect, it } from 'vitest';
import { SAMPLE_TEMPLATES } from '../../samples';
import { format, parse } from '../index';

describe('format', () => {
  it('normalizes spacing and indentation', () => {
    const input = `dav   1
title    "T"
group   g "G"   [color:#fff ,  ]   {
node a "A"[icon:server,sub:"x"]
      group inner{
 node b
}
}
a-->b:"L"[ id : e1 ]
step   "S"{
desc "d"
focus a,b
state a[ badge: "x" ]
animate a  -->  b :"x"[parallel:true]
}
`;
    expect(format(input)).toBe(`dav 1
title "T"
group g "G" [color: #fff] {
  node a "A" [icon: server, sub: "x"]
  group inner {
    node b
  }
}
a --> b : "L" [id: e1]
step "S" {
  desc "d"
  focus a, b
  state a [badge: "x"]
  animate a --> b : "x" [parallel: true]
}
`);
  });

  it('preserves comments and collapses blank lines to one', () => {
    const input = `// header comment
dav 1


// nodes
node a   // trailing
group g {
  // inside group
  node b
}



a --> b // edge comment
`;
    expect(format(input)).toBe(`// header comment
dav 1

// nodes
node a // trailing
group g {
  // inside group
  node b
}

a --> b // edge comment
`);
  });

  it('keeps statements containing inner comments verbatim', () => {
    const input = `dav 1
node a [
    icon: server, // why
    sub: "x"
  ]
`;
    const out = format(input);
    expect(out).toContain('// why');
    expect(parse(out).document).toEqual(parse(input).document);
  });

  it('prints empty blocks compactly', () => {
    expect(format('dav 1\ngroup g {\n}\nstep "s" {\n}\n')).toBe('dav 1\ngroup g {}\nstep "s" {}\n');
  });

  it('keeps CRLF line endings, leaving canonical text unchanged', () => {
    const canonical = 'dav 1\r\n\r\n// c\r\nnode a\r\ngroup g {\r\n  node b\r\n}\r\n';
    expect(format(canonical)).toBe(canonical);
    expect(format('dav 1\r\nnode   a\r\n')).toBe('dav 1\r\nnode a\r\n');
  });

  it('returns text with syntax errors unchanged', () => {
    const broken = 'dav 1\nnode a ]\n';
    expect(format(broken)).toBe(broken);
  });

  it('formats all code forms in AnimateBody canonically and idempotently', () => {
    const messy = `dav 1
node a
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
}
`;
    const expected = `dav 1
node a
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
}
`;
    const once = format(messy);
    expect(once).toBe(expected);
    expect(format(once)).toBe(once);
    expect(parse(once).document).toEqual(parse(messy).document);
  });

  it('preserves CRLF line endings inside formatted code fences', () => {
    const crlf = [
      'dav 1',
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
