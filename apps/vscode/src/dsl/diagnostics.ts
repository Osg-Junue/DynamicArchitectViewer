import type { DavLocale } from '../model/types';

export type Severity = 'error' | 'warning';

export type DiagnosticCode =
  | 'syntax-error'
  | 'unexpected-eof'
  | 'missing-step'
  | 'duplicate-title'
  | 'duplicate-id'
  | 'undefined-reference'
  | 'reference-kind-mismatch'
  | 'unknown-attribute'
  | 'duplicate-attribute'
  | 'invalid-attribute-value'
  | 'unknown-icon'
  | 'invalid-color'
  | 'invalid-self-arrow'
  | 'invalid-escape'
  | 'attribute-not-applicable'
  | 'empty-state'
  | 'duplicate-code';

export interface Diagnostic {
  code: DiagnosticCode;
  severity: Severity;
  /** Character offsets into the source text. */
  from: number;
  to: number;
  /** Message arguments (see MESSAGES). */
  args: Readonly<Record<string, string>>;
}

export type Locale = DavLocale;

const MESSAGES: Record<Locale, Record<DiagnosticCode, string>> = {
  ja: {
    'syntax-error': '構文エラー: "{token}" は解釈できません{hint}',
    'unexpected-eof': '入力が途中で終わっています（"}" や "]" の閉じ忘れの可能性があります）',
    'missing-step': 'step が1つも定義されていません（少なくとも1つの step が必要です）',
    'duplicate-title': 'title は1回だけ指定できます',
    'duplicate-id': 'ID "{id}" は既に使われています',
    'undefined-reference': '"{id}" は定義されていません',
    'reference-kind-mismatch': '"{id}" は{actual}です（{expected}を指定してください）',
    'unknown-attribute': '属性 "{name}" は{owner}では使えません',
    'duplicate-attribute': '属性 "{name}" が重複しています（無視されなかった最後の値が使われます）',
    'invalid-attribute-value': '属性 "{name}" の値が不正です（期待: {expected}）',
    'unknown-icon': 'アイコン "{icon}" は存在しません{suggestion}',
    'invalid-color': '色 "{value}" は不正です{suggestion}（使用可: {names}）',
    'invalid-self-arrow': '自己ループに双方向の矢印 "{arrow}" は使えません{suggestion}',
    'invalid-escape': 'エスケープシーケンス "{sequence}" は使えません（使用可: \\" \\\\ \\n \\t）',
    'attribute-not-applicable': '属性 "{name}" は{kind}には適用されません',
    'empty-state': 'state に属性が指定されていません',
    'duplicate-code':
      'code は1つの animate に1つだけ指定できます（空でない最後のものが使われます）',
  },
  en: {
    'syntax-error': 'Syntax error: unexpected "{token}"{hint}',
    'unexpected-eof': 'Unexpected end of input (a closing "}" or "]" may be missing)',
    'missing-step': 'At least one step is required',
    'duplicate-title': 'title can only be specified once',
    'duplicate-id': 'ID "{id}" is already in use',
    'undefined-reference': '"{id}" is not defined',
    'reference-kind-mismatch': '"{id}" is {actual} (expected {expected})',
    'unknown-attribute': 'Attribute "{name}" is not allowed on {owner}',
    'duplicate-attribute':
      'Duplicate attribute "{name}" (the last value that is not ignored is used)',
    'invalid-attribute-value': 'Invalid value for attribute "{name}" (expected {expected})',
    'unknown-icon': 'Unknown icon "{icon}"{suggestion}',
    'invalid-color': 'Invalid color "{value}"{suggestion}. Use one of: {names}',
    'invalid-self-arrow': 'Bidirectional arrow "{arrow}" cannot form a self-loop{suggestion}',
    'invalid-escape': 'Invalid escape sequence "{sequence}" (allowed: \\" \\\\ \\n \\t)',
    'attribute-not-applicable': 'Attribute "{name}" does not apply to {kind}',
    'empty-state': 'state has no attributes',
    'duplicate-code':
      'Only one code block is allowed per animate (the last one that is not empty is used)',
  },
};

const KIND_LABELS: Record<Locale, Record<string, string>> = {
  ja: {
    node: 'ノード',
    group: 'グループ',
    state: 'state',
    animate: 'animate',
    static: 'static',
  },
  // With their article, which depends on the word: "a node", "an animate".
  en: {
    node: 'a node',
    group: 'a group',
    state: 'a state',
    animate: 'an animate',
    static: 'a static',
  },
};

const SUGGESTION: Record<Locale, string> = {
  ja: '（もしかして "{value}"？）',
  en: ' (did you mean "{value}"?)',
};

/** Every diagnostic code, as the specification has to list them. */
export const DIAGNOSTIC_CODES = Object.keys(MESSAGES.en) as DiagnosticCode[];

/** What a syntax error most likely means, where the parser can tell (`hint` of `syntax-error`). */
const HINTS: Record<Locale, Record<string, string>> = {
  ja: {
    'code-title':
      '。1行形式の code にはタイトルを付けられません。{title} がタイトルなら消すか、タイトルを残すならコードを ``` の行で囲んでください',
    'v1-header': '。.dav v2 にヘッダはありません。この行を消してください',
    'v1-edge':
      '。v2 では接続を step の中に書きます。パケットが通るなら animate {title}、通らないなら static {title}',
  },
  en: {
    'code-title':
      '. A one-line code takes no title: if {title} is one, remove it, or put the code between lines of ``` to keep it',
    'v1-header': '. A .dav v2 file has no header: remove this line',
    'v1-edge':
      '. In v2 a connection is written inside a step: animate {title} when a packet travels it, static {title} when none does',
  },
};

const KIND_ARGS = new Set(['owner', 'kind', 'actual', 'expected']);

/** Renders a diagnostic message in the given locale. */
export function formatDiagnostic(diagnostic: Diagnostic, locale: Locale = 'en'): string {
  const template = MESSAGES[locale][diagnostic.code];
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const raw = diagnostic.args[key] ?? '';
    if (key === 'suggestion') {
      return raw ? SUGGESTION[locale].replace('{value}', raw) : '';
    }
    if (key === 'hint') {
      // A function, so that a `$` in the title is not read as a pattern of the replacement.
      return (HINTS[locale][raw] ?? '').replaceAll('{title}', () => diagnostic.args.title ?? '');
    }
    if (KIND_ARGS.has(key)) {
      return raw
        .split(/\s*\|\s*/)
        .map((k) => KIND_LABELS[locale][k] ?? k)
        .join(locale === 'ja' ? '・' : ' or ');
    }
    return raw;
  });
}
