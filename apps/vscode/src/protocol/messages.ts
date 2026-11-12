export const INITIAL_DOC_ELEMENT_ID = 'dav-initial-doc';

export interface InitialDocPayload {
  dsl: string;
  uri?: string;
  version?: number;
}

export type HostToWebviewMessage =
  | {
      type: 'docChanged';
      dsl: string;
      uri?: string;
      version?: number;
    }
  | {
      type: 'cursorMoved';
      offset: number;
    };

/** Where an animated SVG's camera looks (see `SvgExportOptions.camera`). */
export type SvgCamera = 'follow' | 'whole';

export type WebviewToHostMessage =
  | {
      type: 'ready';
      uri?: string;
      version?: number;
    }
  | {
      type: 'revealRange';
      from: number;
      to: number;
    }
  | {
      type: 'exportHtml';
      dsl: string;
    }
  | {
      type: 'exportSvg';
      dsl: string;
      animate: boolean;
      camera: SvgCamera;
      /** The one step to export (0-based), or `null` for every step. */
      step: number | null;
    };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isOptionalString(v: unknown): v is string | undefined {
  return v === undefined || typeof v === 'string';
}

function isOptionalFiniteNumber(v: unknown): v is number | undefined {
  return v === undefined || (typeof v === 'number' && Number.isFinite(v));
}

export function isInitialDocPayload(v: unknown): v is InitialDocPayload {
  if (!isRecord(v)) return false;
  return typeof v.dsl === 'string' && isOptionalString(v.uri) && isOptionalFiniteNumber(v.version);
}

/**
 * Escapes `<`, `>`, `&`, U+2028, and U+2029 in a JSON string so `</script>` or `<!--`
 * can never break out of an inline `<script>` tag while remaining valid JSON.
 */
export function escapeJsonForHtml(json: string): string {
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function serializeInitialDoc(payload: InitialDocPayload): string {
  return escapeJsonForHtml(JSON.stringify(payload));
}

export function isHostToWebviewMessage(v: unknown): v is HostToWebviewMessage {
  if (!isRecord(v)) return false;
  if (v.type === 'docChanged') {
    return (
      typeof v.dsl === 'string' && isOptionalString(v.uri) && isOptionalFiniteNumber(v.version)
    );
  }
  if (v.type === 'cursorMoved') {
    return typeof v.offset === 'number' && Number.isFinite(v.offset);
  }
  return false;
}

export function isWebviewToHostMessage(v: unknown): v is WebviewToHostMessage {
  if (!isRecord(v)) return false;
  switch (v.type) {
    case 'ready':
      return isOptionalString(v.uri) && isOptionalFiniteNumber(v.version);
    case 'revealRange':
      return (
        typeof v.from === 'number' &&
        Number.isFinite(v.from) &&
        typeof v.to === 'number' &&
        Number.isFinite(v.to)
      );
    case 'exportHtml':
      return typeof v.dsl === 'string';
    case 'exportSvg':
      return (
        typeof v.dsl === 'string' &&
        typeof v.animate === 'boolean' &&
        (v.camera === 'follow' || v.camera === 'whole') &&
        (v.step === null || (typeof v.step === 'number' && Number.isInteger(v.step) && v.step >= 0))
      );
    default:
      return false;
  }
}
