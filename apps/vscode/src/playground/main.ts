import '../runtime/styles.css';
import '../editor/app.css';
import '../editor/docs/docs.css';
import './playground.css';
import { mountApp } from '../editor/App';
import { html } from '../runtime/dom';
import { DEFAULT_SAMPLE, SAMPLE_TEMPLATES } from '../samples';
import type { PlaygroundEditor } from './editor';
import { installHost } from './host';

const MARKETPLACE =
  'https://marketplace.visualstudio.com/items?itemName=osg-junue.dynamic-architect-viewer';
const REPOSITORY = 'https://github.com/Osg-Junue/DynamicArchitectViewer';

const rootEl = document.getElementById('playground');
if (!rootEl) throw new Error('Missing #playground');

// The preview and the documentation read the language of the page.
const locale = navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
document.documentElement.lang = locale;
const t = (ja: string, en: string): string => (locale === 'ja' ? ja : en);

let text = DEFAULT_SAMPLE.dsl;
let editor: PlaygroundEditor | null = null;

const host = installHost({
  locale,
  text: () => text,
  reveal: (from, to) => editor?.reveal(from, to),
});

const sampleSelect = html(
  'select',
  { class: 'pg-sample', 'aria-label': t('サンプル', 'Sample'), 'data-testid': 'pg-sample' },
  ...SAMPLE_TEMPLATES.map((sample) =>
    html('option', { value: sample.id }, sample.name[locale === 'ja' ? 0 : 1]),
  ),
);
sampleSelect.value = DEFAULT_SAMPLE.id;
sampleSelect.addEventListener('change', () => {
  const sample = SAMPLE_TEMPLATES.find((s) => s.id === sampleSelect.value);
  if (!sample) return;
  if (editor) {
    editor.setText(sample.dsl);
  } else {
    text = sample.dsl;
    host.textChanged();
  }
});

const editorPane = html(
  'section',
  { class: 'pg-editor', 'data-testid': 'pg-editor' },
  html('p', { class: 'pg-loading' }, t('エディタを読み込んでいます…', 'Loading the editor…')),
);
const previewPane = html('section', { class: 'pg-preview', 'data-testid': 'pg-preview' });

rootEl.append(
  html(
    'div',
    { class: 'pg' },
    html(
      'header',
      { class: 'pg-bar' },
      html('h1', { class: 'pg-title' }, 'DynamicArchitectViewer ', html('span', {}, 'Playground')),
      sampleSelect,
      html(
        'nav',
        { class: 'pg-links' },
        html(
          'a',
          { href: MARKETPLACE, target: '_blank', rel: 'noopener' },
          t('VS Code 拡張機能を入れる', 'Get the VS Code extension'),
        ),
        html('a', { href: REPOSITORY, target: '_blank', rel: 'noopener' }, 'GitHub'),
      ),
    ),
    html('main', { class: 'pg-panes' }, editorPane, previewPane),
  ),
);

mountApp(previewPane);

// The editor is large; the diagram plays while it loads.
import('./editor')
  .then(({ createEditor }) => {
    editorPane.replaceChildren();
    editor = createEditor(editorPane, text, locale, {
      textChanged(next) {
        text = next;
        host.textChanged();
      },
      cursorMoved: (offset) => host.cursorMoved(offset),
    });
  })
  .catch((err: unknown) => {
    editorPane.replaceChildren(
      html(
        'p',
        { class: 'pg-loading' },
        t('エディタを読み込めませんでした。', 'The editor could not be loaded.'),
      ),
    );
    console.error('DynamicArchitectViewer:', err);
  });
