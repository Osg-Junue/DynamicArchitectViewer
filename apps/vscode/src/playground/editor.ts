import 'monaco-editor/features/register.all';
import * as monaco from 'monaco-editor/editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import type { ViewerLocale } from '../runtime/i18n';
import { LANGUAGE_ID, registerLanguage } from './language';

export interface PlaygroundEditor {
  /** Replaces the whole text, as one edit that Undo takes back. */
  setText(text: string): void;
  /** Selects a range of the text and brings it into view. */
  reveal(from: number, to: number): void;
}

export interface EditorEvents {
  textChanged(text: string): void;
  cursorMoved(offset: number): void;
}

/** The editor of the playground: Monaco on one model, with the language of the extension. */
export function createEditor(
  container: HTMLElement,
  text: string,
  locale: ViewerLocale,
  events: EditorEvents,
): PlaygroundEditor {
  self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
  const language = registerLanguage(locale);

  const model = monaco.editor.createModel(
    text,
    LANGUAGE_ID,
    monaco.Uri.parse('file:///diagram.dav'),
  );
  // Whatever the platform, so that offsets and exports do not depend on it.
  model.setEOL(monaco.editor.EndOfLineSequence.LF);

  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  const themeName = (): string => (dark.matches ? 'dav-dark' : 'dav-light');
  const editor = monaco.editor.create(container, {
    model,
    theme: themeName(),
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    tabSize: 2,
    insertSpaces: true,
    fontSize: 13,
    padding: { top: 8 },
    ariaLabel: locale === 'ja' ? '図のテキスト' : 'Text of the diagram',
  });
  dark.addEventListener('change', () => monaco.editor.setTheme(themeName()));

  // The player listens for its keys (Space, the arrows) on the window; typing is not for it.
  container.addEventListener('keydown', (e) => e.stopPropagation());

  language.refreshDiagnostics(model);
  model.onDidChangeContent(() => {
    language.refreshDiagnostics(model);
    events.textChanged(model.getValue());
  });
  editor.onDidChangeCursorPosition((e) => events.cursorMoved(model.getOffsetAt(e.position)));

  return {
    setText(next) {
      if (next === model.getValue()) return;
      editor.pushUndoStop();
      editor.executeEdits('playground', [{ range: model.getFullModelRange(), text: next }]);
      editor.pushUndoStop();
      editor.setPosition({ lineNumber: 1, column: 1 });
      editor.revealLine(1);
    },
    reveal(from, to) {
      const range = monaco.Range.fromPositions(model.getPositionAt(from), model.getPositionAt(to));
      editor.setSelection(range);
      editor.revealRangeInCenter(range);
      editor.focus();
    },
  };
}
