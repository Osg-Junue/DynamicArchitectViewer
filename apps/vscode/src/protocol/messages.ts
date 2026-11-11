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

/** What the preview's Export menu offers. */
export type ExportFormat = 'html' | 'svg-animated' | 'svg-still';

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
    }
  | {
      type: 'formatDocument';
    };

export function isHostToWebviewMessage(v: unknown): v is HostToWebviewMessage {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (r.type === 'docChanged') return typeof r.dsl === 'string';
  if (r.type === 'cursorMoved') return typeof r.offset === 'number';
  return false;
}
