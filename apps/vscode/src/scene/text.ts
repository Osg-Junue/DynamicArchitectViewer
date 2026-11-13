import { isWide, type TextStyle, textWidth } from '../model/text';

export { type TextStyle, textWidth };

/** How wide a text is: `textWidth`, an estimate, unless a browser is there to measure it. */
export type TextMeasure = (text: string, fontSize: number, style?: TextStyle) => number;

/** Sizes of the text a node carries. Its labels may take the width of its cell. */
export const NODE_LABEL_SIZE = 14;
export const NODE_SUB_SIZE = 11.5;
export const BADGE_SIZE = 11;
export const BADGE_MAX_WIDTH = 120;

/** Where a line may break: at a space, and before or after a CJK character, a dash or an arrow. */
const isBreakable = (ch: string): boolean =>
  ch === ' ' ||
  ch === '\n' ||
  isWide(ch) ||
  ch === '—' ||
  ch === '→' ||
  ch === '←' ||
  ch === '↔' ||
  ch === '・';

type Script = 'hiragana' | 'katakana' | 'kanji';

/** The script of a Japanese character; undefined for anything else. */
function scriptOf(ch: string): Script | undefined {
  if (ch >= '\u3041' && ch <= '\u309f') return 'hiragana';
  // Katakana and its long vowel mark, but not the middle dot, which separates words.
  if (ch >= '\u30a1' && ch <= '\u30ff' && ch !== '・') return 'katakana';
  if ((ch >= '\u4e00' && ch <= '\u9fff') || (ch >= '\u3400' && ch <= '\u4dbf') || ch === '々') {
    return 'kanji';
  }
  return undefined;
}
/** The particles of one kana that follow a noun in kanji. */
const PARTICLES = new Set([...'をにへがはのとでもやか']);
/** A run of Japanese longer than this, or than a line, may break inside. */
const PHRASE_MAX = 12;

