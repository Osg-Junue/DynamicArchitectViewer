import type { SyntaxNode } from '@lezer/common';
import {
  type Animation,
  COLOR_NAMES,
  COLOR_RESET,
  CURRENT_DSL_VERSION,
  type DavDocument,
  type DavEdge,
  type DavGroup,
  type DavNode,
  type DavStep,
  type Direction,
  ICON_NAMES,
  type IconName,
  implicitEdgeId,
  type LineStyle,
  type StateOverride,
} from '../model/types';
import type { Diagnostic, DiagnosticCode, Severity } from './diagnostics';
import {
  ATTRIBUTE_SCHEMA,
  type AttrOwner,
  type AttrType,
  STATE_ATTRIBUTES_BY_TARGET,
} from './schema';
import { childNodes, parseTree, sliceOf, unescapeString } from './syntax';

export type ElementKind = 'node' | 'group' | 'edge';

export interface SourceRange {
  from: number;
  to: number;
}

export interface ElementSource extends SourceRange {
  kind: ElementKind;
  id: string;
  /** Range of the identifier token (absent for implicit edge IDs). */
  idRange?: SourceRange;
}

export interface SourceMap {
  /** Keyed by element ID (implicit edge IDs use `from->to`). First declaration wins. */
  elements: ReadonlyMap<string, ElementSource>;
  /** Statement range for each step, by index. */
  steps: readonly SourceRange[];
}

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
  attrs: Map<string, ValidAttr>;
}

interface ValidAttr {
  value: string | boolean;
  node: SyntaxNode;
}

const ARROWS: Record<string, { style: LineStyle; direction: Direction }> = {
  '-->': { style: 'solid', direction: 'forward' },
  '..>': { style: 'dashed', direction: 'forward' },
  '<->': { style: 'solid', direction: 'bidirectional' },
  '<.>': { style: 'dashed', direction: 'bidirectional' },
};

const DEFAULT_ARROW = { style: 'solid', direction: 'forward' } as const;

const VALUE_NODE_NAMES = new Set(['String', 'Number', 'Color', 'Identifier', 'Boolean']);

