import { pushToMap } from '../model/text';

export interface RankResult {
  rank: Map<string, number>;
  predecessors: Map<string, string[]>;
}

/** Longest-path ranks; back edges found by DFS are ignored so cycles terminate. */
export function computeRanks(
  ids: readonly string[],
  edges: ReadonlyArray<readonly [string, string]>,
): RankResult {
  const known = new Set(ids);
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const [from, to] of edges) {
    if (known.has(from) && known.has(to) && from !== to) out.get(from)?.push(to);
  }

  // Remove back edges (iterative DFS to avoid stack overflow on large graphs).
  const state = new Map<string, 0 | 1 | 2>();
  const forward = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const root of ids) {
    if (state.get(root)) continue;
    const stack: Array<{ id: string; i: number }> = [{ id: root, i: 0 }];
    state.set(root, 1);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (!frame) break;
      const targets = out.get(frame.id) ?? [];
      if (frame.i >= targets.length) {
        state.set(frame.id, 2);
        stack.pop();
        continue;
      }
      const next = targets[frame.i++];
      if (next === undefined) continue;
      const s = state.get(next) ?? 0;
      if (s === 1) continue; // back edge
      forward.get(frame.id)?.push(next);
      if (s === 0) {
        state.set(next, 1);
        stack.push({ id: next, i: 0 });
      }
    }
  }

  // Kahn's algorithm over the acyclic edge set.
  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const targets of forward.values()) {
    for (const t of targets) indegree.set(t, (indegree.get(t) ?? 0) + 1);
  }
  const rank = new Map<string, number>(ids.map((id) => [id, 0]));
  const queue = ids.filter((id) => indegree.get(id) === 0);
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    if (id === undefined) continue;
    for (const t of forward.get(id) ?? []) {
      rank.set(t, Math.max(rank.get(t) ?? 0, (rank.get(id) ?? 0) + 1));
      const d = (indegree.get(t) ?? 0) - 1;
      indegree.set(t, d);
      if (d === 0) queue.push(t);
    }
  }
  return { rank, predecessors: invert(forward) };
}

function invert(forward: ReadonlyMap<string, readonly string[]>): Map<string, string[]> {
  const preds = new Map<string, string[]>();
  for (const [from, targets] of forward) {
    for (const t of targets) {
      pushToMap(preds, t, from);
    }
  }
  return preds;
}
