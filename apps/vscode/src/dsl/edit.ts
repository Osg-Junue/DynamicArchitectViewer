import type { SyntaxNode } from '@lezer/common';
import { ICON_NAMES, implicitEdgeId, NODE_STATUSES, type Point, type Size } from '../model/types';
import { closestMatch } from './analyze';
import { ATTRIBUTE_SCHEMA, type AttrOwner, isValidColor, isValidIdentifier } from './schema';
import { childNodes, parseTree, quoteString, sliceOf } from './syntax';

/**
 * Non-destructive edit API.
 * Every operation returns minimal text changes; comments, blank lines and unrelated
 * statements are never rewritten. Changes are non-overlapping and can be passed to
 * `applyChanges` or directly to a CodeMirror transaction.
 */

export interface TextChange {
  from: number;
  to: number;
  insert: string;
}

export type EditErrorCode = 'not-found' | 'invalid-id' | 'id-conflict' | 'invalid-value';

export class EditError extends Error {
  constructor(
    readonly code: EditErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EditError';
  }
}

export type AttrValue = string | boolean;
export type Attrs = Readonly<Record<string, AttrValue>>;
export type ArrowToken = '-->' | '-.->' | '<-->' | '<-.->';

export interface NodeSpec {
  id: string;
  label?: string;
  attrs?: Attrs;
  parentId?: string;
  pos?: Point;
  size?: Size;
}

export type GroupSpec = NodeSpec;

export interface EdgeSpec {
  from: string;
  to: string;
  arrow?: ArrowToken;
  label?: string;
  attrs?: Attrs;
}

export type StepStatementSpec =
  | { kind: 'desc'; text: string }
  | { kind: 'focus'; ids: readonly string[] }
  | { kind: 'state'; target: string; attrs: Attrs }
  | {
      kind: 'animate';
      from: string;
      to: string;
      arrow?: ArrowToken;
      label?: string;
      attrs?: Attrs;
    };

export interface StepSpec {
  id?: string;
  title: string;
  statements?: readonly StepStatementSpec[];
}

/** Applies non-overlapping changes to text. */
export function applyChanges(text: string, changes: readonly TextChange[]): string {
  const sorted = [...changes].sort((a, b) => b.from - a.from || b.to - a.to);
  let out = text;
  for (const c of sorted) out = out.slice(0, c.from) + c.insert + out.slice(c.to);
  return out;
}

// -----------------------------------------------------------------------------
// Placement, attributes, labels
// -----------------------------------------------------------------------------

/** Sets (or removes with `null`) @pos / @size of a node or group. */
export function setPlacement(
  text: string,
  id: string,
  placement: { pos?: Point | null; size?: Size | null },
): TextChange[] {
  const doc = new DocIndex(text);
  const el = doc.require(id, ['node', 'group']);
  const changes: TextChange[] = [];

  for (const [name, value] of [
    ['Pos', placement.pos],
    ['Size', placement.size],
  ] as const) {
    if (value === undefined) continue;
    const existing = el.node.getChildren(name);
    const token =
      value === null
        ? null
        : name === 'Pos'
          ? `@pos(${num((value as Point).x)}, ${num((value as Point).y)})`
          : `@size(${num((value as Size).width)}, ${num((value as Size).height)})`;

    if (existing.length > 0) {
      existing.forEach((p, i) => {
        if (token !== null && i === existing.length - 1) {
          changes.push({ from: p.from, to: p.to, insert: token });
        } else {
          changes.push({ from: precedingEnd(p), to: p.to, insert: '' });
        }
      });
    } else if (token !== null) {
      // Keep canonical order: @pos before @size.
      const size = name === 'Pos' ? el.node.getChild('Size') : null;
      if (size) {
        changes.push({ from: size.from, to: size.from, insert: `${token} ` });
      } else {
        const anchor = lastChild(el.node, ['Identifier', 'Label', 'Attributes', 'Pos', 'Size']);
        changes.push({ from: anchor.to, to: anchor.to, insert: ` ${token}` });
      }
    }
  }
  return changes;
}

