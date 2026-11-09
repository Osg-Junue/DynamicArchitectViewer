import { EXPORT_DATA_ELEMENT_ID, EXPORT_FORMAT, EXPORT_FORMAT_VERSION } from './export';

export type ImportResult =
  | { ok: true; dsl: string; source: 'html' | 'dsl' }
  | { ok: false; reason: 'unrecognized-html' | 'unsupported-version' | 'corrupt' };

/**
 * Extracts DSL from an exported HTML file or returns plain DSL text as is.
 * Only our own export format is recognized; the embedded JSON is never executed.
 */
export function importContent(content: string): ImportResult {
  // No DSL statement starts with `<`, so anything that does is markup.
  if (!content.trimStart().startsWith('<')) return { ok: true, dsl: content, source: 'dsl' };

  const match = new RegExp(
    `<script type="application/json" id="${EXPORT_DATA_ELEMENT_ID}">([\\s\\S]*?)</script>`,
  ).exec(content);
  if (!match?.[1]) return { ok: false, reason: 'unrecognized-html' };

  let payload: unknown;
  try {
    payload = JSON.parse(match[1]);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  if (!isRecord(payload) || payload.format !== EXPORT_FORMAT) {
    return { ok: false, reason: 'unrecognized-html' };
  }
  if (typeof payload.version !== 'number' || payload.version > EXPORT_FORMAT_VERSION) {
    return { ok: false, reason: 'unsupported-version' };
  }
  if (typeof payload.dsl !== 'string') return { ok: false, reason: 'corrupt' };
  return { ok: true, dsl: payload.dsl, source: 'html' };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
