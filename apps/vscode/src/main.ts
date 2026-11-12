import './runtime/styles.css';
import './editor/app.css';
import './editor/docs/docs.css';
import { mountApp } from './editor/App';
import { installDevHost } from './editor/devHost';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root');

// Guards against re-mounting if a lazy chunk imports shared exports from the entry bundle.
if (!rootEl.hasAttribute('data-dav-mounted')) {
  rootEl.setAttribute('data-dav-mounted', '');
  if (import.meta.env.DEV) installDevHost();
  mountApp(rootEl);
}