/** Sets or removes (`undefined`) an attribute of a node, group or edge. */
export function setAttribute(
  text: string,
  targetId: string,
  key: string,
  value: AttrValue | undefined,
): TextChange[] {
  const doc = new DocIndex(text);
  const el = doc.require(targetId, ['node', 'group', 'edge']);
  if (el.kind === 'edge' && key === 'id') {
    throw new EditError('invalid-value', 'Use renameId to change an edge ID');
  }
  const owner: AttrOwner = el.kind as AttrOwner;
  const formatted = value === undefined ? undefined : formatAttrValue(owner, key, value);
  return attributeChanges(el.node, text, key, formatted, () => {
    if (el.kind === 'edge') {
      return lastChild(el.node, ['Identifier', 'EdgeLabel']).to;
    }
    return lastChild(el.node, ['Identifier', 'Label']).to;
  });
}

/** Sets or removes the display label of a node, group or edge, or the title of a step. */
export function setLabel(text: string, id: string, label: string | undefined): TextChange[] {
  const doc = new DocIndex(text);
  const el = doc.require(id, ['node', 'group', 'edge', 'step']);
  return labelChanges(el, label);
}

/** Sets the title of the step at `index`. */
export function setStepTitle(text: string, index: number, title: string): TextChange[] {
  const doc = new DocIndex(text);
  return labelChanges({ kind: 'step', node: doc.step(index) }, title);
}

function labelChanges(el: Located, label: string | undefined): TextChange[] {
  const { node } = el;
  if (el.kind === 'step') {
    if (label === undefined) throw new EditError('invalid-value', 'A step title is required');
    const str = node.getChild('String');
    if (str) return [{ from: str.from, to: str.to, insert: quoteString(label) }];
    const anchor = lastChild(node, ['step', 'Identifier']);
    return [{ from: anchor.to, to: anchor.to, insert: ` ${quoteString(label)}` }];
  }

  const labelName = el.kind === 'edge' ? 'EdgeLabel' : 'Label';
  const existing = node.getChild(labelName);
  const literal = label === undefined ? '' : quoteString(label);
  const rendered = el.kind === 'edge' ? `: ${literal}` : literal;

  if (existing) {
    if (label === undefined) return [{ from: precedingEnd(existing), to: existing.to, insert: '' }];
    return [{ from: existing.from, to: existing.to, insert: rendered }];
  }
  if (label === undefined) return [];
  const anchor = el.kind === 'edge' ? lastChild(node, ['Identifier']) : node.getChild('Identifier');
  if (!anchor) throw new EditError('not-found', 'Malformed statement');
  return [{ from: anchor.to, to: anchor.to, insert: ` ${rendered}` }];
}

// -----------------------------------------------------------------------------
// Adding elements
// -----------------------------------------------------------------------------

export function addNode(text: string, spec: NodeSpec): TextChange[] {
  return addDeclaration(text, 'node', spec);
}

export function addGroup(text: string, spec: GroupSpec): TextChange[] {
  return addDeclaration(text, 'group', spec);
}

function addDeclaration(text: string, kind: 'node' | 'group', spec: NodeSpec): TextChange[] {
  const doc = new DocIndex(text);
  doc.assertNewId(spec.id);
  const line = buildDeclaration(kind, spec);

  if (spec.parentId !== undefined) {
    const parent = doc.require(spec.parentId, ['group']);
    const body = parent.node.getChild('GroupBody');
    if (!body) throw new EditError('not-found', `Group "${spec.parentId}" has no body`);
    return [insertIntoBlock(text, body, [line])];
  }

  const top = doc.topStatements();
  const anchor =
    findLast(top, (n) => n.name === 'Node' || n.name === 'Group') ??
    findLast(top, (n) => n.name === 'Title' || n.name === 'Header');
  return [insertAfterStatement(text, anchor, [line], doc.firstTopStatement())];
}