const KINSOKU_OPEN_RE = /^[([{（「『【〈《〔]+$/;
const KINSOKU_TRAILING_OPEN_RE = /^(.+?)([([{（「『【〈《〔]+)$/;
const KINSOKU_CLOSE_RE =
  /^[)\]}）」』】〉》〕。、，．・：；！？…‥ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ]+/;

const isWhitespaceToken = (tok: string): boolean => tok === ' ' || tok === '\n';

/**
 * Enforces CJK/ASCII kinsoku line-breaking rules in three passes:
 * 1. Detach trailing opening brackets from a word (e.g. `WAF(` before `検証`) so they stay with what follows.
 * 2. Attach leading closing punctuation/small kana to the preceding non-whitespace token.
 * 3. Attach opening brackets forward to the next non-whitespace token.
 */
function coalesceKinsokuTokens(raw: readonly string[]): string[] {
  const splitOpen = raw.flatMap((tok, i) => {
    const next = raw[i + 1];
    if (next !== undefined && !isWhitespaceToken(next) && !KINSOKU_OPEN_RE.test(tok)) {
      const match = KINSOKU_TRAILING_OPEN_RE.exec(tok);
      if (match?.[1] && match[2]) return [match[1], match[2]];
    }
    return [tok];
  });

  const afterClose: string[] = [];
  for (const tok of splitOpen) {
    const prev = afterClose[afterClose.length - 1];
    if (
      prev !== undefined &&
      !isWhitespaceToken(prev) &&
      !isWhitespaceToken(tok) &&
      KINSOKU_CLOSE_RE.test(tok)
    ) {
      afterClose[afterClose.length - 1] = prev + tok;
    } else {
      afterClose.push(tok);
    }
  }

  const out: string[] = [];
  let pendingOpen = '';
  for (const tok of afterClose) {
    if (KINSOKU_OPEN_RE.test(tok)) {
      pendingOpen += tok;
      continue;
    }
    if (pendingOpen) {
      if (isWhitespaceToken(tok)) out.push(pendingOpen, tok);
      else out.push(pendingOpen + tok);
      pendingOpen = '';
    } else {
      out.push(tok);
    }
  }
  if (pendingOpen) out.push(pendingOpen);
  return out;
}

/**
 * Cuts a text with an ellipsis so that it fits within `maxWidth`. A space before the ellipsis
 * is dropped, except in code, where every column counts.
 */
export function fitText(
  text: string,
  fontSize: number,
  maxWidth: number,
  style: TextStyle = 'normal',
  measure: TextMeasure = textWidth,
): string {
  if (measure(text, fontSize, style) <= maxWidth) return text;
  let out = '';
  for (const ch of text) {
    if (measure(`${out + ch}…`, fontSize, style) > maxWidth) break;
    out += ch;
  }
  return `${style === 'mono' ? out : out.trimEnd()}…`;
}

/**
 * Wraps text into at most `maxLines` lines that each fit within `maxWidth`.
 * Line breaks in the text are kept; blank lines are dropped to save the limited lines.
 */
export function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
  maxLines = 3,
  style: TextStyle = 'normal',
  measure: TextMeasure = textWidth,
): string[] {
  const clean = text
    .trim()
    .replace(/\s*\n\s*/g, '\n')
    .replace(/[^\S\n]+/g, ' ');
  if (!clean) return [];

  // Japanese has no spaces, but it has phrases: a word in kanji or katakana and the kana after
  // it, as in 注文を, 確定する or サービスへ. A line breaks between phrases, not inside one, so a
  // new piece starts at a kanji that follows kana, and at a change between kanji and katakana.
  const rawTokens: string[] = [];
  let word = '';
  let last: Script | 'other' | undefined;
  let length = 0;
  /** How many hiragana have followed the last kanji; 2 stands for a run that did not follow one. */
  let kanaRun = 0;
  let lastChar = '';
  const flush = () => {
    if (word) rawTokens.push(word);
    word = '';
    length = 0;
  };
  for (const ch of clean) {
    const script = scriptOf(ch);
    if (script) {
      // One kana between two kanji is a particle, as in 注文を確定, or part of a word, as in
      // 引き当て and 書き込み: only a particle ends a phrase.
      const insideWord =
        script === 'kanji' && last === 'hiragana' && kanaRun === 1 && !PARTICLES.has(lastChar);
      const starts =
        last === 'other' ||
        length >= PHRASE_MAX ||
        measure(word + ch, fontSize, style) > maxWidth ||
        (script === 'kanji' && last !== 'kanji' && !insideWord) ||
        (script === 'katakana' && last !== 'katakana');
      if (starts) flush();
      word += ch;
      length++;
      kanaRun =
        script === 'hiragana' ? (last === 'hiragana' ? kanaRun + 1 : last === 'kanji' ? 1 : 2) : 0;
      lastChar = ch;
      last = script;
    } else if (isBreakable(ch)) {
      flush();
      rawTokens.push(ch);
      last = undefined;
    } else {
      if (last !== 'other') flush();
      word += ch;
      last = 'other';
    }
  }
  flush();
  const tokens = coalesceKinsokuTokens(rawTokens);

  const lines: string[] = [];
  let current = '';
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] ?? '';
    if (!current && tok === ' ') continue;
    const candidate = current + tok;
    if (tok === '\n' || (current && measure(candidate, fontSize, style) > maxWidth)) {
      if (lines.length + 1 >= maxLines) {
        const rest = (current + tokens.slice(i).join('')).trim().replace(/\n/g, ' ');
        lines.push(fitText(rest, fontSize, maxWidth, style, measure));
        return lines;
      }
      lines.push(fitText(current.trimEnd(), fontSize, maxWidth, style, measure));
      current = tok === ' ' || tok === '\n' ? '' : tok;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) {
    lines.push(fitText(current.trim(), fontSize, maxWidth, style, measure));
  }
  return lines;
}
