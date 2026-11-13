import { readFileSync } from 'node:fs';
import { formatDiagnostic, parse } from '../dsl';
import type { Animation, DavDocument, DavEdge, DavNode, DavStep } from '../model/types';
import { carries } from './packets';

/**
 * The outline bundled with the reading skill: what a `.dav` file says, worked out by the
 * extension's own parser and laid out for reading. An agent that reads the source alone has to
 * resolve IDs, nesting, the order of phases and which state is still in effect by itself;
 * the outline does that part, so that the agent can keep to explaining.
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
  roundTrip: boolean;
  label?: string;
  desc?: string;
  icon?: string;
  color?: string;
  code?: { lang?: string; title?: string; body: string };
  /** The declared edge the packet rides, as `from --> to`; absent when no edge joins the two. */
  edge?: string;
}

interface StepOutline {
  number: number;
  title: string;
  desc?: string;
  focus: string[];
  /** What this step changes; it stays that way in the later steps. */
  changes: string[];
  /** Badges and colors set by earlier steps that still show in this one. */
  stillShowing: string[];
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
  /** Nodes that no step sends a packet to or from, focuses on or changes. */
  neverInAStep: string[];
  /** Declared edges that no packet rides. */
  edgesWithoutPackets: string[];
}

interface NodeOutline {
  id: string;
  label: string;
  icon: string;
  sub?: string;
  badge?: string;
  color?: string;
  /** Hidden at first: the number of the step that shows it, or 0 when none does. */
  shownFromStep?: number;
}

interface ZoneOutline {
  id: string;
  label: string;
  color?: string;
  zones: ZoneOutline[];
  nodes: NodeOutline[];
}

interface EdgeOutline {
  from: string;
  to: string;
  arrow: string;
  label?: string;
  id?: string;
  color?: string;
  shownFromStep?: number;
}

const arrowOf = (e: DavEdge): string =>
  e.direction === 'bidirectional'
    ? e.style === 'dashed'
      ? '<.>'
      : '<->'
    : e.style === 'dashed'
      ? '..>'
      : '-->';

/** The step that first makes a hidden element visible: its number, or 0 when no step does. */
function shownFrom(doc: DavDocument, target: string): number {
  const step = doc.steps.find((s) => s.states.some((st) => st.target === target && st.visible));
  return step ? step.index + 1 : 0;
}

