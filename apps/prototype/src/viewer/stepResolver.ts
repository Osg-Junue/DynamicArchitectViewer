import {
  DiagramEdge,
  DiagramModel,
  DiagramNode,
  EdgeStyle,
  NodeStatus,
} from '../core/types';

export interface Point {
  x: number;
  y: number;
}

export interface CubicBezierPath {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
  svgPath: string;
  midPoint: Point;
}

export interface ResolvedNode extends DiagramNode {
  isFocused: boolean;
  isDimmed: boolean;
}

export interface ResolvedEdge extends DiagramEdge {
  path: CubicBezierPath;
  isFocused: boolean;
  isDimmed: boolean;
  isActiveFlow: boolean;
  activeFlowColor?: string;
}

export interface ResolvedAnimationPhase {
  phaseIndex: number;
  from: string;
  to: string;
  label?: string;
  color: string;
  style: EdgeStyle;
  path: CubicBezierPath;
}

export interface ResolvedDiagramView {
  nodes: ResolvedNode[];
  edges: ResolvedEdge[];
  phases: ResolvedAnimationPhase[];
  totalPhases: number;
}

/**
 * Computes smart connection ports and a cubic Bezier path between two nodes.
 */
export function computeEdgeBezier(fromNode: DiagramNode, toNode: DiagramNode): CubicBezierPath {
  const fromCx = fromNode.x + fromNode.width / 2;
  const fromCy = fromNode.y + fromNode.height / 2;
  const toCx = toNode.x + toNode.width / 2;
  const toCy = toNode.y + toNode.height / 2;

  const dx = toCx - fromCx;
  const dy = toCy - fromCy;

  let p0: Point;
  let p3: Point;
  let p1: Point;
  let p2: Point;

  // Determine whether horizontal or vertical connection is cleaner
  if (Math.abs(dx) >= Math.abs(dy) * 0.85) {
    if (dx >= 0) {
      p0 = { x: fromNode.x + fromNode.width, y: fromCy };
      p3 = { x: toNode.x, y: toCy };
    } else {
      p0 = { x: fromNode.x, y: fromCy };
      p3 = { x: toNode.x + toNode.width, y: toCy };
    }
    const ctrlOffset = Math.max(48, Math.min(160, Math.abs(p3.x - p0.x) * 0.45));
    const sign = dx >= 0 ? 1 : -1;
    p1 = { x: p0.x + ctrlOffset * sign, y: p0.y };
    p2 = { x: p3.x - ctrlOffset * sign, y: p3.y };
  } else {
    if (dy >= 0) {
      p0 = { x: fromCx, y: fromNode.y + fromNode.height };
      p3 = { x: toCx, y: toNode.y };
    } else {
      p0 = { x: fromCx, y: fromNode.y };
      p3 = { x: toCx, y: toNode.y + toNode.height };
    }
    const ctrlOffset = Math.max(40, Math.min(140, Math.abs(p3.y - p0.y) * 0.45));
    const sign = dy >= 0 ? 1 : -1;
    p1 = { x: p0.x, y: p0.y + ctrlOffset * sign };
    p2 = { x: p3.x, y: p3.y - ctrlOffset * sign };
  }

  const svgPath = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;
  const midPoint = getPointOnCubicBezier(p0, p1, p2, p3, 0.5);

  return { p0, p1, p2, p3, svgPath, midPoint };
}

