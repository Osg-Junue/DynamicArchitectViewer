import { ICON_META } from '../model/icons';
import { COLOR_NAMES, COLOR_RESET, ICON_NAMES } from '../model/types';
import { parse } from './analyze';
import type { Locale } from './diagnostics';
import { ARROW_TOKENS, ATTRIBUTE_SCHEMA, type AttrOwner } from './schema';

export type CompletionItemKind = 'keyword' | 'property' | 'constant' | 'variable' | 'class';

export interface DslCompletionItem {
  label: string;
  kind: CompletionItemKind;
  detail?: string;
  insertText?: string;
}

export interface DslCompletionList {
  from: number;
  to: number;
  items: DslCompletionItem[];
}

interface LocalizedItem extends Omit<DslCompletionItem, 'detail'> {
  detail: readonly [ja: string, en: string];
}

const STATEMENT_KEYWORDS: readonly LocalizedItem[] = [
  {
    label: 'node',
    kind: 'keyword',
    detail: ['ノード定義 (node <id> "Label")', 'Node definition (node <id> "Label")'],
  },
  {
    label: 'group',
    kind: 'keyword',
    detail: [
      'グループ定義 (group <id> "Label" { ... })',
      'Group definition (group <id> "Label" { ... })',
    ],
  },
  {
    label: 'step',
    kind: 'keyword',
    detail: ['ステップ定義 (step "Title" { ... })', 'Step definition (step "Title" { ... })'],
  },
  {
    label: 'title',
    kind: 'keyword',
    detail: ['図タイトル (title "Title")', 'Diagram title (title "Title")'],
  },
  {
    label: 'desc',
    kind: 'keyword',
    detail: ['ステップ説明文 (desc "...")', 'Step description (desc "...")'],
  },
  {
    label: 'focus',
    kind: 'keyword',
    detail: ['フォーカス対象ID (focus id1, id2)', 'IDs to focus on (focus id1, id2)'],
  },
  {
    label: 'state',
    kind: 'keyword',
    detail: ['ステップ状態変更 (state <id> [...])', 'State change in a step (state <id> [...])'],
  },
  {
    label: 'animate',
    kind: 'keyword',
    detail: ['パケットアニメーション (animate a --> b)', 'Packet animation (animate a --> b)'],
  },
];

const ANIMATE_BODY_KEYWORDS: readonly LocalizedItem[] = [
  {
    label: 'code',
    kind: 'keyword',
    detail: [
      'コード・ペイロード表示 (code <lang> ``` ... ```)',
      'Code or payload block (code <lang> ``` ... ```)',
    ],
  },
  {
    label: 'desc',
    kind: 'keyword',
    detail: ['アニメーションの説明文 (desc "...")', 'Animation description (desc "...")'],
  },
];

const ATTRIBUTE_KEYS: readonly LocalizedItem[] = [
  { label: 'icon', kind: 'property', insertText: 'icon: ', detail: ['アイコン種別', 'Icon type'] },
  { label: 'sub', kind: 'property', insertText: 'sub: ""', detail: ['サブラベル', 'Sub-label'] },
  {
    label: 'badge',
    kind: 'property',
    insertText: 'badge: ""',
    detail: ['バッジ表示', 'Badge text'],
  },
  { label: 'color', kind: 'property', insertText: 'color: ', detail: ['色の名前', 'Color name'] },
  {
    label: 'visible',
    kind: 'property',
    insertText: 'visible: true',
    detail: ['表示・非表示', 'Shown or hidden'],
  },
  {
    label: 'parallel',
    kind: 'property',
    insertText: 'parallel: true',
    detail: ['直前のアニメーションと同時に再生', 'Play in parallel with previous animation'],
  },
  {
    label: 'desc',
    kind: 'property',
    insertText: 'desc: ""',
    detail: ['アニメーションの説明文', 'Animation step description'],
  },
  {
    label: 'code',
    kind: 'property',
    insertText: 'code: ""',
    detail: ['アニメーションのコード片', 'Animation code snippet'],
  },
  {
    label: 'id',
    kind: 'property',
    insertText: 'id: ',
    detail: ['エッジの明示 ID', 'Explicit edge ID'],
  },
];

const COLOR_DETAIL = ['テーマに合わせて変わる色', 'Color (adapts to the theme)'] as const;
const COLOR_RESET_DETAIL = ['宣言時の色に戻す', 'Back to the declared color'] as const;

const pick = (text: readonly [ja: string, en: string], locale: Locale): string =>
  text[locale === 'ja' ? 0 : 1];