function phasesOf(doc: DavDocument, step: DavStep): Phase[] {
  const groups: Animation[][] = [];
  for (const a of step.animations) {
    const current = groups[groups.length - 1];
    if (a.parallel && current) current.push(a);
    else groups.push([a]);
  }
  return groups.flatMap((group, index) =>
    group.map((a, i) => {
      const edge = doc.edges.find((e) => carries(e, a));
      const phase: Phase = {
        number: `${index + 1}${group.length > 1 ? String.fromCharCode(97 + i) : ''}`,
        from: a.from,
        to: a.to,
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
      if (edge) phase.edge = `${edge.from} ${arrowOf(edge)} ${edge.to}`;
      return phase;
    }),
  );
}

function outlineOf(doc: DavDocument): Outline {
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
    if (g?.color) out.color = g.color;
    return out;
  };

  const edges = doc.edges.map((e) => {
    const out: EdgeOutline = { from: e.from, to: e.to, arrow: arrowOf(e) };
    if (e.label) out.label = e.label;
    if (e.explicitId) out.id = e.id;
    if (e.color) out.color = e.color;
    if (!e.visible) out.shownFromStep = shownFrom(doc, e.id);
    return out;
  });

  // A two-way edge counts the way it is written: its left side is the one that calls.
  const real = doc.edges.filter((e) => e.from !== e.to);
  const comesIn = (id: string) => real.some((e) => e.to === id);
  const goesOut = (id: string) => real.some((e) => e.from === id);

  // What is in effect, carried from step to step: a badge or a color lasts until a step changes
  // that very attribute, so each is remembered with the step that set it.
  type Carried = { value: string; since: number };
  const inEffect = new Map<string, { badge?: Carried; color?: Carried }>();
  const steps = doc.steps.map((step): StepOutline => {
    const number = step.index + 1;
    const changes = step.states.map((st) => {
      const parts: string[] = [];
      if (st.visible !== undefined) parts.push(st.visible ? 'shown' : 'hidden');
      if (st.badge !== undefined) parts.push(st.badge ? `badge "${st.badge}"` : 'badge removed');
      if (st.color !== undefined) {
        parts.push(st.color === 'none' ? 'color back to its own' : `color ${st.color}`);
      }
      const now = { ...inEffect.get(st.target) };
      if (st.badge !== undefined) {
        if (st.badge) now.badge = { value: st.badge, since: number };
        else delete now.badge;
      }
      if (st.color !== undefined) {
        if (st.color === 'none') delete now.color;
        else now.color = { value: st.color, since: number };
      }
      inEffect.set(st.target, now);
      return `${st.target}: ${parts.join(', ')}`;
    });
    // Whatever an earlier step set and this one left alone.
    const stillShowing = [...inEffect].flatMap(([target, state]) => {
      const kept = [
        state.badge && state.badge.since < number
          ? `badge "${state.badge.value}" (since step ${state.badge.since})`
          : '',
        state.color && state.color.since < number
          ? `color ${state.color.value} (since step ${state.color.since})`
          : '',
      ].filter(Boolean);
      return kept.length > 0 ? [`${target}: ${kept.join(', ')}`] : [];
    });
    const out: StepOutline = {
      number,
      title: step.title,
      focus: step.focus,
      changes,
      stillShowing,
      phases: phasesOf(doc, step),
    };
    if (step.description.trim()) out.desc = step.description.trim();
    return out;
  });

  const inSteps = new Set(
    doc.steps.flatMap((s) => [
      ...s.focus,
      ...s.states.map((st) => st.target),
      ...s.animations.flatMap((a) => [a.from, a.to]),
    ]),
  );
  const ridden = (e: DavEdge) => doc.steps.some((s) => s.animations.some((a) => carries(e, a)));

  return {
    title: doc.title,
    counts: {
      nodes: doc.nodes.length,
      zones: doc.groups.length,
      edges: doc.edges.length,
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
        ? doc.edges.filter((e) => !ridden(e)).map((e) => `${e.from} ${arrowOf(e)} ${e.to}`)
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
    const extra = [
      e.id ? `id ${e.id}` : '',
      e.color ?? '',
      hidden(e.shownFromStep).slice(2),
    ].filter(Boolean);
    lines.push(
      `- ${named(e.from)} ${e.arrow} ${named(e.to)}${e.label ? ` : "${e.label}"` : ''}${extra.length > 0 ? ` [${extra.join('; ')}]` : ''}`,
    );
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
      for (const change of step.changes) lines.push(`Changes from this step on: ${change}`);
      for (const state of step.stillShowing) lines.push(`Still showing: ${state}`);
      if (step.focus.length + step.changes.length + step.stillShowing.length > 0) lines.push('');
      for (const p of step.phases) {
        const extra = [
          p.icon ? `carries ${p.icon}` : '',
          p.color ?? '',
          p.edge ? '' : 'no declared edge',
        ]
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
  return `${lines.join('\n')}\n`;
}

function main(args: readonly string[]): number {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return EXIT_OK;
  }
  const files = args.filter((arg) => arg !== '--json');
  const [file] = files;
  if (files.length !== 1 || !file || file.startsWith('-')) {
    console.error(USAGE);
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
  for (const d of errors) console.error(`${file}: error ${d.code}: ${formatDiagnostic(d)}`);
  return errors.length > 0 ? EXIT_ERRORS : EXIT_OK;
}

process.exitCode = main(process.argv.slice(2));
