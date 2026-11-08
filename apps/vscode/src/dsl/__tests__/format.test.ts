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

  it('returns text with syntax errors unchanged', () => {
    const broken = 'dav 1\nnode a ]\n';
    expect(format(broken)).toBe(broken);
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