export function addEdge(text: string, spec: EdgeSpec): TextChange[] {
  const doc = new DocIndex(text);
  validateId(spec.from);
  validateId(spec.to);
  const explicit = spec.attrs?.id;
  if (typeof explicit === 'string') {
    doc.assertNewId(explicit);
  } else if (doc.has(implicitEdgeId(spec.from, spec.to))) {
    throw new EditError(
      'id-conflict',
      `An edge from "${spec.from}" to "${spec.to}" already exists; specify attrs.id`,
    );
  }
  const line = buildEdgeLike(spec, 'edge');
  const top = doc.topStatements();
  const anchor =
    findLast(top, (n) => n.name === 'Edge') ??
    findLast(top, (n) => n.name === 'Node' || n.name === 'Group') ??
    findLast(top, (n) => n.name === 'Title' || n.name === 'Header');
  return [insertAfterStatement(text, anchor, [line], doc.firstTopStatement())];
}

// -----------------------------------------------------------------------------
// Removing and renaming
// -----------------------------------------------------------------------------

/**
 * Removes a node, group, edge or step.
 * Dependent statements are removed too: edges attached to removed nodes, and
 * `focus` / `state` / `animate` references to any removed element.
 */
export function removeElement(text: string, id: string): TextChange[] {
  const doc = new DocIndex(text);
  const el = doc.require(id, ['node', 'group', 'edge', 'step']);

  const removedIds = new Set<string>([id]);
  const deletions: SyntaxNode[] = [el.node];

  if (el.kind === 'group') {
    for (const descendant of descendantDeclarations(el.node)) {
      const idNode = descendant.getChild('Identifier');
      if (idNode) removedIds.add(sliceOf(text, idNode));
    }
  }

  if (el.kind === 'node' || el.kind === 'group') {
    for (const edge of doc.edges()) {
      const [from, to] = edge.getChildren('Identifier').map((n) => sliceOf(text, n));
      if ((from && removedIds.has(from)) || (to && removedIds.has(to))) {
        deletions.push(edge);
        const explicit = explicitEdgeIdOf(text, edge);
        if (explicit) removedIds.add(explicit);
      }
    }
  }

  const changes: TextChange[] = [];
  for (const step of doc.steps()) {
    for (const stmt of stepStatements(step)) {
      const ids = stmt.getChildren('Identifier').map((n) => sliceOf(text, n));
      if (stmt.name === 'State' || stmt.name === 'Animate') {
        if (ids.some((x) => removedIds.has(x))) deletions.push(stmt);
      } else if (stmt.name === 'Focus') {
        const remaining = ids.filter((x) => !removedIds.has(x));
        if (remaining.length === 0) deletions.push(stmt);
        else if (remaining.length !== ids.length) {
          changes.push({ from: stmt.from, to: stmt.to, insert: `focus ${remaining.join(', ')}` });
        }
      }
    }
  }

  const ranges = deletions.map((n) => statementDeletionRange(text, n));
  const unique = ranges.filter(
    (r, i) => ranges.findIndex((o) => o.from === r.from && o.to === r.to) === i,
  );
  const outermost = unique.filter(
    (r) => !unique.some((o) => o !== r && o.from <= r.from && o.to >= r.to),
  );
  // Focus rewrites inside a deleted range are redundant.
  const rewrites = changes.filter((c) => !outermost.some((r) => r.from <= c.from && r.to >= c.to));
  return [...outermost.map((r) => ({ ...r, insert: '' })), ...rewrites];
}

