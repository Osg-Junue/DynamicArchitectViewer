import type { SyntaxNode } from '@lezer/common';
import { isBlank, trimWhitespaceEnd } from '../model/text';
import {
  type Animation,
  type CodeBlock,
  type DavDocument,
  type DavGroup,
  type DavNode,
  type DavStep,
  type Direction,
  type LineStyle,
  type StateOverride,
  type StaticLink,
} from '../model/types';
import { type ParsedAttrs, readAttributes, readStringLiteral, type ValidAttr } from './attributes';
import type { Diagnostic, DiagnosticCode, Severity } from './diagnostics';
import { ARROW_SPECS, type AttrOwner, STATE_ATTRIBUTES_BY_TARGET } from './schema';
import {
  type ElementKind,
  type ElementSource,
  rangeOf,
  type SourceMap,
  type SourceRange,
} from './sourceMap';
import { childNodes, parseTree, sliceOf, unescapeCodeFence } from './syntax';

export type { ElementKind, ElementSource, SourceMap, SourceRange } from './sourceMap';
export { findAtOffset } from './sourceMap';

export interface ParseResult {
  document: DavDocument;
  diagnostics: Diagnostic[];
  sourceMap: SourceMap;
}

interface Reference {
  id: string;
  range: SourceRange;
  allowed: ReadonlyArray<ElementKind>;
}

interface PendingStateCheck {
  target: string;
  attrs: ReadonlyMap<string, ValidAttr>;
}

interface ParsedConnection<O extends 'animate' | 'static'> {
  from: string;
  to: string;
  style: LineStyle;
  direction: Direction;
  label?: string;
  attrs: ParsedAttrs<O>;
}

const DEFAULT_ARROW = { style: 'solid', direction: 'forward' } as const;

/** Parses and validates DSL v2 text. Never throws. */
export function parse(text: string): ParseResult {
  return new Analyzer(text).run();
}

/**
 * The text has errors and nothing left to draw. The preview keeps showing the last diagram it
 * could draw, and nothing is exported, so that a broken text never replaces a working picture.
 */
export function hasFatalError({ diagnostics, document }: ParseResult): boolean {
  return (
    diagnostics.some((d) => d.severity === 'error') &&
    document.nodes.length === 0 &&
    document.groups.length === 0
  );
}

class Analyzer {
  private readonly diagnostics: Diagnostic[] = [];
  private readonly elements = new Map<string, ElementSource>();
  private readonly stepRanges: SourceRange[] = [];
  private readonly references: Reference[] = [];
  private readonly stateChecks: PendingStateCheck[] = [];
  private readonly doc: DavDocument = {
    title: '',
    groups: [],
    nodes: [],
    steps: [],
  };
  private titleSeen = false;
  private readonly reportFn = (
    code: DiagnosticCode,
    severity: Severity,
    range: SourceRange,
    args: Record<string, string> = {},
  ): void => {
    this.report(code, severity, range, args);
  };

  constructor(private readonly text: string) {}

  run(): ParseResult {
    const tree = parseTree(this.text);
    const top = tree.topNode;

    this.collectSyntaxErrors(top);

    for (const node of childNodes(top)) {
      switch (node.name) {
        case 'Title':
          this.readTitle(node);
          break;
        case 'Group':
          this.readGroup(node, undefined);
          break;
        case 'Node':
          this.readNode(node, undefined);
          break;
        case 'Step':
          this.readStep(node);
          break;
      }
    }

    if (this.doc.steps.length === 0) {
      this.report('missing-step', 'error', { from: 0, to: 0 });
    }

    this.resolveReferences();

    this.diagnostics.sort((a, b) => a.from - b.from || a.to - b.to);
    return {
      document: this.doc,
      diagnostics: this.diagnostics,
      sourceMap: { elements: this.elements, steps: this.stepRanges },
    };
  }

  // ---------------------------------------------------------------------------
  // Syntax errors
  // ---------------------------------------------------------------------------

