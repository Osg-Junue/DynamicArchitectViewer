import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findAtOffset, format, formatDiagnostic, hasErrors, type Locale, parse } from '../dsl';
import { exportHtml, importContent } from '../exporter';
import { computeLayout } from '../layout';
import type { HostToWebviewMessage, WebviewToHostMessage } from '../protocol/messages';
import type { PlayerData } from '../runtime/player';
import { DEFAULT_SAMPLE, SAMPLES } from '../samples';
import { CanvasPane } from './canvas/CanvasPane';
import { HelpModal } from './HelpModal';
import {
  canRedo,
  canUndo,
  createHistory,
  type PushOptions,
  pushHistory,
  redoHistory,
  undoHistory,
} from './history';
import { ElementInspector } from './inspector/ElementInspector';
import { StepInspector } from './inspector/StepInspector';
import { downloadTextFile, loadWorkspace, safeFileName, saveWorkspace } from './storage';

interface VsCodeApi {
  postMessage(message: WebviewToHostMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

const DEFAULT_LOCALE: Locale =
  typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('ja')
    ? 'ja'
    : 'en';

const STRINGS = {
  ja: {
    sample: 'テンプレート',
    format: '整形',
    undo: '元に戻す',
    redo: 'やり直す',
    open: 'HTML / DSL を開く',
    help: 'AIプロンプト / 仕様',
    export: '単一HTML出力',
    problems: '診断',
    noProblems: 'エラーはありません',
    line: '行',
    importFailed: (reason: string) => `ファイルを読み込めませんでした (${reason})`,
    tabElement: '要素プロパティ',
    tabSteps: 'ステップ編集',
  },
  en: {
    sample: 'Template',
    format: 'Format',
    undo: 'Undo',
    redo: 'Redo',
    open: 'Open HTML / DSL',
    help: 'AI Prompt / Ref',
    export: 'Export HTML',
    problems: 'Problems',
    noProblems: 'No problems',
    line: 'Ln',
    importFailed: (reason: string) => `Could not import file (${reason})`,
    tabElement: 'Element',
    tabSteps: 'Steps',
  },
} as const;

let cachedVsCodeApi: VsCodeApi | null | undefined;
function getVsCodeApi(): VsCodeApi | null {
  if (cachedVsCodeApi !== undefined) return cachedVsCodeApi;
  cachedVsCodeApi =
    typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function'
      ? window.acquireVsCodeApi()
      : null;
  return cachedVsCodeApi;
}

export function App() {
  const vscodeApi = getVsCodeApi();
  const isVsCodeWebview = vscodeApi !== null;

  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sampleId, setSampleId] = useState(DEFAULT_SAMPLE.id);
  const [history, setHistory] = useState(() => createHistory(DEFAULT_SAMPLE.dsl));
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(0);
  const [cursorOffset, setCursorOffset] = useState<number | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'element' | 'steps'>('element');

  const T = STRINGS[locale];

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const dsl = history.present.value;
  const parsed = useMemo(() => parse(dsl), [dsl]);
  const { document: doc, diagnostics, sourceMap } = parsed;
  const layout = useMemo(() => computeLayout(doc), [doc]);
  const playerData = useMemo<PlayerData>(
    () => ({ document: doc, layout, dsl }),
    [doc, layout, dsl],
  );

  // Keep activeStepIndex in range when steps change
  useEffect(() => {
    if (doc.steps.length === 0 && activeStepIndex !== null) {
      setActiveStepIndex(null);
    } else if (activeStepIndex !== null && activeStepIndex >= doc.steps.length) {
      setActiveStepIndex(doc.steps.length - 1);
    }
  }, [doc.steps.length, activeStepIndex]);

  // Cursor-to-canvas correlation
  const cursorTarget = useMemo(() => {
    if (cursorOffset === null) return { elementId: null, stepIndex: null };
    return findAtOffset(sourceMap, cursorOffset);
  }, [sourceMap, cursorOffset]);

  useEffect(() => {
    if (cursorTarget.stepIndex !== null) {
      setActiveStepIndex(cursorTarget.stepIndex);
    }
  }, [cursorTarget.stepIndex]);

  // Restore saved workspace in standalone mode; or connect to Extension Host in VS Code Webview
  useEffect(() => {
    if (vscodeApi) {
      const onMessage = (event: MessageEvent<HostToWebviewMessage>) => {
        const msg = event.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'docChanged') {
          setHistory((prev) => pushHistory(prev, msg.dsl));
        } else if (msg.type === 'cursorMoved') {
          setCursorOffset(msg.offset);
        }
      };
      window.addEventListener('message', onMessage);
      vscodeApi.postMessage({ type: 'ready' });
      return () => window.removeEventListener('message', onMessage);
    }

    let cancelled = false;
    void loadWorkspace().then((saved) => {
      if (cancelled || !saved) return;
      setSampleId(saved.sampleId);
      setHistory(createHistory(saved.dsl));
    });
    return () => {
      cancelled = true;
    };
  }, [vscodeApi]);

