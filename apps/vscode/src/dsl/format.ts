import type { SyntaxNode } from '@lezer/common';
import { childNodes, parseTree, sliceOf } from './syntax';

const INDENT = '  ';
const CONTAINERS = new Set(['GroupBody', 'StepBody']);
const STATEMENTS = new Set([
  'Header',
  'Title',
  'Group',
  'Node',
  'Edge',
  'Step',
  'Desc',
  'Focus',
  'State',
  'Animate',
]);

/**
 * Formats DSL text into canonical layout (see spec §7).
 * Comments and single blank lines are preserved. Text with syntax errors is returned unchanged.
 */
export function format(text: string): string {
  const tree = parseTree(text);
  let hasError = false;
  tree.iterate({
    enter: (n) => {
      if (n.type.isError) hasError = true;
      return !hasError;
    },
  });
  if (hasError) return text;

  const lines: string[] = [];
  new Printer(text, lines).block(tree.topNode, 0);
  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

class Printer {
  constructor(
    private readonly text: string,
    private readonly lines: string[],
  ) {}

  /** Prints statements and comments of a container node at the given depth. */
  block(container: SyntaxNode, depth: number): void {
    const indent = INDENT.repeat(depth);
    let prevEnd = -1;
    let first = true;

    for (const item of childNodes(container)) {
      const isComment = item.name === 'LineComment';
      if (!isComment && !STATEMENTS.has(item.name)) continue;

      const gap = prevEnd >= 0 ? this.text.slice(prevEnd, item.from) : '';
      const newlines = countNewlines(gap);

      if (isComment && prevEnd >= 0 && newlines === 0) {
        // Trailing comment on the same line as the previous statement.
        this.appendToLastLine(` ${sliceOf(this.text, item).trimEnd()}`);
      } else {
        if (!first && newlines >= 2) this.lines.push('');
        if (isComment) {
          this.lines.push(indent + sliceOf(this.text, item).trimEnd());
        } else {
          this.statement(item, depth);
        }
      }
      prevEnd = item.to;
      first = false;
    }
  }

  private statement(node: SyntaxNode, depth: number): void {
    const indent = INDENT.repeat(depth);

    // Comments inside a statement cannot be relocated safely: keep its original text.
    if (containsComment(node)) {
      this.verbatim(node, indent);
      return;
    }

    switch (node.name) {
      case 'Group':
      case 'Step': {
        const body = node.getChild(node.name === 'Group' ? 'GroupBody' : 'StepBody');
        const head = this.inline(node, (c) => !CONTAINERS.has(c.name));
        const hasContent =
          body !== null && childNodes(body).some((c) => c.name !== '{' && c.name !== '}');
        if (!body || !hasContent) {
          this.lines.push(`${indent}${head} {}`);
          return;
        }
        this.lines.push(`${indent}${head} {`);
        this.block(body, depth + 1);
        this.lines.push(`${indent}}`);
        return;
      }
      default:
        this.lines.push(indent + this.inline(node, () => true));
    }
  }

  /** Renders a statement's tokens on one line with canonical spacing. */
  private inline(node: SyntaxNode, include: (child: SyntaxNode) => boolean): string {
    const parts: string[] = [];
    const placements: string[] = [];
    for (const child of childNodes(node)) {
      if (!include(child)) continue;
      switch (child.name) {
        case 'Attributes':
          parts.push(this.attributes(child));
          break;
        case 'Pos':
        case 'Size':
          placements.push(this.placement(child));
          break;
        case 'EdgeLabel': {
          const str = child.getChild('String');
          parts.push(`: ${str ? sliceOf(this.text, str) : '""'}`);
          break;
        }
        case 'Label':
          parts.push(sliceOf(this.text, child));
          break;
        case ',':
          // Focus list separator.
          parts[parts.length - 1] += ',';
          break;
        default:
          parts.push(sliceOf(this.text, child));
      }
    }
    // Canonical order: @pos before @size.
    placements.sort((a, b) => Number(a.startsWith('@size')) - Number(b.startsWith('@size')));
    return [...parts, ...placements].join(' ');
  }

  private attributes(node: SyntaxNode): string {
    const items = node.getChildren('Attribute').map((attr) => {
      const name = attr.getChild('AttrName');
      const value = childNodes(attr).find((c) => c.name !== 'AttrName' && c.name !== ':');
      return `${name ? sliceOf(this.text, name) : ''}: ${value ? sliceOf(this.text, value) : ''}`;
    });
    return `[${items.join(', ')}]`;
  }

  private placement(node: SyntaxNode): string {
    const nums = node.getChildren('Number').map((n) => sliceOf(this.text, n));
    const keyword = node.name === 'Pos' ? '@pos' : '@size';
    return `${keyword}(${nums.join(', ')})`;
  }

  private verbatim(node: SyntaxNode, indent: string): void {
    const raw = sliceOf(this.text, node).split(/\r?\n/);
    const baseIndent = leadingWhitespace(this.lineAt(node.from));
    raw.forEach((line, i) => {
      if (i === 0) {
        this.lines.push(indent + line.trimEnd());
      } else {
        const stripped = line.startsWith(baseIndent)
          ? line.slice(baseIndent.length)
          : line.trimStart();
        this.lines.push(indent + stripped.trimEnd());
      }
    });
  }

  private lineAt(pos: number): string {
    const start = this.text.lastIndexOf('\n', pos - 1) + 1;
    const end = this.text.indexOf('\n', pos);
    return this.text.slice(start, end < 0 ? undefined : end);
  }

  private appendToLastLine(suffix: string): void {
    const last = this.lines.length - 1;
    if (last >= 0) this.lines[last] += suffix;
    else this.lines.push(suffix.trimStart());
  }
}

function containsComment(node: SyntaxNode): boolean {
  for (const child of childNodes(node)) {
    if (child.name === 'LineComment') return true;
    // Comments inside nested blocks are handled by block().
    if (!CONTAINERS.has(child.name) && containsComment(child)) return true;
  }
  return false;
}

function countNewlines(s: string): number {
  let n = 0;
  for (const ch of s) if (ch === '\n') n++;
  return n;
}

function leadingWhitespace(line: string): string {
  return /^\s*/.exec(line)?.[0] ?? '';
}