  private collectSyntaxErrors(top: SyntaxNode): void {
    const seen = new Set<number>();
    const cursor = top.cursor();
    do {
      if (!cursor.type.isError) continue;
      if (seen.has(cursor.from)) continue;
      seen.add(cursor.from);

      if (cursor.from >= trimWhitespaceEnd(this.text).length) {
        // An EOF error after an earlier syntax error is usually a cascade of it.
        if (seen.size > 1) continue;
        const end = this.text.length;
        this.report('unexpected-eof', 'error', { from: end, to: end });
        continue;
      }
      const token =
        cursor.to > cursor.from
          ? sliceOf(this.text, cursor)
          : (/^\S+/.exec(this.text.slice(cursor.from))?.[0] ?? '');
      const shorten = (text: string) =>
        (text.length > 24 ? `${text.slice(0, 24)}…` : text).split('\n')[0] ?? '';
      // A second string after `code "Title"` on its line: the one-line form was given a title.
      const before = cursor.node.prevSibling;
      const title =
        cursor.node.parent?.name === 'Code' &&
        !cursor.node.parent.getChild('CodeFence') &&
        before?.name === 'String' &&
        token.startsWith('"') &&
        !this.text.slice(before.to, cursor.from).includes('\n')
          ? sliceOf(this.text, before)
          : undefined;
      this.report(
        'syntax-error',
        'error',
        { from: cursor.from, to: Math.max(cursor.to, cursor.from + token.length) },
        title === undefined
          ? { token: shorten(token) }
          : {
              token: shorten(token),
              hint: 'code-title',
              title: `"${shorten(title.slice(1, -1))}"`,
            },
      );
    } while (cursor.next());
  }

  // ---------------------------------------------------------------------------
  // Statements
  // ---------------------------------------------------------------------------

  private readTitle(node: SyntaxNode): void {
    const str = node.getChild('String');
    if (!str) return;
    if (this.titleSeen) {
      this.report('duplicate-title', 'warning', node);
    }
    this.titleSeen = true;
    this.doc.title = this.readString(str);
  }

  private readGroup(node: SyntaxNode, parentId: string | undefined): void {
    const idNode = node.getChild('Identifier');
    if (!idNode) return;
    const id = sliceOf(this.text, idNode);
    const attrs = this.readAttributes(node.getChild('Attributes'), 'group');

    const group: DavGroup = { id, label: this.readChildString(node, 'Label') ?? id };
    if (parentId) group.parentId = parentId;
    const color = attrs.value('color');
    if (color !== undefined) group.color = color;

    const declared = this.declare({
      kind: 'group',
      id,
      from: node.from,
      to: node.to,
      idRange: rangeOf(idNode),
    });
    if (declared) this.doc.groups.push(group);

    const body = node.getChild('GroupBody');
    if (!body) return;
    // Members of a rejected duplicate move up to the enclosing group: the model must stay a tree.
    const memberParent = declared ? id : parentId;
    for (const member of childNodes(body)) {
      if (member.name === 'Group') this.readGroup(member, memberParent);
      else if (member.name === 'Node') this.readNode(member, memberParent);
    }
  }

  private readNode(node: SyntaxNode, parentId: string | undefined): void {
    const idNode = node.getChild('Identifier');
    if (!idNode) return;
    const id = sliceOf(this.text, idNode);
    const attrs = this.readAttributes(node.getChild('Attributes'), 'node');

    const result: DavNode = {
      id,
      label: this.readChildString(node, 'Label') ?? id,
      icon: attrs.value('icon') ?? 'server',
      visible: attrs.value('visible') ?? true,
    };
    if (parentId) result.parentId = parentId;
    const sub = attrs.value('sub');
    if (sub !== undefined) result.sub = sub;
    const badge = attrs.value('badge');
    if (badge !== undefined) result.badge = badge;
    const color = attrs.value('color');
    if (color !== undefined) result.color = color;

    const declared = this.declare({
      kind: 'node',
      id,
      from: node.from,
      to: node.to,
      idRange: rangeOf(idNode),
    });
    if (declared) this.doc.nodes.push(result);
  }