  // Auto-save to IndexedDB in standalone mode
  useEffect(() => {
    if (isVsCodeWebview) return;
    const timer = setTimeout(() => {
      void saveWorkspace({ dsl, sampleId, updatedAt: Date.now() });
    }, 250);
    return () => clearTimeout(timer);
  }, [dsl, sampleId, isVsCodeWebview]);

  const applyDsl = useCallback(
    (nextDsl: string, options?: PushOptions) => {
      setNotice(null);
      setHistory((prev) => pushHistory(prev, nextDsl, options));
      vscodeApi?.postMessage({ type: 'updateDsl', dsl: nextDsl });
    },
    [vscodeApi],
  );

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      const next = undoHistory(prev);
      if (next !== prev) {
        vscodeApi?.postMessage({ type: 'updateDsl', dsl: next.present.value });
      }
      return next;
    });
  }, [vscodeApi]);

  const handleRedo = useCallback(() => {
    setHistory((prev) => {
      const next = redoHistory(prev);
      if (next !== prev) {
        vscodeApi?.postMessage({ type: 'updateDsl', dsl: next.present.value });
      }
      return next;
    });
  }, [vscodeApi]);

  const handleSelectSample = (id: string) => {
    const found = SAMPLES.find((s) => s.id === id);
    if (!found) return;
    setSampleId(id);
    setSelectedIds(new Set());
    applyDsl(found.dsl);
  };

  const handleFormat = () => {
    if (vscodeApi) {
      vscodeApi.postMessage({ type: 'formatDocument' });
    }
    applyDsl(format(dsl));
  };

  const handleExport = async () => {
    if (vscodeApi) {
      vscodeApi.postMessage({ type: 'exportHtml', dsl, locale });
      return;
    }
    const html = await exportHtml(dsl, { locale });
    downloadTextFile(html, `${safeFileName(doc.title)}.html`, 'text/html;charset=utf-8');
  };

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const content = await file.text();
    const res = importContent(content);
    if (!res.ok) {
      setNotice(T.importFailed(res.reason));
      return;
    }
    setSelectedIds(new Set());
    applyDsl(res.dsl);
  };

  const jumpToRange = useCallback(
    (from: number, to: number) => {
      if (vscodeApi) {
        vscodeApi.postMessage({ type: 'revealRange', from, to });
        return;
      }
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(from, to);
    },
    [vscodeApi],
  );

  const handleJumpToElement = useCallback(
    (id: string) => {
      const src = sourceMap.elements.get(id);
      if (src) jumpToRange(src.from, src.to);
    },
    [sourceMap, jumpToRange],
  );

  const handleJumpToStep = useCallback(
    (stepIdx: number) => {
      const src = sourceMap.steps[stepIdx];
      if (src) jumpToRange(src.from, src.to);
    },
    [sourceMap, jumpToRange],
  );

  const handleSelectIds = useCallback((ids: Set<string>) => {
    setSelectedIds(ids);
    if (ids.size > 0) setInspectorTab('element');
  }, []);

  const lineOf = (offset: number) => dsl.slice(0, offset).split('\n').length;

  return (
    <div className="app-root">
      <header className="toolbar">
        <strong className="brand">DynamicArchitectViewer</strong>
        {!isVsCodeWebview && (
          <label className="toolbar-item">
            <span>{T.sample}</span>
            <select
              value={sampleId}
              onChange={(e) => handleSelectSample(e.target.value)}
              aria-label={T.sample}
            >
              {SAMPLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo(history)}
          data-testid="btn-undo"
        >
          {T.undo}
        </button>
        <button
          type="button"
          onClick={handleRedo}
          disabled={!canRedo(history)}
          data-testid="btn-redo"
        >
          {T.redo}
        </button>
        <button type="button" onClick={handleFormat} data-testid="btn-format">
          {T.format}
        </button>
        <button type="button" onClick={() => setHelpOpen(true)} data-testid="btn-open-help">
          {T.help}
        </button>
        <button
          type="button"
          onClick={() => setLocale((l) => (l === 'ja' ? 'en' : 'ja'))}
          title="Switch language / 言語切替"
          data-testid="btn-locale-toggle"
        >
          {locale === 'ja' ? 'JA' : 'EN'}
        </button>
        {!isVsCodeWebview && (
          <>
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              {T.open}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.dav,.txt"
              hidden
              onChange={handleImport}
            />
          </>
        )}
        <button
          type="button"
          className="primary"
          disabled={hasErrors(diagnostics)}
          onClick={handleExport}
          data-testid="btn-export-html"
        >
          {T.export}
        </button>
        {notice && (
          <span className="notice" role="status">
            {notice}
          </span>
        )}
      </header>

      <main className={`workspace ${isVsCodeWebview ? 'vscode-layout' : 'full-layout'}`}>
        {!isVsCodeWebview && (
          <section className="editor-pane">
            <textarea
              ref={textareaRef}
              className="dsl-input"
              aria-label="DSL"
              spellCheck={false}
              value={dsl}
              onChange={(e) => {
                applyDsl(e.target.value, { coalesceKey: 'typing' });
                setCursorOffset(e.target.selectionStart);
              }}
              onSelect={(e) => {
                const offset = e.currentTarget.selectionStart;
                setCursorOffset(offset);
                const target = findAtOffset(sourceMap, offset);
                if (target.stepIndex !== null) setActiveStepIndex(target.stepIndex);
              }}
            />
            <div className="problems" aria-live="polite">
              <div className="problems-header">
                {T.problems} ({diagnostics.length})
              </div>
              <ul className="problems-list">
                {diagnostics.length === 0 ? (
                  <li className="ok">{T.noProblems}</li>
                ) : (
                  diagnostics.map((d) => (
                    <li key={`${d.from}-${d.code}`} className={d.severity}>
                      {T.line} {lineOf(d.from)}: {formatDiagnostic(d, locale)}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </section>
        )}

        <section className="preview-pane">
          <CanvasPane
            dsl={dsl}
            data={playerData}
            locale={locale}
            selectedIds={selectedIds}
            cursorElementId={cursorTarget.elementId}
            activeStepIndex={activeStepIndex}
            onSelectIds={handleSelectIds}
            onActiveStepChange={setActiveStepIndex}
            onApplyDsl={applyDsl}
            onJumpToElement={handleJumpToElement}
          />
        </section>

        <aside className="inspector-pane" aria-label="Inspector">
          <div className="inspector-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={inspectorTab === 'element'}
              className={`inspector-tab ${inspectorTab === 'element' ? 'active' : ''}`}
              onClick={() => setInspectorTab('element')}
              data-testid="tab-element"
            >
              {T.tabElement}
              {selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inspectorTab === 'steps'}
              className={`inspector-tab ${inspectorTab === 'steps' ? 'active' : ''}`}
              onClick={() => setInspectorTab('steps')}
              data-testid="tab-steps"
            >
              {T.tabSteps} ({doc.steps.length})
            </button>
          </div>
          <div className="inspector-body">
            {inspectorTab === 'element' ? (
              <ElementInspector
                dsl={dsl}
                document={doc}
                layout={layout}
                locale={locale}
                selectedIds={selectedIds}
                onSelectIds={setSelectedIds}
                onApplyDsl={applyDsl}
                onJumpToElement={handleJumpToElement}
              />
            ) : (
              <StepInspector
                dsl={dsl}
                document={doc}
                locale={locale}
                activeStepIndex={activeStepIndex}
                onActiveStepChange={setActiveStepIndex}
                onApplyDsl={applyDsl}
                onJumpToStep={handleJumpToStep}
              />
            )}
          </div>
        </aside>
      </main>
      <HelpModal
        open={helpOpen}
        locale={locale}
        currentDsl={dsl}
        onClose={() => setHelpOpen(false)}
      />
    </div>
  );
}
