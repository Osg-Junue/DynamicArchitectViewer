import {
  INITIAL_DOC_ELEMENT_ID,
  type InitialDocPayload,
  isHostToWebviewMessage,
  isInitialDocPayload,
  type WebviewToHostMessage,
} from '../protocol/messages';
import { controlIcon, DOCS_ICON } from '../runtime/controlIcons';
import { clear, html, svg } from '../runtime/dom';
import { detectLocale } from '../runtime/i18n';
import { Player } from '../runtime/player';
import { ICON_SHAPES } from '../scene/icons';
import { DocumentSession, type ValidState } from './documentSession';
import { ExportMenu } from './ExportMenu';
import type { HelpModal } from './HelpModal';
import { type SearchWorker, ZonePlanner } from './zonePlanner';
import ZoneSearchWorker from './zoneSearch.worker?worker&inline';

interface VsCodeApi {
  postMessage(message: WebviewToHostMessage): void;
  /** Kept by VS Code across a window reload, and handed back to the extension to restore. */
  setState?(state: { uri: string }): void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

function readInitialDoc(): InitialDocPayload | null {
  const el = document.getElementById(INITIAL_DOC_ELEMENT_ID);
  const raw = el?.textContent;
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isInitialDocPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The page of the preview webview: the toolbar, the player and the documentation. What it
 * shows of which document is decided by a `DocumentSession`; this draws it.
 */
export function mountApp(container: HTMLElement): void {
  if (!window.acquireVsCodeApi) throw new Error('This page only runs inside a VS Code webview');
  const vscodeApi = window.acquireVsCodeApi();
  const locale = detectLocale();
  const helpTitle = locale === 'ja' ? 'ドキュメントを開く' : 'Open documentation';

  let cursorTargetId: string | null = null;
  let lastStepIndex: number | null = null;
  let player: Player | null = null;
  let helpModal: HelpModal | null = null;
  let helpModalLoading: Promise<HelpModal> | null = null;

  const session = new DocumentSession(
    // The search for where the zones go can take a second on a large diagram; a worker keeps
    // the preview moving meanwhile. Inlined, because a webview may only start one from a blob.
    new ZonePlanner(() => new ZoneSearchWorker() as SearchWorker),
    {
      switched(uri) {
        if (uri !== undefined) vscodeApi.setState?.({ uri });
        cursorTargetId = null;
        lastStepIndex = null;
        exportMenu.reset();
        player?.destroy();
        player = null;
      },
      textChanged(dsl, fatal) {
        exportMenu.setBlocked(fatal);
        helpModal?.update(dsl);
      },
      show(valid) {
        if (player) {
          player.update({ document: valid.document, layout: valid.layout, icons: ICON_SHAPES });
        } else {
          player = createPlayer(valid);
        }
        lastStepIndex = player.getStepIndex();
        exportMenu.sync();
        renderHighlight();
      },
      cursorAt(elementId, stepIndex) {
        cursorTargetId = elementId;
        renderHighlight();
        // Only a move into another step navigates; otherwise playback would restart on every keystroke.
        if (
          player &&
          stepIndex !== null &&
          stepIndex !== player.getStepIndex() &&
          !player.isPlaying()
        ) {
          player.goTo(stepIndex);
        }
      },
    },
  );

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
      const { steps } = session.valid.document;
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
      const exportDsl = session.valid.dsl;
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
  const shell = html(
    'div',
    { class: 'shell' },
    html(
      'header',
      { class: 'toolbar' },
      playbackSlot,
      html('div', { class: 'toolbar-group toolbar-right' }, exportMenu.element, helpBtn),
    ),
    html('section', { class: 'preview-pane' }, playerHost),
  );

  clear(container);
  container.append(shell);

  /** Outlines the element the editor's cursor is on. */
  function renderHighlight(): void {
    clear(highlightLayer);
    if (!cursorTargetId) return;
    const { layout } = session.valid;
    const rect = layout.nodes[cursorTargetId] ?? layout.groups[cursorTargetId] ?? null;
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

  function createPlayer(valid: ValidState): Player {
    const created = new Player(
      playerHost,
      { document: valid.document, layout: valid.layout, icons: ICON_SHAPES },
      {
        locale,
        initialStep: valid.document.steps.length > 0 ? 0 : null,
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
      const id =
        e.target instanceof Element
          ? e.target.closest('[data-id]')?.getAttribute('data-id')
          : undefined;
      const span = id ? session.valid.sourceMap.elements.get(id) : undefined;
      if (span) vscodeApi.postMessage({ type: 'revealRange', from: span.from, to: span.to });
    });
    return created;
  }

  // The documentation is loaded when first opened.
  helpBtn.addEventListener('click', () => {
    if (helpModal) {
      helpModal.open();
      return;
    }
    helpModalLoading ??= import('./HelpModal')
      .then(({ HelpModal: Modal }) => {
        const instance = new Modal(locale);
        instance.update(session.dsl);
        shell.append(instance.element);
        helpModal = instance;
        return instance;
      })
      .catch((err: unknown) => {
        helpModalLoading = null;
        throw err;
      });
    void helpModalLoading.then(
      (modal) => modal.open(),
      () => {},
    );
  });

  // The host puts the document into the page, so that it is drawn before any message arrives.
  const initialDoc = readInitialDoc();
  if (initialDoc) session.docChanged(initialDoc);

  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    const msg = event.data;
    if (!isHostToWebviewMessage(msg)) return;
    if (msg.type === 'docChanged') session.docChanged(msg);
    else if (msg.type === 'cursorMoved') session.cursorMoved(msg.offset);
  });

  vscodeApi.postMessage({
    type: 'ready',
    ...(session.uri !== undefined ? { uri: session.uri } : {}),
    ...(session.version !== undefined ? { version: session.version } : {}),
  });
}
