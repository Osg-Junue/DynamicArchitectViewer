import { type ChangeEvent, useDeferredValue, useMemo, useRef, useState } from 'react';
import { format, formatDiagnostic, parse } from '../dsl';
import { exportHtml, importContent } from '../exporter';
import { computeLayout } from '../layout';
import { SAMPLE_TEMPLATES } from '../samples';
import { PlayerView } from './PlayerView';
import './app.css';

const LOCALE: 'ja' | 'en' = navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';

const T = {
  ja: {
    sample: 'サンプル',
    format: '整形',
    open: '開く',
    export: 'HTML 出力',
    noProblems: '問題はありません',
    importFailed: 'ファイルを読み込めませんでした',
    line: '行',
  },
  en: {
    sample: 'Sample',
    format: 'Format',
    open: 'Open',
    export: 'Export HTML',
    noProblems: 'No problems',
    importFailed: 'Could not read the file',
    line: 'Line',
  },
}[LOCALE];

/**
 * Interim M2 shell: plain text editor + shared player preview + export/import.
 * The full editor (CodeMirror, canvas editing, undo) arrives in M3.
 */
export function App() {
  const [dsl, setDsl] = useState(SAMPLE_TEMPLATES[0]?.dsl ?? 'dav 1\n');
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const deferredDsl = useDeferredValue(dsl);

  const { document, diagnostics } = useMemo(() => parse(deferredDsl), [deferredDsl]);
  const playerData = useMemo(
    () => ({ document, layout: computeLayout(document), dsl: deferredDsl }),
    [document, deferredDsl],
  );

  const lineOf = (offset: number) => dsl.slice(0, offset).split('\n').length;

  const onExport = async () => {
    const htmlText = await exportHtml(dsl, { locale: LOCALE });
    const blob = new Blob([htmlText], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(window.document.createElement('a'), {
      href: url,
      download: `${safeFileName(document.title)}.html`,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = importContent(await file.text());
    if (result.ok) {
      setDsl(result.dsl);
      setNotice(null);
    } else {
      setNotice(`${T.importFailed} (${result.reason})`);
    }
  };

  return (
    <div className="shell">
      <header className="toolbar">
        <strong className="brand">DynamicArchitectViewer</strong>
        <label>
          {T.sample}{' '}
          <select
            onChange={(e) => {
              const sample = SAMPLE_TEMPLATES.find((s) => s.id === e.target.value);
              if (sample) setDsl(sample.dsl);
            }}
          >
            {SAMPLE_TEMPLATES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <span className="spacer" />
        <button type="button" onClick={() => setDsl(format(dsl))}>
          {T.format}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}>
          {T.open}
        </button>
        <input ref={fileRef} type="file" accept=".html,.htm,.dav,.txt" hidden onChange={onImport} />
        <button type="button" className="primary" onClick={onExport}>
          {T.export}
        </button>
      </header>
      {notice && <div className="notice">{notice}</div>}
      <main className="workspace">
        <section className="editor-pane">
          <textarea
            className="dsl-input"
            spellCheck={false}
            value={dsl}
            onChange={(e) => setDsl(e.target.value)}
            aria-label="DSL"
          />
          <ul className="problems" aria-live="polite">
            {diagnostics.length === 0 ? (
              <li className="ok">{T.noProblems}</li>
            ) : (
              diagnostics.map((d) => (
                <li key={`${d.from}-${d.code}`} className={d.severity}>
                  {T.line} {lineOf(d.from)}: {formatDiagnostic(d, LOCALE)}
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="preview-pane">
          <PlayerView data={playerData} locale={LOCALE} />
        </section>
      </main>
    </div>
  );
}

function safeFileName(title: string): string {
  const cleaned = Array.from(title, (ch) =>
    ch.charCodeAt(0) < 0x20 || /[\\/:*?"<>|]/.test(ch) ? '_' : ch,
  )
    .join('')
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : 'diagram';
}
