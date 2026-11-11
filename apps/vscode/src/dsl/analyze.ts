import type { SyntaxNode } from '@lezer/common';
import {
  type Animation,
  type CodeBlock,
  CURRENT_DSL_VERSION,
  type DavDocument,
  type DavEdge,
  type DavGroup,
  type DavNode,
  type DavStep,
  implicitEdgeId,
  type StateOverride,
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

const DEFAULT_ARROW = { style: 'solid', direction: 'forward' } as const;

/** Parses and validates DSL v1 text. Never throws. */
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
    version: CURRENT_DSL_VERSION,
    title: '',
    groups: [],
    nodes: [],
    edges: [],
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

    const header = top.getChild('Header');
    if (header) {
      this.readHeader(header);
    } else {
      this.report('missing-header', 'error', { from: 0, to: 0 });
    }

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
        case 'Edge':
          this.readEdge(node);
          break;
        case 'Step':
          this.readStep(node);
          break;
      }
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

      if (cursor.from >= this.text.trimEnd().length) {
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
      const display = token.length > 24 ? `${token.slice(0, 24)}…` : token;
      this.report(
        'syntax-error',
        'error',
        { from: cursor.from, to: Math.max(cursor.to, cursor.from + token.length) },
        { token: display.split('\n')[0] ?? '' },
      );
    } while (cursor.next());
  }

  // ---------------------------------------------------------------------------
  // Statements
  // ---------------------------------------------------------------------------

  private readHeader(header: SyntaxNode): void {
    const num = header.getChild('Number');
    if (!num) return;
    const written = sliceOf(this.text, num);
    this.doc.version = Number(written);
    // Compared as text: `dav 1.0` equals 1 numerically, but only whole versions exist.
    if (written !== String(CURRENT_DSL_VERSION)) {
      this.report('unsupported-version', 'error', num, { version: written });
    }
  }

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

  private readEdge(node: SyntaxNode): void {
    const ids = node.getChildren('Identifier');
    const arrowNode = node.getChild('Arrow');
    const [fromNode, toNode] = ids;
    if (!fromNode || !toNode || !arrowNode) return;
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
    const attrs = this.readAttributes(node.getChild('Attributes'), 'edge');
    const explicit = attrs.get('id');

    const edge: DavEdge = {
      id: explicit?.value ?? implicitEdgeId(from, to),
      explicitId: explicit !== undefined,
      from,
      to,
      style: arrow.style,
      direction: arrow.direction,
      visible: attrs.value('visible') ?? true,
    };
    const label = this.readChildString(node, 'EdgeLabel');
    if (label !== undefined) edge.label = label;
    const color = attrs.value('color');
    if (color !== undefined) edge.color = color;

    if (explicit) {
      this.declare({
        kind: 'edge',
        id: edge.id,
        from: node.from,
        to: node.to,
        idRange: rangeOf(explicit.node),
      });
    } else if (this.elements.has(edge.id)) {
      this.report('duplicate-edge', 'error', node, { from, to });
    } else {
      this.elements.set(edge.id, { kind: 'edge', id: edge.id, from: node.from, to: node.to });
    }

    this.references.push(
      { id: from, range: rangeOf(fromNode), allowed: ['node'] },
      { id: to, range: rangeOf(toNode), allowed: ['node'] },
    );
    this.doc.edges.push(edge);
  }

  private readStep(node: SyntaxNode): void {
    const step: DavStep = {
      index: this.doc.steps.length,
      title: this.readChildString(node) ?? '',
      description: '',
      focus: [],
      states: [],
      animations: [],
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
      allowed: ['node', 'group', 'edge'],
    });
    this.stateChecks.push({ target, attrs: attrs.entries });
  }

  private readAnimate(stmt: SyntaxNode, step: DavStep): void {
    const [fromNode, toNode] = stmt.getChildren('Identifier');
    const arrowNode = stmt.getChild('Arrow');
    if (!fromNode || !toNode || !arrowNode) return;
    const arrowText = sliceOf(this.text, arrowNode);
    const arrow = ARROW_SPECS[arrowText] ?? DEFAULT_ARROW;
    if (arrow.style === 'dashed') {
      this.report('invalid-animate-arrow', 'error', arrowNode, {
        arrow: arrowText,
        suggestion: arrow.direction === 'bidirectional' ? '<->' : '-->',
      });
    } else if (
      arrow.direction === 'bidirectional' &&
      sliceOf(this.text, fromNode) === sliceOf(this.text, toNode)
    ) {
      this.report('invalid-self-arrow', 'error', arrowNode, {
        arrow: arrowText,
        suggestion: '-->',
      });
    }
    const attrs = this.readAttributes(stmt.getChild('Attributes'), 'animate');

    const animation: Animation = {
      from: sliceOf(this.text, fromNode),
      to: sliceOf(this.text, toNode),
      direction: arrow.direction,
      parallel: attrs.value('parallel') ?? false,
    };
    const label = this.readChildString(stmt, 'EdgeLabel');
    if (label !== undefined) animation.label = label;
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
      if (attrCode.value.trim().length > 0) {
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
    this.references.push(
      { id: animation.from, range: rangeOf(fromNode), allowed: ['node'] },
      { id: animation.to, range: rangeOf(toNode), allowed: ['node'] },
    );
  }

  private readCode(node: SyntaxNode): CodeBlock | undefined {
    const langNode = node.getChild('Identifier');
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

    if (body === undefined || body.trim().length === 0) {
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