/** Renames an element ID and every reference to it. */
export function renameId(text: string, oldId: string, newId: string): TextChange[] {
  const doc = new DocIndex(text);
  const el = doc.require(oldId, ['node', 'group', 'edge', 'step']);
  if (el.kind === 'edge' && !explicitEdgeIdOf(text, el.node)) {
    throw new EditError('invalid-id', 'Implicit edge IDs cannot be renamed; add attrs.id instead');
  }
  if (oldId === newId) return [];
  doc.assertNewId(newId);

  const changes: TextChange[] = [];
  const visit = (node: SyntaxNode) => {
    for (const child of childNodes(node)) {
      if (child.name === 'Identifier' && sliceOf(text, child) === oldId) {
        changes.push({ from: child.from, to: child.to, insert: newId });
      } else if (child.name === 'Attribute') {
        const name = child.getChild('AttrName');
        const value = child.getChild('Identifier');
        if (
          node.parent?.name === 'Edge' &&
          name &&
          sliceOf(text, name) === 'id' &&
          value &&
          sliceOf(text, value) === oldId
        ) {
          changes.push({ from: value.from, to: value.to, insert: newId });
        }
      } else if (child.name !== 'AttrName') {
        visit(child);
      }
    }
  };
  visit(doc.top);
  return changes;
}

// -----------------------------------------------------------------------------
// Steps
// -----------------------------------------------------------------------------

/** Inserts a step before the step at `index` (default: append). */
export function addStep(text: string, spec: StepSpec, index?: number): TextChange[] {
  const doc = new DocIndex(text);
  if (spec.id !== undefined) doc.assertNewId(spec.id);
  const lines = buildStep(spec);
  const steps = doc.steps();

  if (index !== undefined && index < steps.length) {
    const before = steps[index];
    if (!before) throw new EditError('not-found', `Step ${index} not found`);
    const at = lineStart(text, before.from);
    const indent = indentOf(text, before.from);
    const eol = eolOf(text);
    return [{ from: at, to: at, insert: lines.map((l) => indent + l).join(eol) + eol + eol }];
  }

  const top = doc.topStatements();
  const anchor = top.at(-1) ?? null;
  return [insertAfterStatement(text, anchor, lines, null, true)];
}

export function removeStep(text: string, index: number): TextChange[] {
  const doc = new DocIndex(text);
  const range = statementDeletionRange(text, doc.step(index));
  return [{ ...range, insert: '' }];
}

/** Moves the step at `from` so that it ends up at position `to`. */
export function moveStep(text: string, from: number, to: number): TextChange[] {
  const doc = new DocIndex(text);
  if (from === to) return [];
  const moving = doc.step(from);
  const target = doc.step(to);
  const eol = eolOf(text);

  const core = statementDeletionRange(text, moving);
  let block = text.slice(core.from, core.to);
  if (!block.endsWith('\n')) block += eol;
  const removal = extendOverBlankLine(text, core);

  if (to < from) {
    const at = lineStart(text, target.from);
    return [
      { from: at, to: at, insert: block + eol },
      { ...removal, insert: '' },
    ];
  }
  const after = statementDeletionRange(text, target);
  const atEndWithoutEol = after.to === text.length && !text.endsWith('\n');
  const insert = atEndWithoutEol ? eol + eol + block.replace(/\r?\n$/, '') : eol + block;
  return [
    { ...removal, insert: '' },
    { from: after.to, to: after.to, insert },
  ];
}

/** Extends a whole-line range over one adjacent blank line (following, else preceding). */
function extendOverBlankLine(text: string, range: { from: number; to: number }) {
  const following = /^[ \t]*\r?\n/.exec(text.slice(range.to));
  if (following) return { from: range.from, to: range.to + following[0].length };
  if (range.from > 0) {
    const prevLineStart = lineStart(text, range.from - 1);
    if (text.slice(prevLineStart, range.from).trim() === '') {
      return { from: prevLineStart, to: range.to };
    }
  }
  return range;
}

/** Appends a statement to the step at `stepIndex`. */
export function insertStepStatement(
  text: string,
  stepIndex: number,
  spec: StepStatementSpec,
): TextChange[] {
  const doc = new DocIndex(text);
  const body = doc.step(stepIndex).getChild('StepBody');
  if (!body) throw new EditError('not-found', 'Malformed step');
  return [insertIntoBlock(text, body, [buildStepStatement(spec)])];
}

