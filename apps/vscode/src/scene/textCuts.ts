import { type Layout, NODE_SIZE } from '../layout';
import { EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH } from '../model/text';
import type { DavDocument } from '../model/types';
import { calloutCuts } from './calloutMeasure';
import {
  BADGE_MAX_WIDTH,
  BADGE_SIZE,
  fitText,
  NODE_LABEL_SIZE,
  NODE_SUB_SIZE,
  type TextStyle,
  textTruncated,
} from './text';
import { ZONE_LABEL, zoneLabelRoom } from './zones';

/**
 * A text of a diagram that does not fit where it is drawn, and is shown cut off with an
 * ellipsis. An author cannot see this without rendering, so tools report it.
 */
export type TextCut =
  | { kind: 'node-label' | 'node-sub' | 'node-badge'; node: string; text: string }
  | { kind: 'zone-label'; group: string; text: string }
  | { kind: 'static-label'; step: number; from: string; to: string; text: string }
  | { kind: 'state-badge'; step: number; target: string; text: string }
  | { kind: 'packet-label' | 'packet-desc'; step: number; from: string; to: string; text: string }
  | { kind: 'code-lines'; step: number; from: string; to: string; lines: number }
  | { kind: 'code-width'; step: number; from: string; to: string; line: number };

/** How many lines of code a callout shows before it cuts the rest. */
export { CALLOUT_CODE_MAX_LINES } from './calloutMeasure';

const isCut = (text: string, size: number, width: number, style?: TextStyle): boolean =>
  fitText(text, size, width, style) !== text;

/** Every text of the document that is drawn cut off. Zone names are checked when `layout` is given. */
export function textCuts(doc: DavDocument, layout?: Layout): TextCut[] {
  const cuts: TextCut[] = [];
  const nodeText = NODE_SIZE.width;
  for (const n of doc.nodes) {
    if (textTruncated(n.label, NODE_LABEL_SIZE, nodeText, 2, 'bold')) {
      cuts.push({ kind: 'node-label', node: n.id, text: n.label });
    }
    if (n.sub && isCut(n.sub, NODE_SUB_SIZE, nodeText)) {
      cuts.push({ kind: 'node-sub', node: n.id, text: n.sub });
    }
    if (n.badge && isCut(n.badge, BADGE_SIZE, BADGE_MAX_WIDTH, 'bold')) {
      cuts.push({ kind: 'node-badge', node: n.id, text: n.badge });
    }
  }
  if (layout) {
    for (const g of doc.groups) {
      const rect = layout.groups[g.id];
      if (!rect) continue;
      if (textTruncated(g.label, ZONE_LABEL.size, zoneLabelRoom(rect.width), 2)) {
        cuts.push({ kind: 'zone-label', group: g.id, text: g.label });
      }
    }
  }
  for (const step of doc.steps) {
    for (const state of step.states) {
      if (state.badge && isCut(state.badge, BADGE_SIZE, BADGE_MAX_WIDTH, 'bold')) {
        cuts.push({
          kind: 'state-badge',
          step: step.index,
          target: state.target,
          text: state.badge,
        });
      }
    }
    for (const s of step.statics) {
      if (s.label && isCut(s.label, EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH)) {
        cuts.push({
          kind: 'static-label',
          step: step.index,
          from: s.from,
          to: s.to,
          text: s.label,
        });
      }
    }
    for (const a of step.animations) {
      const at = { step: step.index, from: a.from, to: a.to };
      const cut = calloutCuts(a);
      if (cut.label && a.label) cuts.push({ kind: 'packet-label', ...at, text: a.label });
      if (cut.description && a.description) {
        cuts.push({ kind: 'packet-desc', ...at, text: a.description });
      }
      if (cut.codeLines > 0) cuts.push({ kind: 'code-lines', ...at, lines: cut.codeLines });
      for (const line of cut.wideCodeLines) cuts.push({ kind: 'code-width', ...at, line });
    }
  }
  return cuts;
}
