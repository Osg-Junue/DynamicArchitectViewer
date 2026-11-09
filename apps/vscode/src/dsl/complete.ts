import { ICON_META } from '../model/icons';
import { COLOR_NAMES, COLOR_RESET, ICON_NAMES } from '../model/types';
import { parse } from './analyze';
import { ATTRIBUTE_SCHEMA, type AttrOwner } from './schema';

export type CompletionItemKind =
  | 'keyword'
  | 'property'
  | 'constant'
  | 'enum'
  | 'variable'
  | 'class';

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

const STATEMENT_KEYWORDS: readonly DslCompletionItem[] = [
  { label: 'node', kind: 'keyword', detail: 'ノード定義 (node <id> "Label")' },
  { label: 'group', kind: 'keyword', detail: 'グループ定義 (group <id> "Label" { ... })' },
  { label: 'step', kind: 'keyword', detail: 'ステップ定義 (step "Title" { ... })' },
  { label: 'title', kind: 'keyword', detail: '図タイトル (title "Title")' },
  { label: 'desc', kind: 'keyword', detail: 'ステップ説明文 (desc "...")' },
  { label: 'focus', kind: 'keyword', detail: 'フォーカス対象ID (focus id1, id2)' },
  { label: 'state', kind: 'keyword', detail: 'ステップ状態変更 (state <id> [...])' },
  { label: 'animate', kind: 'keyword', detail: 'パケットアニメーション (animate a --> b)' },
];

const ATTRIBUTE_KEYS: readonly DslCompletionItem[] = [
  { label: 'icon', kind: 'property', insertText: 'icon: ', detail: 'アイコン種別' },
  { label: 'sub', kind: 'property', insertText: 'sub: ""', detail: 'サブラベル' },
  { label: 'badge', kind: 'property', insertText: 'badge: ""', detail: 'バッジ表示' },
  { label: 'color', kind: 'property', insertText: 'color: ', detail: 'Color name' },
  { label: 'visible', kind: 'property', insertText: 'visible: true', detail: '表示・非表示' },
  {
    label: 'parallel',
    kind: 'property',
    insertText: 'parallel: true',
    detail: 'Play in parallel with previous animation',
  },
  {
    label: 'desc',
    kind: 'property',
    insertText: 'desc: ""',
    detail: 'Animation step description',
  },
  { label: 'id', kind: 'property', insertText: 'id: ', detail: 'Explicit edge ID' },
];

const ICON_COMPLETIONS: readonly DslCompletionItem[] = ICON_NAMES.map((name) => ({
  label: name,
  kind: 'constant',
  detail: `${ICON_META[name].description[1]} (${ICON_META[name].description[0]})`,
}));

const COLOR_COMPLETIONS: readonly DslCompletionItem[] = COLOR_NAMES.map((name) => ({
  label: name,
  kind: 'constant',
  detail: 'color (adapts to the theme)',
}));

const BOOL_COMPLETIONS: readonly DslCompletionItem[] = [
  { label: 'true', kind: 'keyword' },
  { label: 'false', kind: 'keyword' },
];

/** Whether the text before the cursor on its line ends inside a string or a line comment. */
function endsInStringOrComment(beforeOnLine: string): boolean {
  let inString = false;
  for (let i = 0; i < beforeOnLine.length; i++) {
    const ch = beforeOnLine[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '/' && beforeOnLine[i + 1] === '/') {
      return true;
    }
  }
  return inString;
}

/** The statement kind owning an attribute block, from the line text before its `[`. */
function attributeOwner(statementHead: string): AttrOwner | null {
  const keyword = /^\s*(node|group|state|animate)\b/.exec(statementHead)?.[1];
  if (keyword) return keyword as AttrOwner;
  return /-->|<->|\.\.>|<\.>/.test(statementHead) ? 'edge' : null;
}

/**
 * Computes context-aware completions at character offset `pos` in a `.dav` document.
 * Pure and editor-agnostic (used by the VS Code CompletionItemProvider and unit tests).
 */
export function computeCompletions(
  text: string,
  pos: number,
  explicit = false,
): DslCompletionList | null {
  const lineStart = text.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
  const beforeOnLine = text.slice(lineStart, pos);
  if (endsInStringOrComment(beforeOnLine)) return null;

  const wordMatch = /[A-Za-z_][A-Za-z0-9_]*$/.exec(beforeOnLine);
  const from = wordMatch ? pos - wordMatch[0].length : pos;

  // 1. Inside an attribute block, which may span lines.
  const open = unclosedBracket(text, pos);
  if (open >= 0) {
    const inside = text.slice(open + 1, pos);
    const owner = attributeOwner(text.slice(text.lastIndexOf('\n', open) + 1, open));
    const value = /\b(icon|color|visible|parallel)\s*:\s*([A-Za-z_]*)$/.exec(inside);
    if (value) {
      const key = value[1];
      const valFrom = pos - (value[2]?.length ?? 0);
      if (key === 'icon') return { from: valFrom, to: pos, items: [...ICON_COMPLETIONS] };
      if (key === 'color') {
        const items = [...COLOR_COMPLETIONS];
        if (owner === 'state') {
          items.push({
            label: COLOR_RESET,
            kind: 'constant',
            detail: 'Back to the declared color',
          });
        }
        return { from: valFrom, to: pos, items };
      }
      return { from: valFrom, to: pos, items: [...BOOL_COMPLETIONS] };
    }
    if ((inside.split(',').pop() ?? '').includes(':')) return null;
    const schema = owner ? ATTRIBUTE_SCHEMA[owner] : undefined;
    const items = schema
      ? ATTRIBUTE_KEYS.filter((key) => Object.hasOwn(schema, key.label))
      : [...ATTRIBUTE_KEYS];
    return { from, to: pos, items };
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
  if (/(?:-->|<->|\.\.>|<\.>)\s*\w*$/.test(code) || /^\s*animate\s+\w*$/.test(code)) {
    return { from, to: pos, items: nodes };
  }
  if (/-->|<->|\.\.>|<\.>|^\s*animate\b/.test(code)) return null;

  if (!wordMatch && !explicit) return null;

  return {
    from,
    to: pos,
    items: [...STATEMENT_KEYWORDS, ...nodes, ...groups],
  };
}

/** Offset of the `[` still open at `pos`, ignoring strings and comments, or -1. */
function unclosedBracket(text: string, pos: number): number {
  let open = -1;
  for (let i = 0; i < pos; i++) {
    const ch = text[i];
    if (ch === '"') {
      for (i++; i < pos && text[i] !== '"' && text[i] !== '\n'; i++) {
        if (text[i] === '\\') i++;
      }
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < pos && text[i] !== '\n') i++;
    } else if (ch === '[') {
      open = i;
    } else if (ch === ']') {
      open = -1;
    }
  }
  return open;
}
