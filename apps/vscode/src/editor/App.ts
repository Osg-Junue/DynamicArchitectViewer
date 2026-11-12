import { findAtOffset, hasFatalError, parse, type SourceMap } from '../dsl';
import { computeLayout, type Layout } from '../layout';
import type { DavDocument } from '../model/types';
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
import { ExportMenu } from './ExportMenu';
import type { HelpModal } from './HelpModal';

interface VsCodeApi {
  postMessage(message: WebviewToHostMessage): void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

interface ValidState {
  dsl: string;
  document: DavDocument;
  layout: Layout;
  sourceMap: SourceMap;
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

export function mountApp(container: HTMLElement): void {
  if (!window.acquireVsCodeApi) throw new Error('This page only runs inside a VS Code webview');
  const vscodeApi = window.acquireVsCodeApi();
  const locale = detectLocale();
  const helpTitle = locale === 'ja' ? 'ドキュメントを開く' : 'Open documentation';

  let documentUri: string | undefined;
  let documentVersion: number | undefined;
  let cursorTargetId: string | null = null;
  let lastStepIndex: number | null = null;
  let currentDsl = '';

  let cachedEmptyState: ValidState | null = null;
  const getEmptyState = (): ValidState => {
    if (!cachedEmptyState) {
      const empty = parse('');
      cachedEmptyState = {
        dsl: '',
        document: empty.document,
        layout: computeLayout(empty.document),
        sourceMap: empty.sourceMap,
      };
    }
    return cachedEmptyState;
  };

  let lastValid: ValidState | null = null;
  const currentValid = (): ValidState => {
    lastValid ??= getEmptyState();
    return lastValid;
  };

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
      const { steps } = currentValid().document;
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
      const exportDsl = currentValid().dsl;
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

  let player: Player | null = null;
  let helpModal: HelpModal | null = null;
  let helpModalLoading: Promise<HelpModal> | null = null;

  function renderHighlight(): void {
    clear(highlightLayer);
    if (!cursorTargetId) return;
    const valid = currentValid();
    const rect = valid.layout.nodes[cursorTargetId] ?? valid.layout.groups[cursorTargetId] ?? null;
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
      const span = id ? currentValid().sourceMap.elements.get(id) : undefined;
      if (span) vscodeApi.postMessage({ type: 'revealRange', from: span.from, to: span.to });
    });
    return created;
  }

  function applyDsl(dsl: string): void {
    currentDsl = dsl;
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
    const valid = currentValid();
    if (player) {
      player.update({ document: valid.document, layout: valid.layout, icons: ICON_SHAPES });
    } else {
      player = createPlayer(valid);
    }
    lastStepIndex = player.getStepIndex();
    exportMenu.sync();
    renderHighlight();
    helpModal?.update(dsl);
  }

  function syncCursorOffset(offset: number): void {
    const hit = findAtOffset(currentValid().sourceMap, offset);
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
    if (helpModal) {
      helpModal.open();
      return;
    }
    helpModalLoading ??= import('./HelpModal')
      .then(({ HelpModal: Modal }) => {
        const instance = new Modal(locale);
        instance.update(currentDsl);
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

  const initialDoc = readInitialDoc();
  if (initialDoc) {
    documentUri = initialDoc.uri;
    documentVersion = initialDoc.version;
    applyDsl(initialDoc.dsl);
  }

  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    const msg = event.data;
    if (!isHostToWebviewMessage(msg)) return;
    if (msg.type === 'docChanged') {
      if (
        msg.uri !== undefined &&
        msg.uri === documentUri &&
        msg.version !== undefined &&
        msg.version === documentVersion
      ) {
        return;
      }
      if (msg.uri !== documentUri) {
        // Nothing of the previous document may survive into another one.
        documentUri = msg.uri;
        lastValid = null;
        cursorTargetId = null;
        lastStepIndex = null;
        exportMenu.reset();
        player?.destroy();
        player = null;
      }
      documentVersion = msg.version;
      applyDsl(msg.dsl);
    } else if (msg.type === 'cursorMoved') {
      syncCursorOffset(msg.offset);
    }
  });

  vscodeApi.postMessage({
    type: 'ready',
    ...(documentUri !== undefined ? { uri: documentUri } : {}),
    ...(documentVersion !== undefined ? { version: documentVersion } : {}),
  });
}
