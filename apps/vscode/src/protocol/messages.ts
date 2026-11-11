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
    };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function isHostToWebviewMessage(v: unknown): v is HostToWebviewMessage {
  if (!isRecord(v)) return false;
  if (v.type === 'docChanged') {
    return typeof v.dsl === 'string' && (v.uri === undefined || typeof v.uri === 'string');
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
      return true;
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
