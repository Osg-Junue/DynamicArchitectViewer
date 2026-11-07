import './runtime/styles.css';
import './editor/app.css';
import { mountApp } from './editor/App';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root');

mountApp(rootEl);