export function replaceStepStatement(
  text: string,
  stepIndex: number,
  statementIndex: number,
  spec: StepStatementSpec,
): TextChange[] {
  const doc = new DocIndex(text);
  const stmt = stepStatements(doc.step(stepIndex))[statementIndex];
  if (!stmt) throw new EditError('not-found', `Statement ${statementIndex} not found`);
  return [{ from: stmt.from, to: stmt.to, insert: buildStepStatement(spec) }];
}

export function removeStepStatement(
  text: string,
  stepIndex: number,
  statementIndex: number,
): TextChange[] {
  const doc = new DocIndex(text);
  const stmt = stepStatements(doc.step(stepIndex))[statementIndex];
  if (!stmt) throw new EditError('not-found', `Statement ${statementIndex} not found`);
  return [{ ...statementDeletionRange(text, stmt), insert: '' }];
}

export interface IndexedStepStatement {
  statementIndex: number;
  kind: 'desc' | 'focus' | 'state' | 'animate';
  from: number;
  to: number;
}

/** Lists step statements with their indices for `replaceStepStatement` / `removeStepStatement`. */
export function listStepStatements(text: string, stepIndex: number): IndexedStepStatement[] {
  const doc = new DocIndex(text);
  const steps = doc.steps();
  const step = steps[stepIndex];
  if (!step) return [];
  return stepStatements(step).map((stmt, statementIndex) => ({
    statementIndex,
    kind: stmt.name.toLowerCase() as IndexedStepStatement['kind'],
    from: stmt.from,
    to: stmt.to,
  }));
}

// -----------------------------------------------------------------------------
// Document index
// -----------------------------------------------------------------------------

type LocatedKind = 'node' | 'group' | 'edge' | 'step';

interface Located {
  kind: LocatedKind;
  node: SyntaxNode;
}

class DocIndex {
  readonly top: SyntaxNode;
  private readonly index = new Map<string, Located>();

  constructor(private readonly text: string) {
    this.top = parseTree(text).topNode;
    this.build();
  }

  private build(): void {
    const declare = (id: string, located: Located) => {
      if (!this.index.has(id)) this.index.set(id, located);
    };
    const visitDecl = (node: SyntaxNode) => {
      const kind = node.name === 'Group' ? 'group' : 'node';
      const idNode = node.getChild('Identifier');
      if (idNode) declare(sliceOf(this.text, idNode), { kind, node });
      const body = node.getChild('GroupBody');
      if (body) for (const c of childNodes(body)) if (isDecl(c)) visitDecl(c);
    };
    for (const node of childNodes(this.top)) {
      if (isDecl(node)) visitDecl(node);
      else if (node.name === 'Edge') {
        const explicit = explicitEdgeIdOf(this.text, node);
        const [from, to] = node.getChildren('Identifier').map((n) => sliceOf(this.text, n));
        if (explicit) declare(explicit, { kind: 'edge', node });
        else if (from && to) declare(implicitEdgeId(from, to), { kind: 'edge', node });
      } else if (node.name === 'Step') {
        const idNode = node.getChild('Identifier');
        if (idNode) declare(sliceOf(this.text, idNode), { kind: 'step', node });
      }
    }
  }

  has(id: string): boolean {
    return this.index.has(id);
  }

  require(id: string, kinds: readonly LocatedKind[]): Located {
    const found = this.index.get(id);
    if (!found || !kinds.includes(found.kind)) {
      throw new EditError('not-found', `No ${kinds.join('/')} with ID "${id}"`);
    }
    return found;
  }

  assertNewId(id: string): void {
    validateId(id);
    if (this.index.has(id)) throw new EditError('id-conflict', `ID "${id}" is already in use`);
  }

