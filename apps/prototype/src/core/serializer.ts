import {
  DiagramEdge,
  DiagramGroup,
  DiagramModel,
  DiagramNode,
  DiagramStep,
} from './types';

/**
 * Updates @pos(x, y) and @size(w, h) in-place within existing DSL text
 * so user comments and formatting are preserved during canvas drag operations.
 */
export function patchPositionsInDsl(
  dslText: string,
  nodeUpdates: Array<{ id: string; x: number; y: number }>,
  groupUpdates: Array<{ id: string; x: number; y: number; width?: number; height?: number }> = []
): string {
  const lines = dslText.split(/\r?\n/);
  const nodeMap = new Map(nodeUpdates.map((u) => [u.id, u]));
  const groupMap = new Map(groupUpdates.map((u) => [u.id, u]));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check node declaration line
    const nodeMatch = line.match(/^(\s*node\s+([a-zA-Z0-9_-]+)\b.*)$/);
    if (nodeMatch) {
      const nodeId = nodeMatch[2];
      const update = nodeMap.get(nodeId);
      if (update) {
        lines[i] = upsertPosInLine(line, Math.round(update.x), Math.round(update.y), false);
        continue;
      }
    }

    // Check group declaration line
    const groupMatch = line.match(/^(\s*group\s+([a-zA-Z0-9_-]+)\b.*)$/);
    if (groupMatch) {
      const groupId = groupMatch[2];
      const update = groupMap.get(groupId);
      if (update) {
        let updatedLine = upsertPosInLine(
          line,
          Math.round(update.x),
          Math.round(update.y),
          true
        );
        if (update.width !== undefined && update.height !== undefined) {
          updatedLine = upsertSizeInLine(
            updatedLine,
            Math.round(update.width),
            Math.round(update.height)
          );
        }
        lines[i] = updatedLine;
      }
    }
  }

  return lines.join('\n');
}

function upsertPosInLine(line: string, x: number, y: number, beforeBrace: boolean): string {
  const posToken = `@pos(${x}, ${y})`;
  if (/@pos\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)/.test(line)) {
    return line.replace(/@pos\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)/, posToken);
  }
  if (beforeBrace && line.includes('{')) {
    return line.replace(/\s*\{\s*$/, ` ${posToken} {`);
  }
  const commentIdx = findCommentIndex(line);
  if (commentIdx >= 0) {
    const before = line.slice(0, commentIdx).trimEnd();
    const after = line.slice(commentIdx);
    return `${before} ${posToken} ${after}`;
  }
  return `${line.trimEnd()} ${posToken}`;
}

function upsertSizeInLine(line: string, w: number, h: number): string {
  const sizeToken = `@size(${w}, ${h})`;
  if (/@size\(\s*\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?\s*\)/.test(line)) {
    return line.replace(/@size\(\s*\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?\s*\)/, sizeToken);
  }
  if (line.includes('{')) {
    return line.replace(/\s*\{\s*$/, ` ${sizeToken} {`);
  }
  return `${line.trimEnd()} ${sizeToken}`;
}

function findCommentIndex(line: string): number {
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuotes = !inQuotes;
    if (!inQuotes && line[i] === '/' && line[i + 1] === '/') return i;
  }
  return -1;
}

/**
 * Serializes a complete DiagramModel into formatted Mermaid-like DSL.
 */
export function serializeModelToDsl(model: DiagramModel): string {
  const out: string[] = [];
  out.push(`diagram "${escapeQuotes(model.title)}"`);
  out.push('');

  // 1. Groups and their member nodes
  for (const group of model.groups) {
    out.push(formatGroupHeader(group));
    const memberNodes = model.nodes.filter((n) => n.groupId === group.id);
    for (const node of memberNodes) {
      out.push(`  ${formatNodeLine(node)}`);
    }
    out.push('}');
    out.push('');
  }

  // 2. Ungrouped nodes
  const ungroupedNodes = model.nodes.filter((n) => !n.groupId);
  if (ungroupedNodes.length > 0) {
    for (const node of ungroupedNodes) {
      out.push(formatNodeLine(node));
    }
    out.push('');
  }

  // 3. Edges
  if (model.edges.length > 0) {
    for (const edge of model.edges) {
      out.push(formatEdgeLine(edge));
    }
    out.push('');
  }

  // 4. Steps
  for (const step of model.steps) {
    out.push(...formatStepBlock(step));
    out.push('');
  }

  return out.join('\n').trimEnd() + '\n';
}

