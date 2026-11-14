import { hasFatalError, parse } from '../dsl';
import type { HostToWebviewMessage, WebviewToHostMessage } from '../protocol/messages';
import type { ViewerLocale } from '../runtime/i18n';

/** The one document of the playground, as the preview knows it. */
const DOCUMENT_URI = 'playground:diagram.dav';

export interface HostOptions {
  locale: ViewerLocale;
  /** The text in the editor now. */
  text(): string;
  /** Selects a range of the text and brings it into view. */
  reveal(from: number, to: number): void;
}

export interface Host {
  /** The text changed. */
  textChanged(): void;
  /** The cursor moved to `offset`. */
  cursorMoved(offset: number): void;
}

function download(name: string, type: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Stands in for the extension host, as `window.acquireVsCodeApi`: sends the preview the text of
 * the editor, and saves an export as a download where the extension asks for a file. Install it
 * before the preview is mounted.
 */
export function installHost(options: HostOptions): Host {
  let version = 0;
  const post = (message: HostToWebviewMessage): void => {
    window.postMessage(message, window.location.origin);
  };
  const postDocument = (): void => {
    post({ type: 'docChanged', dsl: options.text(), uri: DOCUMENT_URI, version });
  };

  async function handle(message: WebviewToHostMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        postDocument();
        break;

      case 'revealRange':
        options.reveal(message.from, message.to);
        break;

      case 'exportHtml': {
        if (hasFatalError(parse(message.dsl))) return;
        const { exportHtml } = await import('../exporter');
        const html = await exportHtml(message.dsl, { locale: options.locale });
        download('diagram.html', 'text/html', html);
        break;
      }

      case 'exportSvg': {
        const parsed = parse(message.dsl);
        if (hasFatalError(parsed)) return;
        const { exportSvg } = await import('../exporter');
        const { step } = message;
        const svg = exportSvg(parsed.document, {
          locale: options.locale,
          animate: message.animate,
          camera: message.camera,
          ...(step === null ? {} : { step }),
        });
        download(
          step === null ? 'diagram.svg' : `diagram-step${step + 1}.svg`,
          'image/svg+xml',
          svg,
        );
        break;
      }
    }
  }

  window.acquireVsCodeApi = () => ({
    postMessage(message) {
      handle(message).catch((err: unknown) => {
        console.error('DynamicArchitectViewer:', err);
      });
    },
  });

  return {
    textChanged() {
      version += 1;
      postDocument();
    },
    cursorMoved(offset) {
      post({ type: 'cursorMoved', offset });
    },
  };
}
