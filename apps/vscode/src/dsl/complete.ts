import { ICON_NAMES, NODE_STATUSES } from '../model/types';
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
  { label: 'status', kind: 'property', insertText: 'status: ', detail: '稼働状態' },
  { label: 'badge', kind: 'property', insertText: 'badge: ""', detail: 'バッジ表示' },
  { label: 'color', kind: 'property', insertText: 'color: #3b82f6', detail: 'カラー (#RRGGBB)' },
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
  detail: 'icon',
}));

const STATUS_COMPLETIONS: readonly DslCompletionItem[] = NODE_STATUSES.map((status) => ({
  label: status,
  kind: 'enum',
  detail: 'status',
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
  return /-\.?->/.test(statementHead) ? 'edge' : null;
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

  // 1. Inside attribute value after `key: `
  const attrValMatch = /\b(icon|status|visible|parallel)\s*:\s*([A-Za-z_]*)$/.exec(beforeOnLine);
  if (attrValMatch) {
    const key = attrValMatch[1];
    const valFrom = pos - (attrValMatch[2]?.length ?? 0);
    if (key === 'icon') return { from: valFrom, to: pos, items: [...ICON_COMPLETIONS] };
    if (key === 'status') return { from: valFrom, to: pos, items: [...STATUS_COMPLETIONS] };
    return { from: valFrom, to: pos, items: [...BOOL_COMPLETIONS] };
  }

  // 2. Inside attribute block `[...` at key position
  const lastOpenBracket = beforeOnLine.lastIndexOf('[');
  const lastCloseBracket = beforeOnLine.lastIndexOf(']');
  if (lastOpenBracket > lastCloseBracket) {
    const insideBrackets = beforeOnLine.slice(lastOpenBracket + 1);
    const afterLastComma = insideBrackets.split(',').pop() ?? '';
    if (!afterLastComma.includes(':')) {
      const owner = attributeOwner(beforeOnLine.slice(0, lastOpenBracket));
      const schema = owner ? ATTRIBUTE_SCHEMA[owner] : undefined;
      const items = schema
        ? ATTRIBUTE_KEYS.filter((key) => Object.hasOwn(schema, key.label))
        : [...ATTRIBUTE_KEYS];
      return { from, to: pos, items };
    }
  }

  // 3. Collect defined node and group IDs from the document
  const { document } = parse(text);
  const idCompletions: DslCompletionItem[] = [
    ...document.nodes.map((n) => ({
      label: n.id,
      kind: 'variable' as const,
      detail: `node "${n.label}"`,
    })),
    ...document.groups.map((g) => ({
      label: g.id,
      kind: 'class' as const,
      detail: `group "${g.label}"`,
    })),
  ];

  // 4. Context expecting an element ID: after arrow, `focus`, `state`, `animate`
  if (
    /(?:-->|-\.->|<-->|<-\.->)\s*[A-Za-z0-9_]*$/.test(beforeOnLine) ||
    /\b(?:focus|state|animate)\b[^[\]{}]*$/.test(beforeOnLine)
  ) {
    return { from, to: pos, items: idCompletions };
  }

  if (!wordMatch && !explicit) return null;

  return {
    from,
    to: pos,
    items: [...STATEMENT_KEYWORDS, ...idCompletions],
  };
}
