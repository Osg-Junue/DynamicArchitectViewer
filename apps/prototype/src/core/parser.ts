import { isValidIconType } from './icons';
import { applyAutoLayout } from './layout';
import {
  DiagramEdge,
  DiagramGroup,
  DiagramModel,
  DiagramNode,
  DiagramParseDiagnostic,
  DiagramStep,
  EdgeDirection,
  EdgeStyle,
  ElementStateOverride,
  getDefaultNodeSize,
  NodeIconType,
  NodeStatus,
} from './types';

function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const match = raw.match(/\[([^\]]*)\]/);
  if (!match) return attrs;

  const content = match[1];
  // Match key: "quoted value" or key: unquoted_value
  const pairRegex = /([a-zA-Z0-9_-]+)\s*:\s*(?:"([^"]*)"|'([^']*)'|([^,\]]+))/g;
  let m: RegExpExecArray | null;
  while ((m = pairRegex.exec(content)) !== null) {
    const key = m[1].trim();
    const val = (m[2] ?? m[3] ?? m[4] ?? '').trim();
    attrs[key] = val;
  }
  return attrs;
}

function parsePos(raw: string): { x: number; y: number } | null {
  const m = raw.match(/@pos\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/);
  if (!m) return null;
  return { x: Math.round(Number(m[1])), y: Math.round(Number(m[2])) };
}

function parseSize(raw: string): { width: number; height: number } | null {
  const m = raw.match(/@size\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)/);
  if (!m) return null;
  return { width: Math.round(Number(m[1])), height: Math.round(Number(m[2])) };
}

function parseStatus(val?: string): NodeStatus | undefined {
  if (!val) return undefined;
  const v = val.toLowerCase();
  if (v === 'normal' || v === 'active' || v === 'muted' || v === 'warning' || v === 'error') {
    return v;
  }
  return undefined;
}

function parseBool(val?: string, defaultVal = true): boolean {
  if (val === undefined) return defaultVal;
  const v = val.toLowerCase();
  if (v === 'false' || v === '0' || v === 'no' || v === 'hidden') return false;
  if (v === 'true' || v === '1' || v === 'yes' || v === 'visible') return true;
  return defaultVal;
}

function parseArrowToken(token: string): { style: EdgeStyle; direction: EdgeDirection } {
  const style: EdgeStyle = token.includes('.') ? 'dashed' : 'solid';
  const direction: EdgeDirection = token.startsWith('<') ? 'bidirectional' : 'forward';
  return { style, direction };
}

