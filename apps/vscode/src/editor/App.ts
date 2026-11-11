import { findAtOffset, hasFatalError, parse, type SourceMap } from '../dsl';
import { computeLayout, type Layout } from '../layout';
import type { DavDocument } from '../model/types';
import { isHostToWebviewMessage, type WebviewToHostMessage } from '../protocol/messages';
import { controlIcon, DOCS_ICON } from '../runtime/controlIcons';
import { clear, html, svg } from '../runtime/dom';
import { detectLocale } from '../runtime/i18n';
import { Player } from '../runtime/player';
import { ICON_SHAPES } from '../scene/icons';
import { ExportMenu } from './ExportMenu';
import { HelpModal } from './HelpModal';

interface VsCodeApi {
  postMessage(message: WebviewToHostMessage): void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

export function mountApp(container: HTMLElement): void {
  if (!window.acquireVsCodeApi) throw new Error('This page only runs inside a VS Code webview');
  const vscodeApi = window.acquireVsCodeApi();
  const locale = detectLocale();
  const helpTitle = locale === 'ja' ? 'ドキュメントを開く' : 'Open documentation';

  let documentUri: string | undefined;
  let cursorTargetId: string | null = null;
  let lastStepIndex: number | null = null;

  const empty = parse('');
  const emptyState: { dsl: string; document: DavDocument; layout: Layout; sourceMap: SourceMap } = {
    dsl: '',
    document: empty.document,
    layout: computeLayout(empty.document),
    sourceMap: empty.sourceMap,
  };
  let lastValid = emptyState;

  const helpBtn = html(
    'button',
    {
      type: 'button',
      class: 'btn btn-icon',
      title: helpTitle,
      'aria-label': helpTitle,
      'data-testid': 'btn-open-help',
    },
    controlIcon(DOCS_ICON),
  );
  // The host owns the save dialog and reports the outcome itself.
  const exportMenu = new ExportMenu(
    locale,
    () => {
      const { steps } = lastValid.document;
      const index = player?.getStepIndex() ?? null;
      const step = index === null ? undefined : steps[index];
      return {
        hasSteps: steps.length > 0,
        step:
          index === null || !step
            ? null
            : {
                index,
                title: step.title,
                animates: (player?.getView().phases.length ?? 0) > 0,
              },
      };
    },
    (format, step) => {
      const exportDsl = lastValid.dsl;
      vscodeApi.postMessage(
        format === 'html'
          ? { type: 'exportHtml', dsl: exportDsl }
          : {
              type: 'exportSvg',
              dsl: exportDsl,
              animate: format !== 'svg-still',
              camera: format === 'svg-whole' ? 'whole' : 'follow',
              step,
            },
      );
    },
  );
  const playbackSlot = html('div', {
    class: 'toolbar-group toolbar-left',
    'data-testid': 'toolbar-playback-slot',
  });

  const playerHost = html('div', { class: 'preview-host' });
  const highlightLayer = svg('g', {
    class: 'editor-cursor-layer',
    'pointer-events': 'none',
  });
  const helpModal = new HelpModal(locale);

  clear(container);
  container.append(
    html(
      'div',
      { class: 'shell' },
      html(
        'header',
        { class: 'toolbar' },
        playbackSlot,
        html('div', { class: 'toolbar-group toolbar-right' }, exportMenu.element, helpBtn),
      ),
      html('section', { class: 'preview-pane' }, playerHost),
      helpModal.element,
    ),
  );

  let player: Player | null = null;

  function renderHighlight(): void {
    clear(highlightLayer);
    if (!cursorTargetId) return;
    const rect =
      lastValid.layout.nodes[cursorTargetId] ?? lastValid.layout.groups[cursorTargetId] ?? null;
    if (!rect) return;
    highlightLayer.append(
      svg('rect', {
        class: 'editor-cursor-highlight',
        x: rect.x - 3,
        y: rect.y - 3,
        width: rect.width + 6,
        height: rect.height + 6,
        rx: 2,
      }),
    );
  }

  function createPlayer(): Player {
    const created = new Player(
      playerHost,
      { document: lastValid.document, layout: lastValid.layout, icons: ICON_SHAPES },
      {
        locale,
        initialStep: lastValid.document.steps.length > 0 ? 0 : null,
        globalKeyboard: true,
        playbackSlot,
        onPhaseChange: (view) => {
          if (view.stepIndex !== lastStepIndex) {
            lastStepIndex = view.stepIndex;
            exportMenu.sync();
          }
        },
      },
    );
    created.getWorldElement().append(highlightLayer);
    created.getSvgElement().addEventListener('dblclick', (e: MouseEvent) => {
      const id = (e.target as Element | null)?.closest('[data-id]')?.getAttribute('data-id');
      const span = id ? lastValid.sourceMap.elements.get(id) : undefined;
      if (span) vscodeApi.postMessage({ type: 'revealRange', from: span.from, to: span.to });
    });
    return created;
  }

  function applyDsl(dsl: string): void {
    const parsed = parse(dsl);
    const fatal = hasFatalError(parsed);
    exportMenu.setBlocked(fatal);
    if (!fatal) {
      lastValid = {
        dsl,
        document: parsed.document,
        layout: computeLayout(parsed.document),
        sourceMap: parsed.sourceMap,
      };
    }
    if (player) {
      player.update({ document: lastValid.document, layout: lastValid.layout, icons: ICON_SHAPES });
    } else {
      player = createPlayer();
    }
    lastStepIndex = player.getStepIndex();
    exportMenu.sync();
    renderHighlight();
    helpModal.update(dsl);
  }

  function syncCursorOffset(offset: number): void {
    const hit = findAtOffset(lastValid.sourceMap, offset);
    cursorTargetId = hit.elementId;
    renderHighlight();
    // Only a move into another step navigates; otherwise playback would restart on every keystroke.
    if (
      player &&
      hit.stepIndex !== null &&
      hit.stepIndex !== player.getStepIndex() &&
      !player.isPlaying()
    ) {
      player.goTo(hit.stepIndex);
    }
  }

  helpBtn.addEventListener('click', () => {
    helpModal.open();
  });

  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    const msg = event.data;
    if (!isHostToWebviewMessage(msg)) return;
    if (msg.type === 'docChanged') {
      if (msg.uri !== documentUri) {
        // Nothing of the previous document may survive into another one.
        documentUri = msg.uri;
        lastValid = emptyState;
        cursorTargetId = null;
        lastStepIndex = null;
        exportMenu.reset();
        player?.destroy();
        player = null;
      }
      applyDsl(msg.dsl);
    } else if (msg.type === 'cursorMoved') {
      syncCursorOffset(msg.offset);
    }
  });
  vscodeApi.postMessage({ type: 'ready' });
}