  private readStep(node: SyntaxNode): void {
    const step: DavStep = {
      index: this.doc.steps.length,
      title: this.readChildString(node) ?? '',
      description: '',
      focus: [],
      states: [],
      animations: [],
      statics: [],
    };

    const body = node.getChild('StepBody');
    for (const stmt of body ? childNodes(body) : []) {
      switch (stmt.name) {
        case 'Focus':
          for (const ref of stmt.getChildren('Identifier')) {
            const id = sliceOf(this.text, ref);
            step.focus.push(id);
            this.references.push({ id, range: rangeOf(ref), allowed: ['node', 'group'] });
          }
          break;
        case 'State':
          this.readState(stmt, step);
          break;
        case 'Animate':
          this.readAnimate(stmt, step);
          break;
        case 'Static':
          this.readStatic(stmt, step);
          break;
      }
    }
    step.description = this.readDescList(body).join('\n');

    this.stepRanges.push({ from: node.from, to: node.to });
    this.doc.steps.push(step);
  }

  private readState(stmt: SyntaxNode, step: DavStep): void {
    const targetNode = stmt.getChild('Identifier');
    if (!targetNode) return;
    const target = sliceOf(this.text, targetNode);
    const attrsNode = stmt.getChild('Attributes');
    const attrs = this.readAttributes(attrsNode, 'state');
    if (attrsNode && attrsNode.getChildren('Attribute').length === 0) {
      this.report('empty-state', 'warning', stmt);
    }

    const override: StateOverride = { target };
    const visible = attrs.value('visible');
    if (visible !== undefined) override.visible = visible;
    const badge = attrs.value('badge');
    if (badge !== undefined) override.badge = badge;
    const color = attrs.value('color');
    if (color !== undefined) override.color = color;

    step.states.push(override);
    this.references.push({
      id: target,
      range: rangeOf(targetNode),
      allowed: ['node', 'group'],
    });
    this.stateChecks.push({ target, attrs: attrs.entries });
  }

  private readConnection<O extends 'animate' | 'static'>(
    stmt: SyntaxNode,
    owner: O,
  ): ParsedConnection<O> | undefined {
    const [fromNode, toNode] = stmt.getChildren('Identifier');
    const arrowNode = stmt.getChild('Arrow');
    if (!fromNode || !toNode || !arrowNode) return undefined;

    const from = sliceOf(this.text, fromNode);
    const to = sliceOf(this.text, toNode);
    const arrowText = sliceOf(this.text, arrowNode);
    const arrow = ARROW_SPECS[arrowText] ?? DEFAULT_ARROW;
    if (from === to && arrow.direction === 'bidirectional') {
      this.report('invalid-self-arrow', 'error', arrowNode, {
        arrow: arrowText,
        suggestion: arrow.style === 'dashed' ? '..>' : '-->',
      });
    }

    this.references.push(
      { id: from, range: rangeOf(fromNode), allowed: ['node'] },
      { id: to, range: rangeOf(toNode), allowed: ['node'] },
    );

    const attrs = this.readAttributes(stmt.getChild('Attributes'), owner);
    const label = this.readChildString(stmt, 'EdgeLabel');
    const parsed: ParsedConnection<O> = {
      from,
      to,
      style: arrow.style,
      direction: arrow.direction,
      attrs,
    };
    if (label !== undefined) parsed.label = label;
    return parsed;
  }

  private readStatic(stmt: SyntaxNode, step: DavStep): void {
    const conn = this.readConnection(stmt, 'static');
    if (!conn) return;
    const link: StaticLink = {
      from: conn.from,
      to: conn.to,
      style: conn.style,
      direction: conn.direction,
    };
    if (conn.label !== undefined) link.label = conn.label;
    const color = conn.attrs.value('color');
    if (color !== undefined) link.color = color;
    step.statics.push(link);
  }