export function parseDsl(dslText: string): DiagramModel {
  const lines = dslText.split(/\r?\n/);
  let title = 'Dynamic Architecture Diagram';
  const groups: DiagramGroup[] = [];
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  const steps: DiagramStep[] = [];
  const diagnostics: DiagramParseDiagnostic[] = [];

  let currentGroup: DiagramGroup | null = null;
  let currentStep: DiagramStep | null = null;
  let autoEdgeCounter = 1;
  let autoStepCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i];
    // Strip line comment outside quotes
    const stripped = stripComment(rawLine).trim();
    if (!stripped) continue;

    // Closing brace
    if (stripped === '}') {
      if (currentStep) {
        steps.push(currentStep);
        currentStep = null;
      } else if (currentGroup) {
        groups.push(currentGroup);
        currentGroup = null;
      } else {
        diagnostics.push({
          line: lineNum,
          message: '対応する開始ブロックのない "}" です。',
          severity: 'warning',
        });
      }
      continue;
    }

    // Inside a `step` block
    if (currentStep) {
      parseStepLine(stripped, lineNum, currentStep, edges, diagnostics);
      continue;
    }

    // 1. Diagram title header: diagram "Title" or diagram infra "Title"
    const titleMatch = stripped.match(/^(?:diagram|title)(?:\s+[a-zA-Z0-9_-]+)?\s+"([^"]+)"/i);
    if (titleMatch) {
      title = titleMatch[1];
      continue;
    }

    // 2. Group block header: group <id> "Label" ... {
    const groupMatch = stripped.match(/^group\s+([a-zA-Z0-9_-]+)(?:\s+"([^"]*)")?(.*)$/);
    if (groupMatch) {
      const id = groupMatch[1];
      const label = groupMatch[2] ?? id;
      const rest = groupMatch[3] ?? '';
      const attrs = parseAttributes(rest);
      const pos = parsePos(rest);
      const size = parseSize(rest);

      currentGroup = {
        id,
        label,
        x: pos?.x ?? 60,
        y: pos?.y ?? 60,
        width: size?.width ?? 400,
        height: size?.height ?? 260,
        hasExplicitPos: pos !== null,
        hasExplicitSize: size !== null,
        color: attrs.color,
        line: lineNum,
      };

      if (!stripped.endsWith('{')) {
        groups.push(currentGroup);
        currentGroup = null;
      }
      continue;
    }

    // 3. Step block header: step 1 "Title" { or step "Title" {
    const stepMatch = stripped.match(/^step(?:\s+(\d+|[a-zA-Z0-9_-]+))?(?:\s+"([^"]*)")?\s*\{?$/);
    if (stepMatch && stripped.startsWith('step')) {
      const rawNum = stepMatch[1];
      const stepNum = rawNum && /^\d+$/.test(rawNum) ? Number(rawNum) : autoStepCounter;
      autoStepCounter = Math.max(autoStepCounter, stepNum + 1);
      const stepTitle = stepMatch[2] ?? `Step ${stepNum}`;
      currentStep = {
        id: rawNum ?? `step_${stepNum}`,
        stepNumber: stepNum,
        title: stepTitle,
        description: '',
        focusIds: [],
        states: [],
        animations: [],
        line: lineNum,
      };
      continue;
    }

    // 4. Node definition: node <id> "Label" [attrs] @pos(x, y)
    // Also supports node <id>["Label"]
    const nodeMatch = stripped.match(
      /^node\s+([a-zA-Z0-9_-]+)(?:\s+"([^"]*)"|\["([^"]*)"\])?(.*)$/
    );
    if (nodeMatch) {
      const id = nodeMatch[1];
      const label = nodeMatch[2] ?? nodeMatch[3] ?? id;
      const rest = nodeMatch[4] ?? '';
      const attrs = parseAttributes(rest);
      const pos = parsePos(rest);

      const rawIcon = (attrs.icon ?? attrs.type ?? 'server').toLowerCase();
      const icon: NodeIconType = isValidIconType(rawIcon) ? rawIcon : 'server';
      const defaultSize = getDefaultNodeSize(icon);
      const size = parseSize(rest) ?? defaultSize;
      const status = parseStatus(attrs.status ?? attrs.state) ?? 'normal';
      const visible = parseBool(attrs.visible, true);

      nodes.push({
        id,
        label,
        sub: attrs.sub,
        icon,
        groupId: currentGroup?.id ?? attrs.group,
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
        width: size.width,
        height: size.height,
        hasExplicitPos: pos !== null,
        status,
        badge: attrs.badge,
        visible,
        color: attrs.color,
        line: lineNum,
      });
      continue;
    }

    // 5. Edge definition:
    // Supports:
    // - edge e1: from --> to : "Label" [attrs]
    // - from --> to : "Label" [attrs]
    // - from -->|Label| to [attrs]
    const edgeParsed = parseEdgeStatement(stripped, lineNum, autoEdgeCounter);
    if (edgeParsed) {
      autoEdgeCounter++;
      edges.push(edgeParsed);
      continue;
    }

    diagnostics.push({
      line: lineNum,
      message: `解釈できない構文です: "${stripped}"`,
      severity: 'error',
    });
  }

  // Close any unclosed blocks gracefully
  if (currentStep) {
    steps.push(currentStep);
  }
  if (currentGroup) {
    groups.push(currentGroup);
  }

  const rawModel: DiagramModel = {
    title,
    groups,
    nodes,
    edges,
    steps,
    diagnostics,
  };

  return applyAutoLayout(rawModel, false);
}

function stripComment(line: string): string {
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === '/' && line[i + 1] === '/') {
        return line.slice(0, i);
      }
    }
  }
  return line;
}

function parseEdgeStatement(
  stripped: string,
  lineNum: number,
  autoCounter: number
): DiagramEdge | null {
  // Optional `edge <id>:` prefix
  let rest = stripped;
  let explicitId: string | undefined;

  const prefixMatch = rest.match(/^edge\s+(?:([a-zA-Z0-9_-]+)\s*:\s*)?(.*)$/);
  if (prefixMatch) {
    explicitId = prefixMatch[1];
    rest = prefixMatch[2].trim();
  }

  // Pattern A: from -->|Label| to [attrs]
  const pipeMatch = rest.match(
    /^([a-zA-Z0-9_-]+)\s*(<-\.->|<-->|<->|-\.->|\.\.>|-->|->)\s*\|([^|]*)\|\s*([a-zA-Z0-9_-]+)(.*)$/
  );
  if (pipeMatch) {
    const from = pipeMatch[1];
    const arrow = pipeMatch[2];
    const pipeLabel = pipeMatch[3].trim();
    const to = pipeMatch[4];
    const tail = pipeMatch[5] ?? '';
    const attrs = parseAttributes(tail);
    const { style, direction } = parseArrowToken(arrow);
    const id = explicitId ?? attrs.id ?? `e_${from}_${to}_${autoCounter}`;
    return {
      id,
      from,
      to,
      label: pipeLabel || attrs.label,
      style: attrs.style === 'dashed' ? 'dashed' : style,
      direction,
      color: attrs.color,
      visible: parseBool(attrs.visible, true),
      line: lineNum,
    };
  }

  // Pattern B: from --> to (: "Label" | "Label")? [attrs]
  const stdMatch = rest.match(
    /^([a-zA-Z0-9_-]+)\s*(<-\.->|<-->|<->|-\.->|\.\.>|-->|->)\s*([a-zA-Z0-9_-]+)(.*)$/
  );
  if (stdMatch) {
    const from = stdMatch[1];
    const arrow = stdMatch[2];
    const to = stdMatch[3];
    const tail = (stdMatch[4] ?? '').trim();
    const attrs = parseAttributes(tail);
    const labelMatch = tail.match(/^(?::\s*)?"([^"]*)"/);
    const { style, direction } = parseArrowToken(arrow);
    const id = explicitId ?? attrs.id ?? `e_${from}_${to}_${autoCounter}`;

    return {
      id,
      from,
      to,
      label: labelMatch?.[1] ?? attrs.label,
      style: attrs.style === 'dashed' ? 'dashed' : style,
      direction,
      color: attrs.color,
      visible: parseBool(attrs.visible, true),
      line: lineNum,
    };
  }

  return null;
}

