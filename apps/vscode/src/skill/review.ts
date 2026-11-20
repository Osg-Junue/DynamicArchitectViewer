import { computeLayout } from '../layout';
import type { Animation, DavDocument, DavStep } from '../model/types';
import { CALLOUT_CODE_MAX_LINES, type TextCut, textCuts } from '../scene/textCuts';
import { arrowOf } from './outline';

/**
 * What `dav-check --detail` reports on a file that already compiles: where a diagram says less
 * than it could, and which texts are drawn cut off. None of it is an error of the language,
 * so the editor does not show it; it is for an agent that writes a diagram without seeing it.
 */
export interface Hint {
  code: string;
  message: string;
}

/** Every code a hint is given with, in the order that the checker's reference lists them. */
export const HINT_CODES = [
  'step-without-desc',
  'empty-step',
  'animate-without-label',
  'animate-without-desc',
  'no-code',
  'text-cut',
] as const;

/** From how many packets on a diagram without any `code` is worth pointing out. */
const CODE_WORTH_FROM = 3;

const stepName = (step: DavStep): string => `step ${step.index + 1} "${step.title}"`;
const packetName = (a: Animation): string => `animate ${a.from} ${arrowOf(a)} ${a.to}`;

function cutHint(cut: TextCut, doc: DavDocument): string {
  const step = 'step' in cut ? doc.steps[cut.step] : undefined;
  const where = step ? `${stepName(step)}: ` : '';
  switch (cut.kind) {
    case 'node-label':
      return `The label of node ${cut.node} is too long for its place and is cut off: "${cut.text}". Shorten it, and move detail into sub.`;
    case 'zone-label':
      return `The label of group ${cut.group} is too long for its zone and is cut off: "${cut.text}". Shorten it.`;
    case 'node-sub':
      return `The sub of node ${cut.node} is too long and is cut off: "${cut.text}". Shorten it.`;
    case 'node-badge':
      return `The badge of node ${cut.node} is too long and is cut off: "${cut.text}". A badge is a word or two.`;
    case 'state-badge':
      return `${where}the badge set on ${cut.target} is too long and is cut off: "${cut.text}". A badge is a word or two.`;
    case 'static-label': {
      const link = step?.statics.find(
        (s) => s.from === cut.from && s.to === cut.to && s.label === cut.text,
      );
      return `${where}the label of static ${cut.from} ${link ? arrowOf(link) : '-->'} ${cut.to} is too long and is cut off: "${cut.text}". Shorten it.`;
    }
    case 'packet-label':
      return `${where}the label of the packet from ${cut.from} to ${cut.to} is too long and is cut off: "${cut.text}". Keep the label short, and move the rest into desc.`;
    case 'packet-desc':
      return `${where}the desc of the packet from ${cut.from} to ${cut.to} is longer than the four lines a callout shows, and is cut off. Shorten it to one or two sentences.`;
    case 'code-lines':
      return `${where}the code of the packet from ${cut.from} to ${cut.to} has ${cut.lines} lines, and a callout shows ${CALLOUT_CODE_MAX_LINES}. Keep the lines that matter.`;
    case 'code-width':
      return `${where}line ${cut.line} of the code of the packet from ${cut.from} to ${cut.to} is too wide and is cut off. Break it, or shorten it to about 55 characters, or 35 Japanese ones.`;
  }
}

export function reviewDetail(doc: DavDocument): Hint[] {
  const hints: Hint[] = [];
  const hint = (code: (typeof HINT_CODES)[number], message: string) => {
    hints.push({ code, message });
  };

  for (const step of doc.steps) {
    if (!step.description.trim()) {
      hint(
        'step-without-desc',
        `${stepName(step)} has no desc. Add one or two sentences that say what happens in it and why.`,
      );
    }
    if (
      step.animations.length === 0 &&
      step.statics.length === 0 &&
      step.states.length === 0 &&
      step.focus.length === 0
    ) {
      hint(
        'empty-step',
        `${stepName(step)} shows nothing: it has no animate, static, state or focus.`,
      );
    }
    for (const a of step.animations) {
      if (!a.label) {
        hint(
          'animate-without-label',
          `${stepName(step)}: ${packetName(a)} has no label. Name what is sent, such as : "POST /orders".`,
        );
      }
      if (!a.description?.trim()) {
        hint(
          'animate-without-desc',
          `${stepName(step)}: ${packetName(a)} has no desc. Add [desc: "..."] that says what this message does or decides.`,
        );
      }
    }
  }
  const packets = doc.steps.flatMap((step) => step.animations);
  if (packets.length >= CODE_WORTH_FROM && !packets.some((a) => a.code?.body.trim())) {
    hint(
      'no-code',
      'No animate shows a code block. Attach the request, query, event or response that matters most to one to three of them.',
    );
  }
  const layout = doc.groups.length > 0 ? computeLayout(doc) : undefined;
  for (const cut of textCuts(doc, layout)) hint('text-cut', cutHint(cut, doc));
  return hints;
}
