import {
  type ColorName,
  type DavConnection,
  type DavDocument,
  type DavStep,
  implicitEdgeId,
} from './types';
import { idPair } from './zones';

/** Order-independent map key for a node pair (or self-loop when `a === b`). */
export function unorderedPairKey(a: string, b: string): string {
  return a <= b ? idPair(a, b) : idPair(b, a);
}

interface PairAcc {
  key: string;
  from: string;
  to: string;
  seenForward: boolean;
  seenBackward: boolean;
  seenSolid: boolean;
  animated: boolean;
  staticColor?: DavStep['statics'][number]['color'];
  staticLabel?: string;
  animateLabel?: string;
}

function accumulateStatement(
  acc: Map<string, PairAcc>,
  from: string,
  to: string,
  style: 'solid' | 'dashed',
  direction: 'forward' | 'bidirectional',
  kind: 'animate' | 'static',
  label?: string,
  color?: DavStep['statics'][number]['color'],
): void {
  const key = unorderedPairKey(from, to);
  let entry = acc.get(key);
  if (!entry) {
    entry = {
      key,
      from,
      to,
      seenForward: false,
      seenBackward: false,
      seenSolid: false,
      animated: false,
    };
    acc.set(key, entry);
  }
  if (from === to) {
    entry.seenForward = true;
  } else if (direction === 'bidirectional') {
    entry.seenForward = true;
    entry.seenBackward = true;
  } else if (entry.from === from && entry.to === to) {
    entry.seenForward = true;
  } else {
    entry.seenBackward = true;
  }
  if (style === 'solid') entry.seenSolid = true;
  if (kind === 'animate') {
    entry.animated = true;
    if (label !== undefined && label.trim().length > 0 && entry.animateLabel === undefined) {
      entry.animateLabel = label;
    }
  } else {
    if (color !== undefined) entry.staticColor = color;
    if (label !== undefined) entry.staticLabel = label;
  }
}

function toConnection(entry: PairAcc, id = implicitEdgeId(entry.from, entry.to)): DavConnection {
  return {
    id,
    from: entry.from,
    to: entry.to,
    style: entry.seenSolid ? 'solid' : 'dashed',
    direction:
      entry.from !== entry.to && entry.seenForward && entry.seenBackward
        ? 'bidirectional'
        : 'forward',
    animated: entry.animated,
  };
}

/**
 * Synthesizes one connection per unordered endpoint pair (or self-loop) across all steps.
 * Directions merge (`a --> b` plus `b --> a` becomes bidirectional) and any solid arrow
 * promotes the overview rail to solid.
 */
export function synthesizedConnections(doc: Pick<DavDocument, 'steps'>): DavConnection[] {
  const acc = new Map<string, PairAcc>();
  for (const step of doc.steps) {
    for (const a of step.animations) {
      accumulateStatement(acc, a.from, a.to, a.style, a.direction, 'animate');
    }
    for (const s of step.statics) {
      accumulateStatement(acc, s.from, s.to, s.style, s.direction, 'static', s.label, s.color);
    }
  }
  return [...acc.values()].map((entry) => toConnection(entry));
}

/** Maps each unordered pair key to its canonical overview connection ID (`from->to`). */
export function connectionIdMap(connections: readonly DavConnection[]): Map<string, string> {
  return new Map(connections.map((c) => [unorderedPairKey(c.from, c.to), c.id]));
}

/** Maps each unordered pair key to its first non-empty label across all steps (for `--still --labels`). */
export function connectionLabels(doc: Pick<DavDocument, 'steps'>): Map<string, string> {
  const labels = new Map<string, string>();
  for (const step of doc.steps) {
    for (const a of step.animations) {
      if (a.label && a.label.trim().length > 0) {
        const key = unorderedPairKey(a.from, a.to);
        if (!labels.has(key)) labels.set(key, a.label);
      }
    }
    for (const s of step.statics) {
      if (s.label && s.label.trim().length > 0) {
        const key = unorderedPairKey(s.from, s.to);
        if (!labels.has(key)) labels.set(key, s.label);
      }
    }
  }
  return labels;
}

/**
 * Maps each unordered pair key to its semantic color for overview / still rendering,
 * keeping a color only when EVERY occurrence of that pair across all steps agrees on the
 * same explicit color. Pairs that mix default and step-specific colors (e.g. a normal flow
 * that turns red only in a failure step) stay neutral in the overview.
 */
export function connectionColors(doc: Pick<DavDocument, 'steps'>): Map<string, ColorName> {
  const seen = new Map<string, ColorName | null>();
  const record = (from: string, to: string, color: ColorName | undefined) => {
    const key = unorderedPairKey(from, to);
    const cur = seen.get(key);
    if (cur === null) return;
    if (color === undefined) {
      seen.set(key, null);
    } else if (cur === undefined) {
      seen.set(key, color);
    } else if (cur !== color) {
      seen.set(key, null);
    }
  };
  for (const step of doc.steps) {
    for (const a of step.animations) record(a.from, a.to, a.color);
    for (const s of step.statics) record(s.from, s.to, s.color);
  }
  const out = new Map<string, ColorName>();
  for (const [key, color] of seen) {
    if (color !== null) out.set(key, color);
  }
  return out;
}

export interface StepConnection extends DavConnection {
  staticColor?: DavStep['statics'][number]['color'];
  staticLabel?: string;
  animateLabel?: string;
}

/**
 * Aggregates the connections declared inside a single step by unordered pair, preserving
 * that step's own direction, line style, and `static` label/color.
 */
export function stepConnections(
  step: DavStep,
  canonicalIds: ReadonlyMap<string, string>,
): StepConnection[] {
  const acc = new Map<string, PairAcc>();
  for (const a of step.animations) {
    accumulateStatement(acc, a.from, a.to, a.style, a.direction, 'animate', a.label);
  }
  for (const s of step.statics) {
    accumulateStatement(acc, s.from, s.to, s.style, s.direction, 'static', s.label, s.color);
  }
  return [...acc.values()].map((entry) => {
    const base = toConnection(
      entry,
      canonicalIds.get(entry.key) ?? implicitEdgeId(entry.from, entry.to),
    );
    const result: StepConnection = { ...base };
    if (entry.staticColor !== undefined) result.staticColor = entry.staticColor;
    if (entry.staticLabel !== undefined) result.staticLabel = entry.staticLabel;
    if (entry.animateLabel !== undefined) result.animateLabel = entry.animateLabel;
    return result;
  });
}

/** Node IDs that appear in at least one self-loop (`animate` or `static`) across any step. */
export function selfLoopNodeIds(doc: Pick<DavDocument, 'steps'>): Set<string> {
  const out = new Set<string>();
  for (const step of doc.steps) {
    for (const a of step.animations) if (a.from === a.to) out.add(a.from);
    for (const s of step.statics) if (s.from === s.to) out.add(s.from);
  }
  return out;
}
