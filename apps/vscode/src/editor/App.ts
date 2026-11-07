import {
  type Diagnostic,
  findAtOffset,
  format,
  formatDiagnostic,
  parse,
  type SourceMap,
} from '../dsl';
import { exportHtml, importContent } from '../exporter';
import { computeLayout, type Layout } from '../layout';
import type { DavDocument } from '../model/types';
import { isHostToWebviewMessage, type WebviewToHostMessage } from '../protocol/messages';
import { clear, html, svg } from '../runtime/dom';
import { detectLocale, type ViewerLocale } from '../runtime/i18n';
import { Player } from '../runtime/player';
import { DEFAULT_SAMPLE, SAMPLES } from '../samples';
import { HelpModal } from './HelpModal';
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

let cachedVsCodeApi: VsCodeApi | null | undefined;
function getVsCodeApi(): VsCodeApi | null {
  if (cachedVsCodeApi !== undefined) return cachedVsCodeApi;
  cachedVsCodeApi =
    typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function'
      ? window.acquireVsCodeApi()
      : null;
  return cachedVsCodeApi;
}

interface EditorStrings {
  templates: string;
  format: string;
  formatTitle: string;
  help: string;
  helpTitle: string;
  openFile: string;
  exportHtml: string;
  exportSuccess: (file: string) => string;
  importError: string;
  dslHeader: string;
  noDiagnostics: string;
  diagnosticCount: (errors: number, warnings: number) => string;
  lineLabel: (line: number) => string;
}

const EDITOR_STRINGS: Record<ViewerLocale, EditorStrings> = {
  ja: {
    templates: 'サンプル',
    format: '整形',
    formatTitle: 'DSLコードを自動フォーマット',
    help: 'AIプロンプト / 構文',
    helpTitle: 'AI生成プロンプトとDSLリファレンスを表示',
    openFile: 'ファイルを開く (.dav / .html)',
    exportHtml: 'HTML出力',
    exportSuccess: (file) => `${file} を出力しました`,
    importError: 'HTML内に埋め込まれたDSLが見つかりませんでした',
    dslHeader: 'DSL (.dav)',
    noDiagnostics: '構文エラーなし (0件)',
    diagnosticCount: (e, w) => `エラー ${e}件 / 警告 ${w}件`,
    lineLabel: (line) => `L${line}`,
  },
  en: {
    templates: 'Template',
    format: 'Format',
    formatTitle: 'Format DSL code',
    help: 'AI Prompt / Syntax',
    helpTitle: 'Open AI Prompt & DSL v1 Reference',
    openFile: 'Open (.dav / .html)',
    exportHtml: 'Export HTML',
    exportSuccess: (file) => `Exported ${file}`,
    importError: 'No embedded DSL found in this HTML file',
    dslHeader: 'DSL (.dav)',
    noDiagnostics: '0 diagnostics',
    diagnosticCount: (e, w) => `${e} errors / ${w} warnings`,
    lineLabel: (line) => `L${line}`,
  },
};

