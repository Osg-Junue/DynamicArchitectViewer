import { DEFAULT_SAMPLE } from '../samples';

/** Stands in for the extension host under `vite dev`, where no VS Code surrounds the page. */
export function installDevHost(): void {
  window.acquireVsCodeApi = () => ({
    postMessage(message) {
      if (message.type === 'ready') {
        window.postMessage({ type: 'docChanged', dsl: DEFAULT_SAMPLE.dsl }, '*');
      }
    },
  });
}
