import { readFileSync } from 'node:fs';
import { formatDiagnostic, parse } from '../dsl';
import { synthesizedConnections } from '../model/connections';
import type {
  Animation,
  DavConnection,
  DavDocument,
  DavNode,
  DavStep,
  Direction,
  LineStyle,
} from '../model/types';
import { oneLine } from './lines';

/**
 * The outline bundled with the reading skill: what a `.dav` file says, worked out by the
 * extension's own parser and laid out for reading. An agent that reads the source alone has to
 * resolve IDs, nesting, synthesized connections and phase order by itself; the outline does
 * that part, so that the agent can keep to explaining.
 */

const USAGE = 'Usage: node dav-outline.mjs [--json] <file.dav>';

const EXIT_OK = 0;
const EXIT_ERRORS = 1;
const EXIT_USAGE = 2;

interface Phase {
  /** `1`, or `2a` and `2b` for packets that travel together: the numbers the preview shows. */
  number: string;
  from: string;
  to: string;
  arrow: string;
  roundTrip: boolean;
  label?: string;
  desc?: string;
  icon?: string;
  color?: string;
  code?: { lang?: string; title?: string; body: string };
}

interface StaticOutline {
  from: string;
  to: string;
  arrow: string;
  label?: string;
  color?: string;
}

interface StepOutline {
  number: number;
  title: string;
  desc?: string;
  focus: string[];
  /** State overrides active during this step only (v2 steps are self-contained). */
  changes: string[];
  /** Non-moving connections declared in this step. */
  statics: StaticOutline[];
  phases: Phase[];
}

interface Outline {
  title: string;
  counts: { nodes: number; zones: number; edges: number; steps: number };
  zones: ZoneOutline[];
  /** Nodes outside every zone. */
  nodes: NodeOutline[];
  edges: EdgeOutline[];
  entryPoints: string[];
  endPoints: string[];
  unconnected: string[];
  steps: StepOutline[];
  /** Nodes that no step sends a packet to or from, links statically, focuses on or changes. */
  neverInAStep: string[];
  /** Synthesized connections that only appear in `static` statements (no packet rides them). */
  edgesWithoutPackets: string[];
}

interface NodeOutline {
  id: string;
  label: string;
  icon: string;
  sub?: string;
  badge?: string;
  color?: string;
  /** Hidden in overview: the first step that shows it, or 0 when none does. */
  shownFromStep?: number;
}

interface ZoneOutline {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  zones: ZoneOutline[];
  nodes: NodeOutline[];
}

interface EdgeOutline {
  from: string;
  to: string;
  arrow: string;
  animated: boolean;
}

/** The arrow a connection, animation or static link is written with. */
export const arrowOf = (e: { direction: Direction; style: LineStyle }): string =>
  e.direction === 'bidirectional'
    ? e.style === 'dashed'
      ? '<.>'
      : '<->'
    : e.style === 'dashed'
      ? '..>'
      : '-->';

/** The first step that makes a hidden node visible, or 0 when no step does. */
function shownFrom(doc: DavDocument, target: string): number {
  const step = doc.steps.find(
    (s) =>
      s.states.some((st) => st.target === target && st.visible) ||
      s.animations.some((a) => a.from === target || a.to === target) ||
      s.statics.some((st) => st.from === target || st.to === target),
  );
  return step ? step.index + 1 : 0;
}

function phasesOf(step: DavStep): Phase[] {
  const groups: Animation[][] = [];
  for (const a of step.animations) {
    const current = groups[groups.length - 1];
    if (a.parallel && current) current.push(a);
    else groups.push([a]);
  }
  return groups.flatMap((group, index) =>
    group.map((a, i) => {
      const phase: Phase = {
        number: `${index + 1}${group.length > 1 ? String.fromCharCode(97 + i) : ''}`,
        from: a.from,
        to: a.to,
        arrow: arrowOf(a),
        roundTrip: a.direction === 'bidirectional',
      };
      if (a.label) phase.label = a.label;
      if (a.description) phase.desc = a.description;
      if (a.icon) phase.icon = a.icon;
      if (a.color) phase.color = a.color;
      if (a.code?.body.trim()) {
        phase.code = { body: a.code.body.trim() };
        if (a.code.lang) phase.code.lang = a.code.lang;
        if (a.code.title) phase.code.title = a.code.title;
      }
      return phase;
    }),
  );
}

