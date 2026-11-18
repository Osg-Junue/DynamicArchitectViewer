export type ElementKind = 'node' | 'group';

export interface SourceRange {
  from: number;
  to: number;
}

export interface ElementSource extends SourceRange {
  kind: ElementKind;
  id: string;
  idRange?: SourceRange;
}

export interface SourceMap {
  /** Keyed by element ID. First declaration wins. */
  elements: ReadonlyMap<string, ElementSource>;
  /** Statement range for each step, by index. */
  steps: readonly SourceRange[];
}

export function rangeOf(node: SourceRange): SourceRange {
  return { from: node.from, to: node.to };
}

/**
 * Resolves a character offset in DSL text to the innermost element (`node` or `group`)
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
