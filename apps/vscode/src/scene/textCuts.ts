import { NODE_SIZE } from '../layout';
import { EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH } from '../model/text';
import type { DavDocument } from '../model/types';
import { calloutCuts } from './calloutMeasure';
import {
  BADGE_MAX_WIDTH,
  BADGE_SIZE,
  fitText,
  NODE_LABEL_SIZE,
  NODE_SUB_SIZE,
  NODE_TEXT_INSET,
} from './text';

/**
 * A text of a diagram that does not fit where it is drawn, and is shown cut off with an
 * ellipsis. An author cannot see this without rendering, so tools report it.
 */
export type TextCut =
  | { kind: 'node-label' | 'node-sub' | 'node-badge'; node: string; text: string }
  | { kind: 'edge-label'; from: string; to: string; text: string }
  | { kind: 'state-badge'; step: number; target: string; text: string }
  | { kind: 'packet-label' | 'packet-desc'; step: number; from: string; to: string; text: string }
  | { kind: 'code-lines'; step: number; from: string; to: string; lines: number }
  | { kind: 'code-width'; step: number; from: string; to: string; line: number };

/** How many lines of code a callout shows before it cuts the rest. */
export { CALLOUT_CODE_MAX_LINES } from './calloutMeasure';

const isCut = (text: string, size: number, width: number): boolean =>
  fitText(text, size, width) !== text;

/** Every text of the document that is drawn cut off. Zone names are left out: their room depends on the layout. */
export function textCuts(doc: DavDocument): TextCut[] {
  const cuts: TextCut[] = [];
  const nodeText = NODE_SIZE.width - NODE_TEXT_INSET;
  for (const n of doc.nodes) {
    if (isCut(n.label, NODE_LABEL_SIZE, nodeText)) {
      cuts.push({ kind: 'node-label', node: n.id, text: n.label });
    }
    if (n.sub && isCut(n.sub, NODE_SUB_SIZE, nodeText)) {
      cuts.push({ kind: 'node-sub', node: n.id, text: n.sub });
    }
    if (n.badge && isCut(n.badge, BADGE_SIZE, BADGE_MAX_WIDTH)) {
      cuts.push({ kind: 'node-badge', node: n.id, text: n.badge });
    }
  }
  for (const e of doc.edges) {
    if (e.label && isCut(e.label, EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH)) {
      cuts.push({ kind: 'edge-label', from: e.from, to: e.to, text: e.label });
    }
  }
  for (const step of doc.steps) {
    for (const state of step.states) {
      if (state.badge && isCut(state.badge, BADGE_SIZE, BADGE_MAX_WIDTH)) {
        cuts.push({
          kind: 'state-badge',
          step: step.index,
          target: state.target,
          text: state.badge,
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
