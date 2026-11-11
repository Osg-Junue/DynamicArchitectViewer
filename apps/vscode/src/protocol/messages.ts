export type HostToWebviewMessage =
  | {
      type: 'docChanged';
      dsl: string;
      uri?: string;
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
    }
  | {
      type: 'formatDocument';
    };

export function isHostToWebviewMessage(v: unknown): v is HostToWebviewMessage {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (r.type === 'docChanged') {
    return typeof r.dsl === 'string' && (r.uri === undefined || typeof r.uri === 'string');
  }
  if (r.type === 'cursorMoved') {
    return typeof r.offset === 'number' && Number.isFinite(r.offset);
  }
  return false;
}

export function isWebviewToHostMessage(v: unknown): v is WebviewToHostMessage {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  switch (r.type) {
    case 'ready':
    case 'formatDocument':
      return true;
    case 'revealRange':
      return (
        typeof r.from === 'number' &&
        Number.isFinite(r.from) &&
        typeof r.to === 'number' &&
        Number.isFinite(r.to)
      );
    case 'exportHtml':
      return typeof r.dsl === 'string';
    case 'exportSvg':
      return (
        typeof r.dsl === 'string' &&
        typeof r.animate === 'boolean' &&
        (r.camera === 'follow' || r.camera === 'whole') &&
        (r.step === null || (typeof r.step === 'number' && Number.isInteger(r.step) && r.step >= 0))
      );
    default:
      return false;
  }
}