function parseStepLine(
  stripped: string,
  lineNum: number,
  step: DiagramStep,
  edges: DiagramEdge[],
  diagnostics: DiagramParseDiagnostic[]
): void {
  // 1. desc / description
  const descMatch = stripped.match(/^(?:desc|description)\s*:?\s*"([^"]*)"$/i);
  if (descMatch) {
    step.description = step.description
      ? `${step.description}\n${descMatch[1]}`
      : descMatch[1];
    return;
  }

  // 2. focus
  const focusMatch = stripped.match(/^focus\s*:?\s*(.+)$/i);
  if (focusMatch) {
    const rawList = focusMatch[1].replace(/[\[\]]/g, '');
    const ids = rawList
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    step.focusIds.push(...ids);
    return;
  }

  // 3. state <targetId> [status: ..., badge: ..., visible: ...]
  const stateMatch = stripped.match(/^state\s+([a-zA-Z0-9_-]+)\s*:?\s*(.*)$/i);
  if (stateMatch) {
    const targetId = stateMatch[1];
    const attrs = parseAttributes(stateMatch[2]);
    const override: ElementStateOverride = {
      targetId,
      status: parseStatus(attrs.status ?? attrs.state),
      badge: attrs.badge,
      visible: attrs.visible !== undefined ? parseBool(attrs.visible, true) : undefined,
      color: attrs.color,
      label: attrs.label,
      sub: attrs.sub,
    };
    step.states.push(override);
    return;
  }

  // 4. animate / flow:
  // Supports:
  // - animate from --> to : "Label" [color: #..., parallel: true]
  // - animate edgeId : "Label" [color: #...]
  // - flow: e1 -> e2 [label: "...", color: ...]
  const animMatch = stripped.match(/^(?:animate|flow)\s*:?\s*(.+)$/i);
  if (animMatch) {
    const body = animMatch[1].trim();
    const attrs = parseAttributes(body);
    const labelMatch = body.match(/(?::\s*)?"([^"]*)"/);

    // Check if body specifies `from --> to`
    const arrowMatch = body.match(
      /^([a-zA-Z0-9_-]+)\s*(<-\.->|<-->|<->|-\.->|\.\.>|-->|->)\s*([a-zA-Z0-9_-]+)/
    );
    if (arrowMatch) {
      const firstToken = arrowMatch[1];
      const arrow = arrowMatch[2];
      const secondToken = arrowMatch[3];

      // Check if firstToken & secondToken are actually edge IDs (e.g. `flow: e1 -> e2`)
      const firstEdge = edges.find((e) => e.id === firstToken);
      const secondEdge = edges.find((e) => e.id === secondToken);
      if (firstEdge && secondEdge) {
        step.animations.push({
          from: firstEdge.from,
          to: firstEdge.to,
          edgeId: firstEdge.id,
          label: labelMatch?.[1] ?? attrs.label,
          color: attrs.color,
        });
        step.animations.push({
          from: secondEdge.from,
          to: secondEdge.to,
          edgeId: secondEdge.id,
          label: labelMatch?.[1] ?? attrs.label,
          color: attrs.color,
        });
        return;
      }

      const { style } = parseArrowToken(arrow);
      step.animations.push({
        from: firstToken,
        to: secondToken,
        label: labelMatch?.[1] ?? attrs.label,
        color: attrs.color,
        style,
        parallel: parseBool(attrs.parallel, false),
      });
      return;
    }

    // Or single edgeId reference: `animate e1 "Label" [color: ...]`
    const singleIdMatch = body.match(/^([a-zA-Z0-9_-]+)/);
    if (singleIdMatch) {
      const edgeId = singleIdMatch[1];
      const foundEdge = edges.find((e) => e.id === edgeId);
      if (foundEdge) {
        step.animations.push({
          from: foundEdge.from,
          to: foundEdge.to,
          edgeId: foundEdge.id,
          label: labelMatch?.[1] ?? attrs.label,
          color: attrs.color,
          parallel: parseBool(attrs.parallel, false),
        });
        return;
      }
    }
  }

  diagnostics.push({
    line: lineNum,
    message: `stepブロック内で解釈できない行です: "${stripped}"`,
    severity: 'warning',
  });
}