function outlineOf(doc: DavDocument): Outline {
  const connections: DavConnection[] = synthesizedConnections(doc);
  const nodeOutline = (n: DavNode): NodeOutline => {
    const out: NodeOutline = { id: n.id, label: n.label, icon: n.icon };
    if (n.sub) out.sub = n.sub;
    if (n.badge) out.badge = n.badge;
    if (n.color) out.color = n.color;
    if (!n.visible) out.shownFromStep = shownFrom(doc, n.id);
    return out;
  };
  const zoneOutline = (id: string): ZoneOutline => {
    const g = doc.groups.find((group) => group.id === id);
    const out: ZoneOutline = {
      id,
      label: g?.label ?? id,
      zones: doc.groups
        .filter((child) => child.parentId === id)
        .map((child) => zoneOutline(child.id)),
      nodes: doc.nodes.filter((n) => n.parentId === id).map(nodeOutline),
    };
    if (g?.icon) out.icon = g.icon;
    if (g?.color) out.color = g.color;
    return out;
  };

  const edges: EdgeOutline[] = connections.map((e) => ({
    from: e.from,
    to: e.to,
    arrow: arrowOf(e),
    animated: e.animated,
  }));

  // A two-way connection counts in the order it first appeared.
  const real = connections.filter((e) => e.from !== e.to);
  const comesIn = (id: string) => real.some((e) => e.to === id);
  const goesOut = (id: string) => real.some((e) => e.from === id);

  const steps = doc.steps.map((step): StepOutline => {
    const number = step.index + 1;
    const changes = step.states.map((st) => {
      const parts: string[] = [];
      if (st.visible !== undefined) parts.push(st.visible ? 'shown' : 'hidden');
      if (st.badge !== undefined) parts.push(st.badge ? `badge "${st.badge}"` : 'badge removed');
      if (st.color !== undefined) {
        parts.push(st.color === 'none' ? 'color back to its own' : `color ${st.color}`);
      }
      return `${st.target}: ${parts.join(', ')}`;
    });
    const statics: StaticOutline[] = step.statics.map((st) => {
      const out: StaticOutline = { from: st.from, to: st.to, arrow: arrowOf(st) };
      if (st.label) out.label = st.label;
      if (st.color) out.color = st.color;
      return out;
    });
    const out: StepOutline = {
      number,
      title: step.title,
      focus: step.focus,
      changes,
      statics,
      phases: phasesOf(step),
    };
    if (step.description.trim()) out.desc = step.description.trim();
    return out;
  });

  const inSteps = new Set(
    doc.steps.flatMap((s) => [
      ...s.focus,
      ...s.states.map((st) => st.target),
      ...s.animations.flatMap((a) => [a.from, a.to]),
      ...s.statics.flatMap((st) => [st.from, st.to]),
    ]),
  );

  return {
    title: doc.title,
    counts: {
      nodes: doc.nodes.length,
      zones: doc.groups.length,
      edges: connections.length,
      steps: doc.steps.length,
    },
    zones: doc.groups.filter((g) => g.parentId === undefined).map((g) => zoneOutline(g.id)),
    nodes: doc.nodes.filter((n) => n.parentId === undefined).map(nodeOutline),
    edges,
    entryPoints: doc.nodes.filter((n) => goesOut(n.id) && !comesIn(n.id)).map((n) => n.id),
    endPoints: doc.nodes.filter((n) => comesIn(n.id) && !goesOut(n.id)).map((n) => n.id),
    unconnected: doc.nodes.filter((n) => !comesIn(n.id) && !goesOut(n.id)).map((n) => n.id),
    steps,
    neverInAStep:
      doc.steps.length > 0 ? doc.nodes.filter((n) => !inSteps.has(n.id)).map((n) => n.id) : [],
    edgesWithoutPackets:
      doc.steps.length > 0
        ? connections.filter((e) => !e.animated).map((e) => `${e.from} ${arrowOf(e)} ${e.to}`)
        : [],
  };
}