const localized = (items: readonly LocalizedItem[], locale: Locale): DslCompletionItem[] =>
  items.map((item) => ({ ...item, detail: pick(item.detail, locale) }));

const BOOL_COMPLETIONS: readonly DslCompletionItem[] = [
  { label: 'true', kind: 'keyword' },
  { label: 'false', kind: 'keyword' },
];

const ARROW_PATTERN = ARROW_TOKENS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const ANY_ARROW_RE = new RegExp(ARROW_PATTERN);
const AFTER_ARROW_RE = new RegExp(`(?:${ARROW_PATTERN})\\s*\\w*$`);
const ARROW_OR_ANIMATE_RE = new RegExp(`${ARROW_PATTERN}|^\\s*animate\\b`);

/** The statement kind owning an attribute block, from the line text before its `[`. */
function attributeOwner(statementHead: string): AttrOwner | null {
  const keyword = /^\s*(node|group|state|animate)\b/.exec(statementHead)?.[1];
  if (keyword) return keyword as AttrOwner;
  return ANY_ARROW_RE.test(statementHead) ? 'edge' : null;
}

/**
 * Computes context-aware completions at character offset `pos` in a `.dav` document.
 * Pure and editor-agnostic (used by the VS Code CompletionItemProvider and unit tests).
 */
