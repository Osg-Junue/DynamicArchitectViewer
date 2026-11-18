import type { SyntaxNode } from '@lezer/common';
import { trimWhitespaceEnd } from '../model/text';
import { attributeValueNode, childNodes, parseTree, sliceOf, unescapeCodeFence } from './syntax';

const INDENT = '  ';
const CONTAINERS = new Set(['GroupBody', 'StepBody', 'AnimateBody']);
const CONTAINER_BY_STMT: Readonly<Record<string, { body: string; emptySuffix: string }>> = {
  Group: { body: 'GroupBody', emptySuffix: ' {}' },
  Step: { body: 'StepBody', emptySuffix: ' {}' },
  Animate: { body: 'AnimateBody', emptySuffix: '' },
};
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
  'Code',
]);

/**
 * Formats DSL text into canonical layout.
 * Comments, single blank lines and CRLF line endings are preserved.
 * Text with syntax errors is returned unchanged.
 */
export function format(text: string): string {
  const tree = parseTree(text);
  let hasError = false;
  tree.iterate({
    enter: (n) => {
      // A string that runs over a line break is an error too, and its text depends on the
      // line ending and the indentation of the line it goes on to: leave the file as it is.
      if (n.type.isError || (n.name === 'String' && text.slice(n.from, n.to).includes('\n'))) {
        hasError = true;
      }
      return !hasError;
    },
  });
  if (hasError) return text;

  const lines: string[] = [];
  new Printer(text, lines).block(tree.topNode, 0);
  // Keeps the file's line endings, so that formatted CRLF text compares equal to itself.
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return lines.length > 0 ? `${lines.join(eol)}${eol}` : '';
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
      if (node.name === 'Code') {
        this.verbatimCode(node, indent);
      } else {
        this.verbatim(node, indent);
      }
      return;
    }

    if (node.name === 'Code') {
      this.code(node, indent);
      return;
    }

    const container = Object.hasOwn(CONTAINER_BY_STMT, node.name)
      ? CONTAINER_BY_STMT[node.name]
      : undefined;
    if (container) {
      const body = node.getChild(container.body);
      const head = this.inline(node, (c) => !CONTAINERS.has(c.name));
      const hasContent =
        body !== null && childNodes(body).some((c) => c.name !== '{' && c.name !== '}');
      if (!body || !hasContent) {
        this.lines.push(`${indent}${head}${container.emptySuffix}`);
        return;
      }
      this.lines.push(`${indent}${head} {`);
      this.block(body, depth + 1);
      this.lines.push(`${indent}}`);
      return;
    }

    this.lines.push(indent + this.inline(node, () => true));
  }

  /** Renders a statement's tokens on one line with canonical spacing. */
  private inline(node: SyntaxNode, include: (child: SyntaxNode) => boolean): string {
    const parts: string[] = [];
    for (const child of childNodes(node)) {
      if (!include(child)) continue;
      switch (child.name) {
        case 'Attributes':
          parts.push(this.attributes(child));
          break;
        case 'EdgeLabel': {
          const str = child.getChild('String');
          parts.push(`: ${str ? sliceOf(this.text, str) : '""'}`);
          break;
        }
        case 'Label':
          parts.push(sliceOf(this.text, child));
          break;
        case ',': {
          // Focus list separator.
          const prev = parts[parts.length - 1];
          if (prev !== undefined) parts[parts.length - 1] = `${prev},`;
          break;
        }
        default:
          parts.push(sliceOf(this.text, child));
      }
    }
    return parts.join(' ');
  }

  private attributes(node: SyntaxNode): string {
    const items = node.getChildren('Attribute').map((attr) => {
      const name = attr.getChild('AttrName');
      const value = attributeValueNode(attr);
      return `${name ? sliceOf(this.text, name) : ''}: ${value ? sliceOf(this.text, value) : ''}`;
    });
    return `[${items.join(', ')}]`;
  }

  private code(node: SyntaxNode, indent: string): void {
    const langNode = node.getChild('CodeLang');
    const strNode = node.getChild('String');
    const fenceNode = node.getChild('CodeFence');

    const head = ['code'];
    if (langNode) head.push(sliceOf(this.text, langNode));
    if (strNode) head.push(sliceOf(this.text, strNode));

    if (!fenceNode) {
      this.lines.push(`${indent}${head.join(' ')}`);
      return;
    }

    head.push('```');
    this.lines.push(`${indent}${head.join(' ')}`);
    this.fenceBody(fenceNode, indent);
  }

  private verbatimCode(node: SyntaxNode, indent: string): void {
    const fenceNode = node.getChild('CodeFence');
    if (!fenceNode) {
      this.verbatim(node, indent);
      return;
    }
    // All whitespace before the fence but the line break, Unicode spaces included.
    const prefix = sliceOf(this.text, { from: node.from, to: fenceNode.from }).replace(
      /[^\P{White_Space}\n]*$/u,
      '',
    );
    const fenceOnNewLine = prefix.endsWith('\n');
    const headRaw = fenceOnNewLine ? prefix.replace(/\r?\n$/, '') : prefix;
    this.verbatimSpan(headRaw, node.from, indent);
    if (fenceOnNewLine) {
      this.lines.push(`${indent}\`\`\``);
    } else {
      this.appendToLastLine(' ```');
    }
    this.fenceBody(fenceNode, indent);
  }

  private fenceBody(fenceNode: SyntaxNode, indent: string): void {
    const body = unescapeCodeFence(sliceOf(this.text, fenceNode));
    if (body.length > 0) {
      for (const line of body.split('\n')) {
        this.lines.push(line.length > 0 ? `${indent}  ${line}` : '');
      }
    }
    this.lines.push(`${indent}\`\`\``);
  }

  private verbatim(node: SyntaxNode, indent: string): void {
    this.verbatimSpan(sliceOf(this.text, node), node.from, indent, fencesOf(node));
  }

  /**
   * Writes text as it is, indented to its depth. The lines inside a code fence keep their
   * indentation: taking the statement's indentation off a line indented less would change the
   * code, whose own shared indentation is removed when it is read.
   */
  private verbatimSpan(
    rawText: string,
    from: number,
    indent: string,
    fences: ReadonlyArray<{ from: number; to: number }> = [],
  ): void {
    const baseIndent = leadingWhitespace(this.lineAt(from));
    const inFence = (at: number) => fences.some((f) => at > f.from && at < f.to);
    let first = true;
    for (const match of rawText.matchAll(/([^\n]*?)(\r?\n|$)/g)) {
      const line = match[1] ?? '';
      const start = from + (match.index ?? 0);
      // A lone \r is a line break in code, as it is when the code is read; anywhere else it is
      // whitespace and stays inside its line.
      const pieces: string[] = [];
      let cut = 0;
      for (let i = line.indexOf('\r'); i >= 0; i = line.indexOf('\r', i + 1)) {
        if (!inFence(start + i)) continue;
        pieces.push(line.slice(cut, i));
        cut = i + 1;
      }
      const [head = '', ...code] = [...pieces, line.slice(cut)];
      if (first) {
        this.lines.push(indent + trimWhitespaceEnd(head));
        first = false;
      } else if (inFence(start)) {
        this.lines.push(trimWhitespaceEnd(head));
      } else {
        const stripped = trimWhitespaceEnd(
          head.startsWith(baseIndent) ? head.slice(baseIndent.length) : head.trimStart(),
        );
        this.lines.push(stripped ? indent + stripped : '');
      }
      for (const piece of code) this.lines.push(trimWhitespaceEnd(piece));
      if (!match[2]) break;
    }
  }

  private lineAt(pos: number): string {
    const start = this.text.lastIndexOf('\n', pos - 1) + 1;
    const end = this.text.indexOf('\n', pos);
    return this.text.slice(start, end < 0 ? undefined : end);
  }

  private appendToLastLine(suffix: string): void {
    const last = this.lines.length - 1;
    const prev = this.lines[last];
    if (prev !== undefined) this.lines[last] = prev + suffix;
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

/** The code fences inside a statement, at any depth. */
function fencesOf(node: SyntaxNode): Array<{ from: number; to: number }> {
  const fences: Array<{ from: number; to: number }> = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === 'CodeFence') fences.push({ from: child.from, to: child.to });
    else fences.push(...fencesOf(child));
  }
  return fences;
}

function leadingWhitespace(line: string): string {
  return /^\s*/.exec(line)?.[0] ?? '';
}