export function mountApp(container: HTMLElement): void {
  const vscodeApi = getVsCodeApi();
  const isVsCodeWebview = vscodeApi !== null;

  let locale: ViewerLocale = detectLocale();
  let sampleId: string = DEFAULT_SAMPLE.id;
  let dsl: string = DEFAULT_SAMPLE.dsl;
  let cursorTargetId: string | null = null;
  let toastTimer = 0;

  let parsed = parse(dsl);
  let lastValid: { document: DavDocument; layout: Layout; sourceMap: SourceMap } = {
    document: parsed.document,
    layout: computeLayout(parsed.document),
    sourceMap: parsed.sourceMap,
  };

  // Toolbar elements
  const sampleLabelEl = html('span', {});
  const sampleSelect = html('select', { 'aria-label': EDITOR_STRINGS[locale].templates });
  for (const s of SAMPLES) {
    sampleSelect.append(html('option', { value: s.id }, s.name));
  }
  const sampleLabelWrap = html('label', { class: 'toolbar-label' }, sampleLabelEl, sampleSelect);

  const formatBtn = html('button', {
    type: 'button',
    class: 'btn',
    'data-testid': 'btn-format',
  });
  const helpBtn = html('button', {
    type: 'button',
    class: 'btn',
    'data-testid': 'btn-open-help',
  });
  const localeBtn = html('button', {
    type: 'button',
    class: 'btn',
    'data-testid': 'btn-locale-toggle',
  });
  const openFileBtn = html('button', {
    type: 'button',
    class: 'btn',
  });
  const fileInput = html('input', {
    type: 'file',
    accept: '.dav,.html,.htm,text/plain,text/html',
    hidden: true,
  });
  const exportBtn = html('button', {
    type: 'button',
    class: 'btn primary',
    'data-testid': 'btn-export-html',
  });
  const toastEl = html('span', { class: 'toast', role: 'status', hidden: true });
  const playbackSlot = html('div', {
    class: 'toolbar-center',
    'data-testid': 'toolbar-playback-slot',
  });

  // Left editor pane (standalone browser mode only)
  const dslHeaderTitle = html('span', { class: 'pane-title' });
  const dslDiagSummary = html('span', { class: 'diag-badge' });
  const textarea = html('textarea', {
    class: 'dsl-input',
    spellcheck: 'false',
    'aria-label': 'DSL Source Editor',
  });
  textarea.value = dsl;
  const problemsEl = html('div', { class: 'problems' });
  const editorPane = html(
    'section',
    { class: 'pane editor-pane' },
    html('div', { class: 'pane-header' }, dslHeaderTitle, dslDiagSummary),
    textarea,
    problemsEl,
  );

  // Preview pane & Player host
  const playerHost = html('div', { class: 'preview-host' });
  const highlightLayer = svg('g', {
    class: 'editor-cursor-layer',
    'pointer-events': 'none',
  });
  const previewPane = html('section', { class: 'pane preview-pane' }, playerHost);

  const workspaceEl = html(
    'div',
    { class: isVsCodeWebview ? 'workspace vscode-preview-only' : 'workspace' },
    !isVsCodeWebview && editorPane,
    previewPane,
  );

  const helpModal = new HelpModal(locale, dsl);

  const shellEl = html(
    'div',
    { class: 'shell' },
    html(
      'header',
      { class: 'toolbar' },
      html(
        'div',
        { class: 'toolbar-group toolbar-left' },
        html(
          'strong',
          { class: 'brand' },
          html('span', { class: 'brand-mark', 'aria-hidden': 'true' }),
          'DynamicArchitectViewer',
        ),
        !isVsCodeWebview && sampleLabelWrap,
        formatBtn,
        helpBtn,
      ),
      playbackSlot,
      html(
        'div',
        { class: 'toolbar-group toolbar-right' },
        toastEl,
        localeBtn,
        !isVsCodeWebview && openFileBtn,
        !isVsCodeWebview && fileInput,
        exportBtn,
      ),
    ),
    workspaceEl,
    helpModal.element,
  );

  clear(container);
  container.append(shellEl);

  let player: Player | null = null;

  function showToast(msg: string): void {
    window.clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastTimer = window.setTimeout(() => {
      toastEl.hidden = true;
    }, 2600);
  }

  function renderHighlight(): void {
    clear(highlightLayer);
    if (!cursorTargetId) return;
    const rect =
      lastValid.layout.nodes[cursorTargetId] ?? lastValid.layout.groups[cursorTargetId] ?? null;
    if (!rect) return;
    highlightLayer.append(
      svg('rect', {
        class: 'editor-cursor-highlight',
        x: rect.x - 5,
        y: rect.y - 5,
        width: rect.width + 10,
        height: rect.height + 10,
        rx: 14,
      }),
    );
  }

  function attachCanvasDoubleClick(svgEl: SVGSVGElement): void {
    svgEl.addEventListener('dblclick', (e: MouseEvent) => {
      const target = (e.target as Element | null)?.closest('[data-id]');
      const id = target?.getAttribute('data-id');
      if (!id) return;
      const span = lastValid.sourceMap.elements.get(id);
      if (!span) return;
      if (vscodeApi) {
        vscodeApi.postMessage({ type: 'revealRange', from: span.from, to: span.to });
      } else {
        textarea.focus();
        textarea.setSelectionRange(span.from, span.to);
      }
    });
  }

  function createOrRebuildPlayer(
    initialStep: number | null,
    opts: { autoplay?: boolean; speed?: number } = {},
  ): void {
    if (player) {
      player.destroy();
      player = null;
    }
    clear(playerHost);
    player = new Player(
      playerHost,
      { document: lastValid.document, layout: lastValid.layout, dsl },
      {
        locale,
        autoplay: opts.autoplay ?? false,
        speed: opts.speed ?? 1,
        initialStep,
        globalKeyboard: true,
        playbackSlot,
      },
    );
    player.getWorldElement().append(highlightLayer);
    attachCanvasDoubleClick(player.getSvgElement());
    renderHighlight();
  }

  function renderProblems(diagnostics: readonly Diagnostic[]): void {
    const t = EDITOR_STRINGS[locale];
    const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
    const warnCount = diagnostics.filter((d) => d.severity === 'warning').length;
    dslDiagSummary.textContent =
      diagnostics.length === 0 ? t.noDiagnostics : t.diagnosticCount(errorCount, warnCount);
    dslDiagSummary.className =
      errorCount > 0
        ? 'diag-badge has-error'
        : warnCount > 0
          ? 'diag-badge has-warning'
          : 'diag-badge is-ok';

    clear(problemsEl);
    if (diagnostics.length === 0) {
      problemsEl.append(html('div', { class: 'ok' }, t.noDiagnostics));
      return;
    }
    for (const d of diagnostics) {
      const line = dsl.slice(0, d.from).split('\n').length;
      const item = html(
        'button',
        { type: 'button', class: d.severity },
        `${t.lineLabel(line)}: ${formatDiagnostic(d, locale)}`,
      );
      item.addEventListener('click', () => {
        textarea.focus();
        textarea.setSelectionRange(d.from, d.to);
      });
      problemsEl.append(item);
    }
  }

  function updateStrings(): void {
    const t = EDITOR_STRINGS[locale];
    sampleLabelEl.textContent = t.templates;
    sampleSelect.setAttribute('aria-label', t.templates);
    formatBtn.textContent = t.format;
    formatBtn.title = t.formatTitle;
    helpBtn.textContent = t.help;
    helpBtn.title = t.helpTitle;
    localeBtn.textContent = locale === 'ja' ? 'EN' : 'JA';
    localeBtn.title = locale === 'ja' ? 'Switch to English' : '日本語に切替';
    openFileBtn.textContent = t.openFile;
    exportBtn.textContent = t.exportHtml;
    dslHeaderTitle.textContent = t.dslHeader;
    renderProblems(parsed.diagnostics);
    helpModal.update(locale, dsl);
  }

  function applyDsl(
    nextDsl: string,
    opts: { updateTextarea?: boolean; persist?: boolean } = {},
  ): void {
    dsl = nextDsl;
    if (opts.updateTextarea !== false && textarea.value !== nextDsl) {
      textarea.value = nextDsl;
    }
    parsed = parse(dsl);
    const hasFatalError =
      parsed.diagnostics.some((d) => d.severity === 'error') &&
      parsed.document.nodes.length === 0 &&
      parsed.document.groups.length === 0;
    if (!hasFatalError) {
      lastValid = {
        document: parsed.document,
        layout: computeLayout(parsed.document),
        sourceMap: parsed.sourceMap,
      };
    }
    if (player) {
      player.update({ document: lastValid.document, layout: lastValid.layout, dsl });
    }
    renderHighlight();
    renderProblems(parsed.diagnostics);
    helpModal.update(locale, dsl);

    if (opts.persist && !isVsCodeWebview) {
      void saveWorkspace({ dsl, sampleId, updatedAt: Date.now() });
    }
  }

  function syncCursorOffset(offset: number): void {
    const hit = findAtOffset(lastValid.sourceMap, offset);
    cursorTargetId = hit.elementId;
    renderHighlight();
    if (hit.stepIndex !== null && player) {
      player.goTo(hit.stepIndex);
    }
  }

  // Event listeners
  sampleSelect.addEventListener('change', () => {
    const found = SAMPLES.find((s) => s.id === sampleSelect.value);
    if (!found) return;
    sampleId = found.id;
    cursorTargetId = null;
    applyDsl(found.dsl, { updateTextarea: true, persist: true });
    player?.goTo(lastValid.document.steps.length > 0 ? 0 : null);
  });

  formatBtn.addEventListener('click', () => {
    if (vscodeApi) {
      vscodeApi.postMessage({ type: 'formatDocument' });
    } else {
      applyDsl(format(dsl), { updateTextarea: true, persist: true });
    }
  });

  helpBtn.addEventListener('click', () => {
    helpModal.open(locale, dsl);
  });

  localeBtn.addEventListener('click', () => {
    locale = locale === 'ja' ? 'en' : 'ja';
    const currentStep = player ? player.getStepIndex() : null;
    const wasPlaying = player ? player.isPlaying() : false;
    const currentSpeed = player ? player.getSpeed() : 1;
    updateStrings();
    createOrRebuildPlayer(currentStep, { autoplay: wasPlaying, speed: currentSpeed });
  });

  openFileBtn.addEventListener('click', () => {
    fileInput.click();
  });

  async function importFile(file: File): Promise<void> {
    const raw = await file.text();
    const res = importContent(raw);
    if (res.ok) {
      applyDsl(res.dsl, { updateTextarea: true, persist: true });
    } else {
      showToast(EDITOR_STRINGS[locale].importError);
    }
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void importFile(file);
    fileInput.value = '';
  });

  if (!isVsCodeWebview) {
    workspaceEl.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    workspaceEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) void importFile(file);
    });
  }

  exportBtn.addEventListener('click', async () => {
    const filename = `${safeFileName(lastValid.document.title)}.html`;
    if (vscodeApi) {
      vscodeApi.postMessage({
        type: 'exportHtml',
        dsl,
        locale,
      });
    } else {
      const htmlContent = await exportHtml(dsl, { locale });
      downloadTextFile(htmlContent, filename, 'text/html;charset=utf-8');
    }
    showToast(EDITOR_STRINGS[locale].exportSuccess(filename));
  });

  textarea.addEventListener('input', () => {
    applyDsl(textarea.value, { updateTextarea: false, persist: true });
  });
  textarea.addEventListener('click', () => {
    syncCursorOffset(textarea.selectionStart);
  });
  textarea.addEventListener('keyup', () => {
    syncCursorOffset(textarea.selectionStart);
  });

  // Initial render
  updateStrings();
  createOrRebuildPlayer(lastValid.document.steps.length > 0 ? 0 : null);

  if (vscodeApi) {
    window.addEventListener('message', (event: MessageEvent<unknown>) => {
      const msg = event.data;
      if (!isHostToWebviewMessage(msg)) return;
      if (msg.type === 'docChanged') {
        applyDsl(msg.dsl, { updateTextarea: true, persist: false });
      } else if (msg.type === 'cursorMoved') {
        syncCursorOffset(msg.offset);
      }
    });
    vscodeApi.postMessage({ type: 'ready' });
  } else {
    void loadWorkspace().then((saved) => {
      if (saved) {
        sampleId = saved.sampleId;
        sampleSelect.value = saved.sampleId;
        applyDsl(saved.dsl, { updateTextarea: true, persist: false });
      }
    });
  }
}
