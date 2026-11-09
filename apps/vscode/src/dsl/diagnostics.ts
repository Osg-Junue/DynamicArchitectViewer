export type Severity = 'error' | 'warning';

export type DiagnosticCode =
  | 'syntax-error'
  | 'unexpected-eof'
  | 'missing-header'
  | 'unsupported-version'
  | 'duplicate-title'
  | 'duplicate-id'
  | 'duplicate-edge'
  | 'undefined-reference'
  | 'reference-kind-mismatch'
  | 'unknown-attribute'
  | 'duplicate-attribute'
  | 'invalid-attribute-value'
  | 'unknown-icon'
  | 'invalid-color'
  | 'invalid-animate-arrow'
  | 'invalid-self-arrow'
  | 'invalid-escape'
  | 'attribute-not-applicable'
  | 'empty-state';

export interface Diagnostic {
  code: DiagnosticCode;
  severity: Severity;
  /** Character offsets into the source text. */
  from: number;
  to: number;
  /** Message arguments (see MESSAGES). */
  args: Readonly<Record<string, string>>;
}

export type Locale = 'ja' | 'en';

const MESSAGES: Record<Locale, Record<DiagnosticCode, string>> = {
  ja: {
    'syntax-error': '構文エラー: "{token}" は解釈できません',
    'unexpected-eof': '入力が途中で終わっています（"}" や "]" の閉じ忘れの可能性があります）',
    'missing-header': '先頭に "dav 1" が必要です',
    'unsupported-version': 'DSL バージョン {version} には対応していません（対応: 1）',
    'duplicate-title': 'title は1回だけ指定できます',
    'duplicate-id': 'ID "{id}" は既に使われています',
    'duplicate-edge':
      '"{from}" から "{to}" へのエッジが重複しています。2本目以降は [id: ...] を指定してください',
    'undefined-reference': '"{id}" は定義されていません',
    'reference-kind-mismatch': '"{id}" は{actual}です（{expected}を指定してください）',
    'unknown-attribute': '属性 "{name}" は{owner}では使えません',
    'duplicate-attribute': '属性 "{name}" が重複しています（後の値が使われます）',
    'invalid-attribute-value': '属性 "{name}" の値が不正です（期待: {expected}）',
    'unknown-icon': 'アイコン "{icon}" は存在しません{suggestion}',
    'invalid-color': '色 "{value}" は不正です{suggestion}（使用可: {names}）',
    'invalid-animate-arrow': 'animate では点線の矢印 "{arrow}" は使えません{suggestion}',
    'invalid-self-arrow': '自己ループに双方向の矢印 "{arrow}" は使えません{suggestion}',
    'invalid-escape': 'エスケープシーケンス "{sequence}" は使えません（使用可: \\" \\\\ \\n \\t）',
    'attribute-not-applicable': '属性 "{name}" は{kind}には適用されません',
    'empty-state': 'state に属性が指定されていません',
  },
  en: {
    'syntax-error': 'Syntax error: unexpected "{token}"',
    'unexpected-eof': 'Unexpected end of input (a closing "}" or "]" may be missing)',
    'missing-header': 'The document must start with "dav 1"',
    'unsupported-version': 'DSL version {version} is not supported (supported: 1)',
    'duplicate-title': 'title can only be specified once',
    'duplicate-id': 'ID "{id}" is already in use',
    'duplicate-edge':
      'Duplicate edge from "{from}" to "{to}". Specify [id: ...] for additional edges',
    'undefined-reference': '"{id}" is not defined',
    'reference-kind-mismatch': '"{id}" is a {actual} (expected {expected})',
    'unknown-attribute': 'Attribute "{name}" is not allowed on {owner}',
    'duplicate-attribute': 'Duplicate attribute "{name}" (the last value wins)',
    'invalid-attribute-value': 'Invalid value for attribute "{name}" (expected {expected})',
    'unknown-icon': 'Unknown icon "{icon}"{suggestion}',
    'invalid-color': 'Invalid color "{value}"{suggestion}. Use one of: {names}',
    'invalid-animate-arrow': 'Dashed arrow "{arrow}" cannot be used in animate{suggestion}',
    'invalid-self-arrow': 'Bidirectional arrow "{arrow}" cannot form a self-loop{suggestion}',
    'invalid-escape': 'Invalid escape sequence "{sequence}" (allowed: \\" \\\\ \\n \\t)',
    'attribute-not-applicable': 'Attribute "{name}" does not apply to a {kind}',
    'empty-state': 'state has no attributes',
  },
};

const KIND_LABELS: Record<Locale, Record<string, string>> = {
  ja: {
    node: 'ノード',
    group: 'グループ',
    edge: 'エッジ',
    state: 'state',
    animate: 'animate',
  },
  en: {
    node: 'node',
    group: 'group',
    edge: 'edge',
    state: 'state',
    animate: 'animate',
  },
};

const SUGGESTION: Record<Locale, string> = {
  ja: '（もしかして "{value}"？）',
  en: ' (did you mean "{value}"?)',
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
    if (KIND_ARGS.has(key)) {
      return raw
        .split(/\s*\|\s*/)
        .map((k) => KIND_LABELS[locale][k] ?? k)
        .join(locale === 'ja' ? '・' : ' or ');
    }
    return raw;
  });
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}