const EXPECTED_BY_TYPE: Record<AttrType, string> = {
  string: '"..."',
  bool: 'true | false',
  color: COLOR_NAMES.join(' | '),
  stateColor: [...COLOR_NAMES, COLOR_RESET].join(' | '),
  icon: ICON_NAMES.join(' | '),
  ident: 'identifier',
};

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

    const group: DavGroup = { id, label: this.readLabel(node) ?? id };
    if (parentId) group.parentId = parentId;
    const color = attrs.get('color')?.value;
    if (typeof color === 'string') group.color = color;

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
      label: this.readLabel(node) ?? id,
      icon: (attrs.get('icon')?.value as IconName | undefined) ?? 'server',
      visible: (attrs.get('visible')?.value as boolean | undefined) ?? true,
    };
    if (parentId) result.parentId = parentId;
    assignString(result, 'sub', attrs);
    assignString(result, 'badge', attrs);
    assignString(result, 'color', attrs);

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
    const arrow = ARROWS[arrowText] ?? DEFAULT_ARROW;
    if (from === to && arrow.direction === 'bidirectional') {
      this.report('invalid-self-arrow', 'error', arrowNode, {
        arrow: arrowText,
        suggestion: arrow.style === 'dashed' ? '..>' : '-->',
      });
    }
    const attrs = this.readAttributes(node.getChild('Attributes'), 'edge');
    const explicit = attrs.get('id');

    const edge: DavEdge = {
      id: typeof explicit?.value === 'string' ? explicit.value : implicitEdgeId(from, to),
      explicitId: explicit !== undefined,
      from,
      to,
      style: arrow.style,
      direction: arrow.direction,
      visible: (attrs.get('visible')?.value as boolean | undefined) ?? true,
    };
    const label = this.readEdgeLabel(node);
    if (label !== undefined) edge.label = label;
    assignString(edge, 'color', attrs);

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
    const titleNode = node.getChild('String');
    const step: DavStep = {
      index: this.doc.steps.length,
      title: titleNode ? this.readString(titleNode) : '',
      description: '',
      focus: [],
      states: [],
      animations: [],
    };

    const descriptions: string[] = [];
    const body = node.getChild('StepBody');
    for (const stmt of body ? childNodes(body) : []) {
      switch (stmt.name) {
        case 'Desc': {
          const str = stmt.getChild('String');
          if (str) descriptions.push(this.readString(str));
          break;
        }
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
    step.description = descriptions.join('\n');

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
    const visible = attrs.get('visible')?.value;
    if (typeof visible === 'boolean') override.visible = visible;
    assignString(override, 'badge', attrs);
    assignString(override, 'color', attrs);

    step.states.push(override);
    this.references.push({
      id: target,
      range: rangeOf(targetNode),
      allowed: ['node', 'group', 'edge'],
    });
    this.stateChecks.push({ target, attrs });
  }

  private readAnimate(stmt: SyntaxNode, step: DavStep): void {
    const [fromNode, toNode] = stmt.getChildren('Identifier');
    const arrowNode = stmt.getChild('Arrow');
    if (!fromNode || !toNode || !arrowNode) return;
    const arrowText = sliceOf(this.text, arrowNode);
    const arrow = ARROWS[arrowText] ?? DEFAULT_ARROW;
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
      parallel: (attrs.get('parallel')?.value as boolean | undefined) ?? false,
    };
    const label = this.readEdgeLabel(stmt);
    if (label !== undefined) animation.label = label;
    assignString(animation, 'color', attrs);
    const icon = attrs.get('icon')?.value as IconName | undefined;
    if (icon !== undefined) animation.icon = icon;

    const descs: string[] = [];
    const attrDesc = attrs.get('desc')?.value;
    if (typeof attrDesc === 'string' && attrDesc.length > 0) {
      descs.push(attrDesc);
    }
    const body = stmt.getChild('AnimateBody');
    if (body) {
      for (const child of childNodes(body)) {
        if (child.name === 'Desc') {
          const str = child.getChild('String');
          if (str) descs.push(this.readString(str));
        }
      }
    }
    if (descs.length > 0) {
      animation.description = descs.join('\n');
    }

    step.animations.push(animation);
    this.references.push(
      { id: animation.from, range: rangeOf(fromNode), allowed: ['node'] },
      { id: animation.to, range: rangeOf(toNode), allowed: ['node'] },
    );
  }

  // ---------------------------------------------------------------------------
  // Shared readers
  // ---------------------------------------------------------------------------

  private readString(node: SyntaxNode): string {
    const { value, invalid } = unescapeString(sliceOf(this.text, node));
    for (const esc of invalid) {
      const from = node.from + esc.offset;
      this.report(
        'invalid-escape',
        'error',
        { from, to: from + esc.sequence.length },
        { sequence: esc.sequence },
      );
    }
    return value;
  }

  private readLabel(node: SyntaxNode): string | undefined {
    const str = node.getChild('Label')?.getChild('String');
    return str ? this.readString(str) : undefined;
  }

  private readEdgeLabel(node: SyntaxNode): string | undefined {
    const str = node.getChild('EdgeLabel')?.getChild('String');
    return str ? this.readString(str) : undefined;
  }

  /** Reads and validates an attribute list. Invalid entries are reported and omitted. */
  private readAttributes(node: SyntaxNode | null, owner: AttrOwner): Map<string, ValidAttr> {
    const result = new Map<string, ValidAttr>();
    if (!node) return result;
    const schema = ATTRIBUTE_SCHEMA[owner];
    const seen = new Set<string>();

    for (const attr of node.getChildren('Attribute')) {
      const nameNode = attr.getChild('AttrName');
      const valueNode = childNodes(attr).find((c) => VALUE_NODE_NAMES.has(c.name));
      if (!nameNode || !valueNode) continue;
      const name = sliceOf(this.text, nameNode);

      const type = Object.hasOwn(schema, name) ? schema[name] : undefined;
      if (!type) {
        this.report('unknown-attribute', 'warning', nameNode, { name, owner });
        continue;
      }
      if (seen.has(name)) {
        this.report('duplicate-attribute', 'warning', nameNode, { name });
      }
      seen.add(name);

      const value = this.convertValue(name, type, valueNode);
      if (value !== undefined) result.set(name, { value, node: valueNode });
    }
    return result;
  }

  private convertValue(
    name: string,
    type: AttrType,
    node: SyntaxNode,
  ): string | boolean | undefined {
    const raw = sliceOf(this.text, node);
    const invalid = () => {
      this.report('invalid-attribute-value', 'error', node, {
        name,
        expected: EXPECTED_BY_TYPE[type],
      });
      return undefined;
    };

    switch (type) {
      case 'string':
        return node.name === 'String' ? this.readString(node) : invalid();
      case 'bool':
        return node.name === 'Boolean' ? raw === 'true' : invalid();
      case 'ident':
        return node.name === 'Identifier' ? raw : invalid();
      case 'color':
      case 'stateColor': {
        if (node.name !== 'Identifier' && node.name !== 'Color') return invalid();
        const colorName = raw.toLowerCase();
        if ((COLOR_NAMES as readonly string[]).includes(colorName)) return colorName;
        const allowsReset = type === 'stateColor';
        if (allowsReset && colorName === COLOR_RESET) return COLOR_RESET;
        const suggestion = node.name === 'Color' ? undefined : closestMatch(raw, COLOR_NAMES);
        this.report('invalid-color', 'error', node, {
          value: raw,
          suggestion: suggestion ?? '',
          names: (allowsReset ? [...COLOR_NAMES, COLOR_RESET] : COLOR_NAMES).join(', '),
        });
        return undefined;
      }
      case 'icon': {
        if (node.name !== 'Identifier') return invalid();
        const iconName = raw.toLowerCase();
        if (!(ICON_NAMES as readonly string[]).includes(iconName)) {
          this.report('unknown-icon', 'error', node, {
            icon: raw,
            suggestion: closestMatch(raw, ICON_NAMES) ?? '',
          });
          return undefined;
        }
        return iconName;
      }
    }
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

function rangeOf(node: SourceRange): SourceRange {
  return { from: node.from, to: node.to };
}

function assignString<K extends string>(
  target: Partial<Record<K, string>>,
  key: K,
  attrs: Map<string, ValidAttr>,
): void {
  const value = attrs.get(key)?.value;
  if (typeof value === 'string') target[key] = value;
}

/** Returns the closest candidate within an edit distance of 2 (or 1 for <=3-char names), if any. */
export function closestMatch(input: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = 3;
  const normalized = input.toLowerCase();
  for (const candidate of candidates) {
    const maxDistance = candidate.length <= 3 ? 1 : 2;
    const d = levenshtein(normalized, candidate);
    if (d <= maxDistance && d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] ?? 0;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j] ?? 0;
      prev[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diag = temp;
    }
  }
  return prev[b.length] ?? 0;
}

/**
 * Resolves a character offset in DSL text to the innermost element (`node`, `group`, or `edge`)
 * and/or the enclosing `step` index.
 */
export function findAtOffset(
  sourceMap: SourceMap,
  offset: number,
): { elementId: string | null; stepIndex: number | null } {
  let stepIndex: number | null = null;
  for (let i = 0; i < sourceMap.steps.length; i++) {
    const r = sourceMap.steps[i];
    if (r && r.from <= offset && offset <= r.to) {
      stepIndex = i;
      break;
    }
  }

  let best: ElementSource | null = null;
  for (const el of sourceMap.elements.values()) {
    if (el.from <= offset && offset <= el.to) {
      if (!best || el.to - el.from < best.to - best.from) {
        best = el;
      }
    }
  }
  return { elementId: best?.id ?? null, stepIndex };
}
