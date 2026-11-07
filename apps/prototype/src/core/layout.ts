import { DiagramModel, DiagramNode, getDefaultNodeSize } from './types';

const START_X = 60;
const START_Y = 100;
const COL_GAP = 230;
const ROW_GAP = 140;
const GROUP_PAD_X = 36;
const GROUP_PAD_TOP = 52;
const GROUP_PAD_BOTTOM = 32;

/**
 * Applies automatic layout to nodes and groups that do not have explicit @pos / @size
 * in the DSL. If forceAll is true, recalculates positions for all nodes and groups.
 */
export function applyAutoLayout(model: DiagramModel, forceAll = false): DiagramModel {
  const nodes = model.nodes.map((n) => ({ ...n }));
  const groups = model.groups.map((g) => ({ ...g }));

  // Compute topological rank (column index) from edges
  const rankMap = new Map<string, number>();
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const node of nodes) {
    rankMap.set(node.id, 0);
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
  }

  for (const edge of model.edges) {
    if (adj.has(edge.from) && inDegree.has(edge.to) && edge.from !== edge.to) {
      adj.get(edge.from)!.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }
  }

  // BFS / longest-path layering with cycle guard
  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }
  if (queue.length === 0 && nodes.length > 0) {
    queue.push(nodes[0].id);
  }

  const visitedCount = new Map<string, number>();
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currRank = rankMap.get(curr) ?? 0;
    for (const next of adj.get(curr) ?? []) {
      const nextRank = rankMap.get(next) ?? 0;
      if (currRank + 1 > nextRank && currRank + 1 < nodes.length) {
        rankMap.set(next, currRank + 1);
      }
      const count = (visitedCount.get(next) ?? 0) + 1;
      visitedCount.set(next, count);
      if (count <= nodes.length) {
        queue.push(next);
      }
    }
  }

  // Group nodes by rank
  const columns = new Map<number, DiagramNode[]>();
  for (const node of nodes) {
    const r = rankMap.get(node.id) ?? 0;
    if (!columns.has(r)) columns.set(r, []);
    columns.get(r)!.push(node);
  }

  const sortedRanks = Array.from(columns.keys()).sort((a, b) => a - b);
  const maxNodesInCol = Math.max(
    1,
    ...Array.from(columns.values()).map((col) => col.length)
  );
  const totalHeight = maxNodesInCol * ROW_GAP;

  for (let colIdx = 0; colIdx < sortedRanks.length; colIdx++) {
    const rank = sortedRanks[colIdx];
    const colNodes = columns.get(rank)!;
    // Sort nodes in the same column by groupId so grouped nodes stay adjacent
    colNodes.sort((a, b) => (a.groupId ?? '').localeCompare(b.groupId ?? ''));

    const colHeight = colNodes.length * ROW_GAP;
    const offsetY = START_Y + Math.max(0, Math.round((totalHeight - colHeight) / 2));

    colNodes.forEach((node, rowIdx) => {
      const size = getDefaultNodeSize(node.icon);
      node.width = size.width;
      node.height = size.height;
      if (forceAll || !node.hasExplicitPos) {
        node.x = Math.round(START_X + colIdx * COL_GAP);
        node.y = Math.round(offsetY + rowIdx * ROW_GAP);
        if (forceAll) {
          node.hasExplicitPos = true;
        }
      }
    });
  }

  // Compute group bounds around member nodes when not explicitly sized/positioned
  for (const group of groups) {
    const members = nodes.filter((n) => n.groupId === group.id);
    if (members.length > 0 && (forceAll || !group.hasExplicitPos || !group.hasExplicitSize)) {
      const minX = Math.min(...members.map((m) => m.x));
      const minY = Math.min(...members.map((m) => m.y));
      const maxX = Math.max(...members.map((m) => m.x + m.width));
      const maxY = Math.max(...members.map((m) => m.y + m.height));

      if (forceAll || !group.hasExplicitPos) {
        group.x = Math.round(minX - GROUP_PAD_X);
        group.y = Math.round(minY - GROUP_PAD_TOP);
        if (forceAll) group.hasExplicitPos = true;
      }
      if (forceAll || !group.hasExplicitSize) {
        group.width = Math.round(maxX - minX + GROUP_PAD_X * 2);
        group.height = Math.round(maxY - minY + GROUP_PAD_TOP + GROUP_PAD_BOTTOM);
        if (forceAll) group.hasExplicitSize = true;
      }
    }
  }

  return {
    ...model,
    nodes,
    groups,
  };
}