export function getPointOnCubicBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number
): Point {
  const clamped = Math.max(0, Math.min(1, t));
  const u = 1 - clamped;
  const tt = clamped * clamped;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * clamped;

  return {
    x: uuu * p0.x + 3 * uu * clamped * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * clamped * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

/**
 * Resolves node/edge visibility, status overrides, focus dimming, and animation phases
 * for a given step index (or null for overview mode).
 */
export function resolveDiagramStep(
  model: DiagramModel,
  activeStepIndex: number | null
): ResolvedDiagramView {
  const step =
    activeStepIndex !== null && activeStepIndex >= 0 && activeStepIndex < model.steps.length
      ? model.steps[activeStepIndex]
      : null;

  const stateMap = new Map<
    string,
    {
      status?: NodeStatus;
      badge?: string;
      visible?: boolean;
      color?: string;
      label?: string;
      sub?: string;
    }
  >();

  if (step) {
    for (const st of step.states) {
      stateMap.set(st.targetId, {
        ...stateMap.get(st.targetId),
        ...st,
      });
    }
  }

  // Collect all focused node/edge IDs in this step
  const focusedSet = new Set<string>();
  if (step) {
    for (const id of step.focusIds) focusedSet.add(id);
    for (const anim of step.animations) {
      focusedSet.add(anim.from);
      focusedSet.add(anim.to);
    }
    for (const st of step.states) {
      focusedSet.add(st.targetId);
    }
  }

  const hasFocusFilter = step !== null && focusedSet.size > 0;

  // 1. Resolve nodes
  const resolvedNodes: ResolvedNode[] = model.nodes.map((node) => {
    const ov = stateMap.get(node.id);
    const isFocused = step !== null && focusedSet.has(node.id);
    return {
      ...node,
      status: ov?.status ?? node.status,
      badge: ov?.badge !== undefined ? ov.badge : node.badge,
      visible: ov?.visible !== undefined ? ov.visible : node.visible,
      color: ov?.color ?? node.color,
      label: ov?.label ?? node.label,
      sub: ov?.sub ?? node.sub,
      isFocused,
      isDimmed: hasFocusFilter && !isFocused,
    };
  });

  const nodeMap = new Map(resolvedNodes.map((n) => [n.id, n]));

  // 2. Resolve animations and phases
  const phases: ResolvedAnimationPhase[] = [];
  let currentPhaseIdx = -1;

  if (step) {
    step.animations.forEach((anim, idx) => {
      const fromNode = nodeMap.get(anim.from);
      const toNode = nodeMap.get(anim.to);
      if (!fromNode || !toNode) return;

      // Ensure animated endpoints are visible
      fromNode.visible = true;
      toNode.visible = true;

      if (idx === 0 || !anim.parallel) {
        currentPhaseIdx++;
      }

      const path = computeEdgeBezier(fromNode, toNode);
      phases.push({
        phaseIndex: Math.max(0, currentPhaseIdx),
        from: anim.from,
        to: anim.to,
        label: anim.label,
        color: anim.color ?? '#3b82f6',
        style: anim.style ?? 'solid',
        path,
      });
    });
  }

  // 3. Resolve edges
  const resolvedEdges: ResolvedEdge[] = [];
  for (const edge of model.edges) {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!fromNode || !toNode) continue;

    const ov = stateMap.get(edge.id);
    const matchingAnim = phases.find(
      (p) =>
        (p.from === edge.from && p.to === edge.to) ||
        (edge.direction === 'bidirectional' && p.from === edge.to && p.to === edge.from)
    );

    const visible =
      ov?.visible !== undefined
        ? ov.visible
        : matchingAnim
          ? true
          : edge.visible;

    const isFocused =
      step !== null &&
      (focusedSet.has(edge.id) ||
        matchingAnim !== undefined ||
        (focusedSet.has(edge.from) && focusedSet.has(edge.to)));

    const path = computeEdgeBezier(fromNode, toNode);

    resolvedEdges.push({
      ...edge,
      visible,
      color: ov?.color ?? matchingAnim?.color ?? edge.color,
      label: ov?.label ?? edge.label,
      path,
      isFocused,
      isDimmed: hasFocusFilter && !isFocused,
      isActiveFlow: matchingAnim !== undefined,
      activeFlowColor: matchingAnim?.color ?? ov?.color ?? edge.color ?? '#3b82f6',
    });
  }

  return {
    nodes: resolvedNodes,
    edges: resolvedEdges,
    phases,
    totalPhases: currentPhaseIdx + 1,
  };
}