  topStatements(): SyntaxNode[] {
    return childNodes(this.top).filter((n) => n.name !== 'LineComment' && !n.type.isError);
  }

  firstTopStatement(): SyntaxNode | null {
    return this.topStatements()[0] ?? null;
  }

  edges(): SyntaxNode[] {
    return this.top.getChildren('Edge');
  }

  steps(): SyntaxNode[] {
    return this.top.getChildren('Step');
  }

  step(index: number): SyntaxNode {
    const step = this.steps()[index];
    if (!step) throw new EditError('not-found', `Step ${index} not found`);
    return step;
  }
}

function isDecl(node: SyntaxNode): boolean {
  return node.name === 'Node' || node.name === 'Group';
}

function descendantDeclarations(group: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  const body = group.getChild('GroupBody');
  if (!body) return out;
  for (const c of childNodes(body)) {
    if (!isDecl(c)) continue;
    out.push(c);
    if (c.name === 'Group') out.push(...descendantDeclarations(c));
  }
  return out;
}

function stepStatements(step: SyntaxNode): SyntaxNode[] {
  const body = step.getChild('StepBody');
  if (!body) return [];
  return childNodes(body).filter((n) => ['Desc', 'Focus', 'State', 'Animate'].includes(n.name));
}

function explicitEdgeIdOf(text: string, edge: SyntaxNode): string | undefined {
  const attrs = edge.getChild('Attributes');
  if (!attrs) return undefined;
  let found: string | undefined;
  for (const attr of attrs.getChildren('Attribute')) {
    const name = attr.getChild('AttrName');
    const value = attr.getChild('Identifier');
    if (name && value && sliceOf(text, name) === 'id') found = sliceOf(text, value);
  }
  return found;
}

// -----------------------------------------------------------------------------
// Text helpers
// -----------------------------------------------------------------------------

function attributeChanges(
  owner: SyntaxNode,
  text: string,
  key: string,
  formatted: string | undefined,
  insertionPoint: () => number,
): TextChange[] {
  const attrs = owner.getChild('Attributes');
  if (!attrs) {
    if (formatted === undefined) return [];
    const at = insertionPoint();
    return [{ from: at, to: at, insert: ` [${key}: ${formatted}]` }];
  }

  const items = attrs.getChildren('Attribute');
  const matching = items.filter((a) => {
    const name = a.getChild('AttrName');
    return name !== null && sliceOf(text, name) === key;
  });

  if (formatted !== undefined) {
    const target = matching.at(-1);
    if (target) {
      const value = childNodes(target).find((c) => c.name !== 'AttrName' && c.name !== ':');
      if (value) return [{ from: value.from, to: value.to, insert: formatted }];
      const colon = target.getChild(':');
      const at = colon ? colon.to : target.to;
      return [{ from: at, to: at, insert: ` ${formatted}` }];
    }
    const last = items.at(-1);
    if (!last) {
      const open = attrs.firstChild;
      const at = open ? open.to : attrs.from + 1;
      return [{ from: at, to: at, insert: `${key}: ${formatted}` }];
    }
    const trailingComma = last.nextSibling?.name === ',';
    const at = trailingComma && last.nextSibling ? last.nextSibling.to : last.to;
    return [{ from: at, to: at, insert: `${trailingComma ? ' ' : ', '}${key}: ${formatted}` }];
  }

  if (matching.length === 0) return [];
  if (matching.length === items.length) {
    return [{ from: precedingEnd(attrs), to: attrs.to, insert: '' }];
  }
  return matching.map((attr) => {
    const next = attr.nextSibling;
    const prev = attr.prevSibling;
    if (next?.name === ',' && next.nextSibling?.name === 'Attribute') {
      return { from: attr.from, to: next.nextSibling.from, insert: '' };
    }
    if (prev?.name === ',') {
      const before = prev.prevSibling;
      return {
        from: before ? before.to : prev.from,
        to: next?.name === ',' ? next.to : attr.to,
        insert: '',
      };
    }
    return { from: attr.from, to: next?.name === ',' ? next.to : attr.to, insert: '' };
  });
}

