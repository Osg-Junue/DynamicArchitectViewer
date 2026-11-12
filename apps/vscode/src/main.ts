import './runtime/styles.css';
import './editor/app.css';
import './editor/docs/docs.css';
import { mountApp } from './editor/App';
import { installDevHost } from './editor/devHost';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root');

if (import.meta.env.DEV) installDevHost();
mountApp(rootEl);