/** The outline as text: Markdown, so that it reads the same to a person and to a model. */
function render(file: string, doc: DavDocument, outline: Outline): string {
  const labelOf = new Map(doc.nodes.map((n) => [n.id, n.label]));
  const named = (id: string) => (labelOf.has(id) ? `${labelOf.get(id)} (${id})` : id);
  // A packet from a node to itself is work the node does on its own, such as a retry.
  const route = (p: Phase) =>
    p.from === p.to
      ? `${named(p.from)} ↻ (on itself)`
      : `${named(p.from)} ${p.roundTrip ? '⇄' : '→'} ${named(p.to)}`;
  const lines: string[] = [];
  const { counts } = outline;

  lines.push(`# ${outline.title || '(no title)'}`);
  lines.push('');
  lines.push(
    `${file}: ${counts.nodes} nodes, ${counts.zones} zones, ${counts.edges} edges, ${counts.steps} steps`,
  );

  const hidden = (from: number | undefined) =>
    from === undefined
      ? ''
      : from === 0
        ? '; hidden, and no step shows it'
        : `; hidden until step ${from}`;
  const nodeLine = (n: NodeOutline, indent: string) =>
    `${indent}- ${n.label} (${n.id}): ${n.icon}${n.sub ? `; ${n.sub}` : ''}${n.badge ? `; badge "${n.badge}"` : ''}${n.color ? `; ${n.color}` : ''}${hidden(n.shownFromStep)}`;
  const zoneLines = (z: ZoneOutline, indent: string) => {
    lines.push(`${indent}- Zone "${z.label}" (${z.id})${z.color ? ` [${z.color}]` : ''}`);
    for (const child of z.zones) zoneLines(child, `${indent}  `);
    for (const n of z.nodes) lines.push(nodeLine(n, `${indent}  `));
  };
  lines.push('', '## Zones and nodes', '');
  for (const z of outline.zones) zoneLines(z, '');
  if (outline.nodes.length > 0) {
    if (outline.zones.length > 0) lines.push('- Outside every zone');
    for (const n of outline.nodes) lines.push(nodeLine(n, outline.zones.length > 0 ? '  ' : ''));
  }

  lines.push('', '## Connections', '');
  lines.push('`-->` one way, `<->` both ways, `..>` and `<.>` the same drawn dashed.', '');
  for (const e of outline.edges) {
    lines.push(`- ${named(e.from)} ${e.arrow} ${named(e.to)}${e.animated ? '' : ' [static only]'}`);
  }
  const list = (title: string, ids: readonly string[], name = named) => {
    if (ids.length > 0) lines.push(`${title}: ${ids.map(name).join(', ')}`);
  };
  lines.push('');
  list('Entry points (nothing points at them)', outline.entryPoints);
  list('End points (they point at nothing)', outline.endPoints);
  list('Not connected to anything', outline.unconnected);

  if (outline.steps.length > 0) {
    lines.push('', '## Steps', '');
    lines.push(
      'Packets are listed in the order they travel. Packets with the same number and a letter (2a, 2b) travel at the same time.',
    );
    for (const step of outline.steps) {
      lines.push('', `### Step ${step.number}: ${step.title}`, '');
      if (step.desc) lines.push(step.desc.replace(/\n/g, ' '), '');
      if (step.focus.length > 0) lines.push(`Focus: ${step.focus.map(named).join(', ')}`);
      for (const change of step.changes) lines.push(`State in this step: ${change}`);
      for (const st of step.statics) {
        const extra = st.color ? ` [${st.color}]` : '';
        lines.push(
          `Static link: ${named(st.from)} ${st.arrow} ${named(st.to)}${st.label ? ` : "${st.label}"` : ''}${extra}`,
        );
      }
      if (step.focus.length + step.changes.length + step.statics.length > 0) lines.push('');
      for (const p of step.phases) {
        const dashed = p.arrow === '..>' || p.arrow === '<.>' ? 'dashed' : '';
        const extra = [p.icon ? `carries ${p.icon}` : '', p.color ?? '', dashed]
          .filter(Boolean)
          .join('; ');
        lines.push(
          `${p.number}. ${route(p)}${p.label ? ` : "${p.label}"` : ''}${p.roundTrip ? ' (there and back)' : ''}${extra ? ` [${extra}]` : ''}`,
        );
        if (p.desc) lines.push(`   ${p.desc.replace(/\n/g, ' ')}`);
        if (p.code) {
          const head = [p.code.lang, p.code.title].filter(Boolean).join(' · ');
          lines.push(`   code${head ? ` (${head})` : ''}:`);
          for (const line of p.code.body.split('\n')) lines.push(`     ${line}`);
        }
      }
      if (step.phases.length === 0) lines.push('No packet travels in this step.');
    }
  }

  if (outline.neverInAStep.length > 0 || outline.edgesWithoutPackets.length > 0) {
    lines.push('', '## Not part of any step', '');
    list('Nodes no step touches', outline.neverInAStep);
    list('Edges no packet rides', outline.edgesWithoutPackets, (edge) => edge);
  }
  // Each entry is one line of the outline: a label with a line break in it stays on its line,
  // and cannot pass for a heading or a line of its own.
  return `${lines.map(oneLine).join('\n')}\n`;
}

/** Prints the outline of the file in its arguments and returns the exit code. `usage` names the command. */
export function runOutline(args: readonly string[], usage = USAGE): number {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage);
    return EXIT_OK;
  }
  const files = args.filter((arg) => arg !== '--json');
  const [file] = files;
  if (files.length !== 1 || !file || file.startsWith('-')) {
    console.error(usage);
    return EXIT_USAGE;
  }

  let text: string;
  try {
    // VS Code ignores a byte order mark, and some shells write one.
    text = readFileSync(file, 'utf8').replace(/^﻿/, '');
  } catch (error) {
    console.error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT_USAGE;
  }

  const { document, diagnostics } = parse(text);
  const outline = outlineOf(document);
  console.log(
    args.includes('--json') ? JSON.stringify(outline, null, 2) : render(file, document, outline),
  );
  // The outline still describes what could be read; the reader should know it may be partial.
  const errors = diagnostics.filter((d) => d.severity === 'error');
  for (const d of errors) {
    console.error(oneLine(`${file}: error ${d.code}: ${formatDiagnostic(d)}`));
  }
  return errors.length > 0 ? EXIT_ERRORS : EXIT_OK;
}