/** Inserts lines before the closing brace of a GroupBody / StepBody. */
function insertIntoBlock(text: string, body: SyntaxNode, lines: string[]): TextChange {
  const close = body.lastChild?.name === '}' ? body.lastChild : null;
  const eol = eolOf(text);
  const ownerIndent = indentOf(text, body.parent?.from ?? body.from);
  const childIndent = `${ownerIndent}  `;
  const rendered = lines.map((l) => childIndent + l).join(eol);

  if (!close) {
    // Unterminated block (syntax error): append at the end of the body.
    return { from: body.to, to: body.to, insert: eol + rendered };
  }
  const start = lineStart(text, close.from);
  if (text.slice(start, close.from).trim() === '') {
    return { from: start, to: start, insert: rendered + eol };
  }
  return { from: close.from, to: close.from, insert: eol + rendered + eol + ownerIndent };
}

/** Inserts top-level lines after `anchor` (or before `fallbackBefore` / at the start). */
function insertAfterStatement(
  text: string,
  anchor: SyntaxNode | null,
  lines: string[],
  fallbackBefore: SyntaxNode | null,
  blankLineBefore = false,
): TextChange {
  const eol = eolOf(text);
  const rendered = lines.join(eol);
  if (anchor) {
    const at = lineEnd(text, anchor.to);
    return { from: at, to: at, insert: eol + (blankLineBefore ? eol : '') + rendered };
  }
  if (fallbackBefore) {
    const at = lineStart(text, fallbackBefore.from);
    return { from: at, to: at, insert: rendered + eol };
  }
  const prefix = text.length > 0 && !text.endsWith('\n') ? eol : '';
  return { from: text.length, to: text.length, insert: prefix + rendered + eol };
}

/** Whole lines if the statement stands alone on its lines (trailing comment included). */
function statementDeletionRange(text: string, node: SyntaxNode): { from: number; to: number } {
  const start = lineStart(text, node.from);
  const end = lineEnd(text, node.to);
  const before = text.slice(start, node.from);
  const after = text.slice(node.to, end);
  if (before.trim() === '' && (after.trim() === '' || after.trim().startsWith('//'))) {
    let to = end;
    if (text.startsWith('\r\n', to)) to += 2;
    else if (text[to] === '\n') to += 1;
    return { from: start, to };
  }
  return { from: precedingEnd(node), to: node.to };
}

function precedingEnd(node: SyntaxNode): number {
  return node.prevSibling ? node.prevSibling.to : node.from;
}

function lastChild(node: SyntaxNode, names: readonly string[]): SyntaxNode {
  let found: SyntaxNode | null = null;
  for (const c of childNodes(node)) if (names.includes(c.name)) found = c;
  if (!found) throw new EditError('not-found', 'Malformed statement');
  return found;
}

function findLast(nodes: SyntaxNode[], pred: (n: SyntaxNode) => boolean): SyntaxNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n && pred(n)) return n;
  }
  return null;
}

function lineStart(text: string, pos: number): number {
  return text.lastIndexOf('\n', pos - 1) + 1;
}

function lineEnd(text: string, pos: number): number {
  const nl = text.indexOf('\n', pos);
  if (nl < 0) return text.length;
  return text[nl - 1] === '\r' ? nl - 1 : nl;
}

function indentOf(text: string, pos: number): string {
  const start = lineStart(text, pos);
  return /^[ \t]*/.exec(text.slice(start))?.[0] ?? '';
}