  private readAnimate(stmt: SyntaxNode, step: DavStep): void {
    const conn = this.readConnection(stmt, 'animate');
    if (!conn) return;
    const { attrs } = conn;

    const animation: Animation = {
      from: conn.from,
      to: conn.to,
      style: conn.style,
      direction: conn.direction,
      parallel: attrs.value('parallel') ?? false,
    };
    if (conn.label !== undefined) animation.label = conn.label;
    const color = attrs.value('color');
    if (color !== undefined) animation.color = color;
    const icon = attrs.value('icon');
    if (icon !== undefined) animation.icon = icon;

    const descs: string[] = [];
    const attrDesc = attrs.value('desc');
    if (attrDesc !== undefined && attrDesc.length > 0) {
      descs.push(attrDesc);
    }
    const animateBody = stmt.getChild('AnimateBody');
    descs.push(...this.readDescList(animateBody));
    if (descs.length > 0) {
      animation.description = descs.join('\n');
    }

    let codeSeen = false;
    let lastCode: CodeBlock | undefined;
    const attrCode = attrs.get('code');
    if (attrCode !== undefined) {
      codeSeen = true;
      if (!isBlank(attrCode.value)) {
        lastCode = { body: attrCode.value };
      }
    }
    if (animateBody) {
      for (const child of childNodes(animateBody)) {
        if (child.name !== 'Code') continue;
        if (codeSeen) {
          this.report('duplicate-code', 'warning', child);
        }
        codeSeen = true;
        const parsed = this.readCode(child);
        if (parsed !== undefined) {
          lastCode = parsed;
        }
      }
    }
    if (lastCode !== undefined) {
      animation.code = lastCode;
    }

    step.animations.push(animation);
  }

  private readCode(node: SyntaxNode): CodeBlock | undefined {
    const langNode = node.getChild('CodeLang');
    const strNode = node.getChild('String');
    const fenceNode = node.getChild('CodeFence');

    let title: string | undefined;
    let body: string | undefined;

    if (fenceNode) {
      if (strNode) {
        title = this.readString(strNode);
      }
      body = unescapeCodeFence(sliceOf(this.text, fenceNode));
    } else if (strNode) {
      body = this.readString(strNode);
    }

    if (body === undefined || isBlank(body)) {
      return undefined;
    }

    const block: CodeBlock = { body };
    if (langNode) {
      block.lang = sliceOf(this.text, langNode);
    }
    if (title !== undefined) {
      block.title = title;
    }
    return block;
  }

  // ---------------------------------------------------------------------------
  // Shared readers
  // ---------------------------------------------------------------------------

  private readString(node: SyntaxNode): string {
    return readStringLiteral(this.text, node, this.reportFn);
  }

  private readChildString(node: SyntaxNode, wrapper?: string): string | undefined {
    const target = wrapper ? node.getChild(wrapper) : node;
    const str = target?.getChild('String');
    return str ? this.readString(str) : undefined;
  }

  private readDescList(container: SyntaxNode | null): string[] {
    if (!container) return [];
    const out: string[] = [];
    for (const child of childNodes(container)) {
      if (child.name === 'Desc') {
        const desc = this.readChildString(child);
        if (desc !== undefined) out.push(desc);
      }
    }
    return out;
  }

  private readAttributes<O extends AttrOwner>(node: SyntaxNode | null, owner: O): ParsedAttrs<O> {
    return readAttributes(this.text, node, owner, this.reportFn);
  }

  // ---------------------------------------------------------------------------
  // IDs and references
  // ---------------------------------------------------------------------------

  /** Registers an element ID. Returns false (and reports) when the ID is already taken. */
  private declare(source: ElementSource): boolean {
    if (this.elements.has(source.id)) {
      this.report('duplicate-id', 'error', source.idRange ?? source, { id: source.id });
      return false;
    }
    this.elements.set(source.id, source);
    return true;
  }

  private resolveReferences(): void {
    for (const ref of this.references) {
      const target = this.elements.get(ref.id);
      if (!target) {
        this.report('undefined-reference', 'error', ref.range, { id: ref.id });
      } else if (!ref.allowed.includes(target.kind)) {
        this.report('reference-kind-mismatch', 'error', ref.range, {
          id: ref.id,
          actual: target.kind,
          expected: ref.allowed.join('|'),
        });
      }
    }

    for (const check of this.stateChecks) {
      const target = this.elements.get(check.target);
      if (!target) continue;
      const applicable = STATE_ATTRIBUTES_BY_TARGET[target.kind];
      for (const [name, attr] of check.attrs) {
        if (!applicable.has(name)) {
          this.report('attribute-not-applicable', 'warning', attr.node, {
            name,
            kind: target.kind,
          });
        }
      }
    }
  }

  private report(
    code: DiagnosticCode,
    severity: Severity,
    range: SourceRange,
    args: Record<string, string> = {},
  ): void {
    this.diagnostics.push({ code, severity, from: range.from, to: range.to, args });
  }
}