function formatGroupHeader(group: DiagramGroup): string {
  const attrs: string[] = [];
  if (group.color) attrs.push(`color: ${group.color}`);
  const attrStr = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
  const posStr = ` @pos(${Math.round(group.x)}, ${Math.round(group.y)})`;
  const sizeStr = ` @size(${Math.round(group.width)}, ${Math.round(group.height)})`;
  return `group ${group.id} "${escapeQuotes(group.label)}"${attrStr}${posStr}${sizeStr} {`;
}

function formatNodeLine(node: DiagramNode): string {
  const attrs: string[] = [`icon: ${node.icon}`];
  if (node.sub) attrs.push(`sub: "${escapeQuotes(node.sub)}"`);
  if (node.status && node.status !== 'normal') attrs.push(`status: ${node.status}`);
  if (node.badge) attrs.push(`badge: "${escapeQuotes(node.badge)}"`);
  if (!node.visible) attrs.push(`visible: false`);
  if (node.color) attrs.push(`color: ${node.color}`);

  const attrStr = ` [${attrs.join(', ')}]`;
  const posStr = ` @pos(${Math.round(node.x)}, ${Math.round(node.y)})`;
  return `node ${node.id} "${escapeQuotes(node.label)}"${attrStr}${posStr}`;
}

function formatEdgeLine(edge: DiagramEdge): string {
  const arrow =
    edge.direction === 'bidirectional'
      ? edge.style === 'dashed'
        ? '<-.->'
        : '<-->'
      : edge.style === 'dashed'
        ? '-.->'
        : '-->';

  const labelPart = edge.label ? ` : "${escapeQuotes(edge.label)}"` : '';
  const attrs: string[] = [];
  if (edge.id && !edge.id.startsWith(`e_${edge.from}_${edge.to}_`)) {
    attrs.push(`id: ${edge.id}`);
  }
  if (!edge.visible) attrs.push(`visible: false`);
  if (edge.color) attrs.push(`color: ${edge.color}`);
  const attrPart = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';

  return `${edge.from} ${arrow} ${edge.to}${labelPart}${attrPart}`;
}

function formatStepBlock(step: DiagramStep): string[] {
  const lines: string[] = [];
  lines.push(`step ${step.stepNumber} "${escapeQuotes(step.title)}" {`);
  if (step.description) {
    for (const descLine of step.description.split(/\r?\n/)) {
      lines.push(`  desc "${escapeQuotes(descLine)}"`);
    }
  }
  if (step.focusIds.length > 0) {
    lines.push(`  focus ${step.focusIds.join(', ')}`);
  }
  for (const st of step.states) {
    const attrs: string[] = [];
    if (st.status) attrs.push(`status: ${st.status}`);
    if (st.badge !== undefined) attrs.push(`badge: "${escapeQuotes(st.badge)}"`);
    if (st.visible !== undefined) attrs.push(`visible: ${st.visible}`);
    if (st.color) attrs.push(`color: ${st.color}`);
    if (st.label) attrs.push(`label: "${escapeQuotes(st.label)}"`);
    if (st.sub) attrs.push(`sub: "${escapeQuotes(st.sub)}"`);
    if (attrs.length > 0) {
      lines.push(`  state ${st.targetId} [${attrs.join(', ')}]`);
    }
  }
  for (const anim of step.animations) {
    const arrow = anim.style === 'dashed' ? '-.->' : '-->';
    const labelPart = anim.label ? ` : "${escapeQuotes(anim.label)}"` : '';
    const attrs: string[] = [];
    if (anim.color) attrs.push(`color: ${anim.color}`);
    if (anim.parallel) attrs.push(`parallel: true`);
    const attrPart = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
    lines.push(`  animate ${anim.from} ${arrow} ${anim.to}${labelPart}${attrPart}`);
  }
  lines.push('}');
  return lines;
}

function escapeQuotes(str: string): string {
  return str.replace(/"/g, "'");
}