export function computeCompletions(
  text: string,
  pos: number,
  explicit = false,
  locale: Locale = 'en',
): DslCompletionList | null {
  const ctx = scanContext(text, pos);
  if (ctx.inString || ctx.inComment || ctx.inCodeFence) return null;

  const lineStart = text.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
  const beforeOnLine = text.slice(lineStart, pos);

  const wordMatch = /[A-Za-z_][A-Za-z0-9_]*$/.exec(beforeOnLine);
  const from = wordMatch ? pos - wordMatch[0].length : pos;

  // 1. Inside an attribute block, which may span lines.
  const open = ctx.openBracket;
  if (open >= 0) {
    const inside = text.slice(open + 1, pos);
    const owner = attributeOwner(text.slice(text.lastIndexOf('\n', open) + 1, open));
    const value = /\b(icon|color|visible|parallel)\s*:\s*([A-Za-z_]*)$/.exec(inside);
    if (value) {
      const key = value[1];
      const valFrom = pos - (value[2]?.length ?? 0);
      if (key === 'icon') {
        const items = ICON_NAMES.map(
          (name): DslCompletionItem => ({
            label: name,
            kind: 'constant',
            detail: pick(ICON_META[name].description, locale),
          }),
        );
        return { from: valFrom, to: pos, items };
      }
      if (key === 'color') {
        const items = COLOR_NAMES.map(
          (name): DslCompletionItem => ({
            label: name,
            kind: 'constant',
            detail: pick(COLOR_DETAIL, locale),
          }),
        );
        if (owner === 'state') {
          items.push({
            label: COLOR_RESET,
            kind: 'constant',
            detail: pick(COLOR_RESET_DETAIL, locale),
          });
        }
        return { from: valFrom, to: pos, items };
      }
      return { from: valFrom, to: pos, items: [...BOOL_COMPLETIONS] };
    }
    if ((inside.split(',').pop() ?? '').includes(':')) return null;
    const schema = owner ? ATTRIBUTE_SCHEMA[owner] : undefined;
    const keys = schema
      ? ATTRIBUTE_KEYS.filter((key) => Object.hasOwn(schema, key.label))
      : ATTRIBUTE_KEYS;
    return { from, to: pos, items: localized(keys, locale) };
  }

  // 1b. Inside `animate ... { ... }`, only `code` and `desc` statements apply.
  if (ctx.enclosingBlock === 'animate') {
    const stmtStart = Math.max(lineStart, ctx.lastOpenBrace + 1);
    const stmtBefore = text.slice(stmtStart, pos).replace(/"(?:[^"\\]|\\.)*"/g, '""');
    if (/^\s*(?:desc|code)(?:\s|"|`)/.test(stmtBefore)) return null;
    if (!wordMatch && !explicit) return null;
    return {
      from,
      to: pos,
      items: localized(ANIMATE_BODY_KEYWORDS, locale),
    };
  }

  // 2. Outside attributes: strings are irrelevant, and `:` is always followed by a string.
  const code = beforeOnLine.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  if (code.includes(':') || /^\s*(?:node|group|title|step|desc)\b/.test(code)) return null;

  const { document } = parse(text);
  const nodes: DslCompletionItem[] = document.nodes.map((n) => ({
    label: n.id,
    kind: 'variable',
    detail: `node "${n.label}"`,
  }));
  const groups: DslCompletionItem[] = document.groups.map((g) => ({
    label: g.id,
    kind: 'class',
    detail: `group "${g.label}"`,
  }));
  const edges: DslCompletionItem[] = document.edges
    .filter((e) => e.explicitId)
    .map((e) => ({ label: e.id, kind: 'variable', detail: `edge ${e.from} -> ${e.to}` }));

  // 3. Each statement references only the kinds of element the analyzer accepts there.
  if (/^\s*focus\b/.test(code)) return { from, to: pos, items: [...nodes, ...groups] };
  if (/^\s*state\s+\w*$/.test(code))
    return { from, to: pos, items: [...nodes, ...groups, ...edges] };
  if (/^\s*state\b/.test(code)) return null;
  if (AFTER_ARROW_RE.test(code) || /^\s*animate\s+\w*$/.test(code)) {
    return { from, to: pos, items: nodes };
  }
  if (ARROW_OR_ANIMATE_RE.test(code)) return null;

  if (!wordMatch && !explicit) return null;

  return {
    from,
    to: pos,
    items: [...localized(STATEMENT_KEYWORDS, locale), ...nodes, ...groups],
  };
}

type EnclosingBlock = 'top' | 'group' | 'step' | 'animate';

interface ScanContext {
  inString: boolean;
  inComment: boolean;
  inCodeFence: boolean;
  openBracket: number;
  enclosingBlock: EnclosingBlock;
  lastOpenBrace: number;
}

/** Scans lexical state (strings, comments, code fences, brackets, braces) up to `pos`. */
function scanContext(text: string, pos: number): ScanContext {
  let inString = false;
  let inComment = false;
  let inCodeFence = false;
  let openBracket = -1;
  const blockStack: Array<{ kind: EnclosingBlock; pos: number }> = [];
  let stmtKeyword: 'group' | 'step' | 'animate' | 'other' | null = null;
  let atStatementStart = true;

  for (let i = 0; i < pos; i++) {
    const ch = text[i];

    if (inCodeFence) {
      if (ch === '`' && text[i + 1] === '`' && text[i + 2] === '`' && i + 3 <= pos) {
        inCodeFence = false;
        i += 2;
      }
      continue;
    }

    if (inComment) {
      if (ch === '\n') {
        inComment = false;
        if (openBracket < 0) atStatementStart = true;
      }
      continue;
    }

    if (inString) {
      if (ch === '\\') {
        i++;
      } else if (ch === '"' || ch === '\n') {
        inString = false;
        if (ch === '\n' && openBracket < 0) atStatementStart = true;
      }
      continue;
    }

    if (ch === '`' && text[i + 1] === '`' && text[i + 2] === '`' && i + 3 <= pos) {
      inCodeFence = true;
      atStatementStart = false;
      i += 2;
      continue;
    }

    if (ch === '/' && text[i + 1] === '/' && i + 2 <= pos) {
      inComment = true;
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
      atStatementStart = false;
      continue;
    }

    if (ch === '[') {
      openBracket = i;
      atStatementStart = false;
      continue;
    }

    if (ch === ']') {
      openBracket = -1;
      continue;
    }

    if (openBracket >= 0) continue;

    if (ch === '\n') {
      atStatementStart = true;
      continue;
    }

    if (ch === ' ' || ch === '\t' || ch === '\r') {
      continue;
    }

    if (ch === '{') {
      const kind: EnclosingBlock =
        stmtKeyword === 'group' || stmtKeyword === 'step' || stmtKeyword === 'animate'
          ? stmtKeyword
          : 'top';
      blockStack.push({ kind, pos: i });
      stmtKeyword = null;
      atStatementStart = true;
      continue;
    }

    if (ch === '}') {
      blockStack.pop();
      stmtKeyword = null;
      atStatementStart = true;
      continue;
    }

    if (atStatementStart) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i, pos));
      if (m) {
        const word = m[0];
        stmtKeyword = word === 'group' || word === 'step' || word === 'animate' ? word : 'other';
        i += word.length - 1;
      } else {
        stmtKeyword = 'other';
      }
      atStatementStart = false;
    }
  }

  const top = blockStack[blockStack.length - 1];
  return {
    inString,
    inComment,
    inCodeFence,
    openBracket,
    enclosingBlock: top ? top.kind : 'top',
    lastOpenBrace: top ? top.pos : -1,
  };
}