function eolOf(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function num(n: number): string {
  return String(Math.round(n));
}

// -----------------------------------------------------------------------------
// Builders
// -----------------------------------------------------------------------------

function validateId(id: string): void {
  if (!isValidIdentifier(id))
    throw new EditError('invalid-id', `"${id}" is not a valid identifier`);
}

function formatAttrValue(owner: AttrOwner, key: string, value: AttrValue): string {
  const type = ATTRIBUTE_SCHEMA[owner][key];
  if (!type) throw new EditError('invalid-value', `Attribute "${key}" is not allowed on ${owner}`);
  const fail = () => new EditError('invalid-value', `Invalid value for "${key}": ${String(value)}`);

  switch (type) {
    case 'string':
      if (typeof value !== 'string') throw fail();
      return quoteString(value);
    case 'bool':
      if (typeof value !== 'boolean') throw fail();
      return String(value);
    case 'color':
      if (typeof value !== 'string' || !isValidColor(value)) throw fail();
      return value.toLowerCase();
    case 'ident':
      if (typeof value !== 'string' || !isValidIdentifier(value)) throw fail();
      return value;
    case 'status':
      if (typeof value !== 'string' || !(NODE_STATUSES as readonly string[]).includes(value)) {
        throw fail();
      }
      return value;
    case 'icon':
      if (typeof value !== 'string' || !(ICON_NAMES as readonly string[]).includes(value)) {
        const hint = typeof value === 'string' ? closestMatch(value, ICON_NAMES) : undefined;
        throw new EditError(
          'invalid-value',
          `Unknown icon "${String(value)}"${hint ? ` (did you mean "${hint}"?)` : ''}`,
        );
      }
      return value;
  }
}

function buildAttrs(owner: AttrOwner, attrs: Attrs | undefined): string {
  if (!attrs) return '';
  const entries = Object.entries(attrs);
  if (entries.length === 0) return '';
  const body = entries.map(([k, v]) => `${k}: ${formatAttrValue(owner, k, v)}`).join(', ');
  return ` [${body}]`;
}

function buildDeclaration(kind: 'node' | 'group', spec: NodeSpec): string {
  let line = `${kind} ${spec.id}`;
  if (spec.label !== undefined) line += ` ${quoteString(spec.label)}`;
  line += buildAttrs(kind, spec.attrs);
  if (spec.pos) line += ` @pos(${num(spec.pos.x)}, ${num(spec.pos.y)})`;
  if (spec.size) line += ` @size(${num(spec.size.width)}, ${num(spec.size.height)})`;
  if (kind === 'group') line += ' {}';
  return line;
}

function buildEdgeLike(spec: EdgeSpec, owner: 'edge' | 'animate'): string {
  validateId(spec.from);
  validateId(spec.to);
  let line = `${spec.from} ${spec.arrow ?? '-->'} ${spec.to}`;
  if (spec.label !== undefined) line += ` : ${quoteString(spec.label)}`;
  line += buildAttrs(owner, spec.attrs);
  return line;
}

function buildStepStatement(spec: StepStatementSpec): string {
  switch (spec.kind) {
    case 'desc':
      return `desc ${quoteString(spec.text)}`;
    case 'focus':
      if (spec.ids.length === 0)
        throw new EditError('invalid-value', 'focus needs at least one ID');
      spec.ids.forEach(validateId);
      return `focus ${spec.ids.join(', ')}`;
    case 'state': {
      validateId(spec.target);
      const attrs = buildAttrs('state', spec.attrs);
      if (!attrs) throw new EditError('invalid-value', 'state needs at least one attribute');
      return `state ${spec.target}${attrs}`;
    }
    case 'animate':
      return `animate ${buildEdgeLike(spec, 'animate')}`;
  }
}

function buildStep(spec: StepSpec): string[] {
  if (spec.id !== undefined) validateId(spec.id);
  const head = `step ${spec.id !== undefined ? `${spec.id} ` : ''}${quoteString(spec.title)}`;
  const statements = (spec.statements ?? []).map(buildStepStatement);
  if (statements.length === 0) return [`${head} {}`];
  return [`${head} {`, ...statements.map((s) => `  ${s}`), '}'];
}
