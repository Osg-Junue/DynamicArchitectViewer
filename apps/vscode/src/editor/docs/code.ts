import { KEYWORDS, type ParseResult, parse, parseTree } from '../../dsl';
import { isColorName, isIconName } from '../../model/types';
import { html } from '../../runtime/dom';
import { paint } from '../../scene';

type SyntaxTree = ReturnType<typeof parseTree>;
type TokenKind = 'keyword' | 'string' | 'comment' | 'arrow' | 'attr' | 'color' | 'icon';

interface Token {
  from: number;
  to: number;
  kind: TokenKind;
}

const SIMPLE_TOKENS: Readonly<Record<string, TokenKind>> = {
  String: 'string',
  CodeFence: 'string',
  LineComment: 'comment',
  Arrow: 'arrow',
};

function tokenize(dsl: string, tree: SyntaxTree): Token[] {
  const tokens: Token[] = [];
  tree.iterate({
    enter(node) {
      const { from, to, name } = node;
      if (name === 'AttrName') {
        tokens.push({ from, to, kind: 'attr' });
        return false;
      }
      if (KEYWORDS.has(name) || name === 'code') {
        tokens.push({ from, to, kind: 'keyword' });
        return false;
      }
      const kind = SIMPLE_TOKENS[name];
      if (kind) {
        tokens.push({ from, to, kind });
      } else if (name === 'Identifier' && node.node.parent?.name === 'Attribute') {
        const previous = tokens[tokens.length - 1];
        if (previous?.kind === 'attr') {
          const attrName = dsl.slice(previous.from, previous.to);
          const value = dsl.slice(from, to).toLowerCase();
          if (attrName === 'color' && isColorName(value)) {
            tokens.push({ from, to, kind: 'color' });
          } else if (attrName === 'icon' && isIconName(value)) {
            tokens.push({ from, to, kind: 'icon' });
          }
        }
      }
      return undefined;
    },
  });
  return tokens;
}

function tokenSpan(text: string, kind: TokenKind): HTMLElement {
  const span = html('span', { class: `doc-tok-${kind}` }, text);
  if (kind === 'color') span.style.setProperty('--doc-swatch', paint(text.toLowerCase()));
  return span;
}

/** Renders DSL as one element per source line, with syntax coloring from the real grammar. */
export function renderCodeLines(dsl: string, tree: SyntaxTree = parseTree(dsl)): HTMLElement[] {
  const lines: HTMLElement[] = [];
  let line = html('span', { class: 'doc-line' });
  const flush = () => {
    lines.push(line);
    line = html('span', { class: 'doc-line' });
  };
  const appendText = (from: number, to: number, kind?: TokenKind) => {
    dsl
      .slice(from, to)
      .split('\n')
      .forEach((part, index) => {
        if (index > 0) flush();
        if (part) line.append(kind ? tokenSpan(part, kind) : part);
      });
  };

  let pos = 0;
  for (const token of tokenize(dsl, tree)) {
    appendText(pos, token.from);
    appendText(token.from, token.to, token.kind);
    pos = token.to;
  }
  appendText(pos, dsl.length);
  flush();
  return lines;
}

export function codeBlock(dsl: string): HTMLElement {
  return html('pre', { class: 'doc-code' }, ...renderCodeLines(dsl));
}

export interface StepLines {
  /** Inclusive line range of the `step` statement. */
  from: number;
  to: number;
  /** Line numbers of the `animate` statements of each phase. */
  phases: number[][];
}

/** Maps each step and animation phase to the source lines that declare it. */
export function mapStepLines(
  dsl: string,
  parsed: ParseResult = parse(dsl),
  tree: SyntaxTree = parseTree(dsl),
): StepLines[] {
  const { document, sourceMap } = parsed;
  const lineOf = (offset: number) => dsl.slice(0, offset).split('\n').length - 1;
  const stepNodes = tree.topNode.getChildren('Step');

  return document.steps.map((step, index) => {
    const range = sourceMap.steps[index];
    const animateNodes = stepNodes[index]?.getChild('StepBody')?.getChildren('Animate') ?? [];
    const phases: number[][] = [];
    step.animations.forEach((animation, i) => {
      const node = animateNodes[i];
      if (!node) return;
      const lines: number[] = [];
      for (let l = lineOf(node.from); l <= lineOf(node.to); l++) lines.push(l);
      const current = phases[phases.length - 1];
      if (animation.parallel && current) current.push(...lines);
      else phases.push(lines);
    });
    return {
      from: range ? lineOf(range.from) : 0,
      to: range ? lineOf(range.to) : 0,
      phases,
    };
  });
}
