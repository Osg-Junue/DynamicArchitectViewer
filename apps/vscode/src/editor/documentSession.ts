import { findAtOffset, hasFatalError, parse, type SourceMap } from '../dsl';
import { computeLayout, type Layout } from '../layout';
import type { DavDocument } from '../model/types';
import type { ZonePlanner } from './zonePlanner';

/** A text that can be drawn, with what was worked out from it. */
export interface ValidState {
  dsl: string;
  document: DavDocument;
  layout: Layout;
  sourceMap: SourceMap;
}

/** What the session tells the page that draws. */
export interface SessionView {
  /** Another document is being shown: nothing of the last one may survive into it. */
  switched(uri: string | undefined): void;
  /** New text arrived; `fatal` when it has errors and nothing to draw. */
  textChanged(dsl: string, fatal: boolean): void;
  /** Draw this: a new diagram, or the last one again when the new text cannot be drawn. */
  show(valid: ValidState): void;
  /** The editor's cursor is on this element and in this step of the diagram last shown. */
  cursorAt(elementId: string | null, stepIndex: number | null): void;
}

/** What the host sends when the text changes. */
export interface DocumentChange {
  dsl: string;
  uri?: string | undefined;
  version?: number | undefined;
}

let empty: ValidState | undefined;
function emptyState(): ValidState {
  if (!empty) {
    const parsed = parse('');
    empty = {
      dsl: '',
      document: parsed.document,
      layout: computeLayout(parsed.document),
      sourceMap: parsed.sourceMap,
    };
  }
  return empty;
}

/**
 * Which document the preview is on and what of it can be drawn: everything the webview keeps
 * between two messages of the host that is not on the page itself.
 *
 * A text with fatal errors is not drawn; the last one that could be stays. A text whose layout
 * takes a search is drawn once the search is done (see `ZonePlanner`), and until then the
 * diagram before it stays too. A cursor position that arrives meanwhile is an offset into text
 * the preview does not show yet, so it waits for that diagram.
 */
export class DocumentSession {
  readonly #planner: ZonePlanner;
  readonly #view: SessionView;
  #uri: string | undefined;
  #version: number | undefined;
  #dsl = '';
  #valid: ValidState | null = null;
  #awaitingLayout = false;
  #heldCursorOffset: number | null = null;

  constructor(planner: ZonePlanner, view: SessionView) {
    this.#planner = planner;
    this.#view = view;
  }

  get uri(): string | undefined {
    return this.#uri;
  }

  get version(): number | undefined {
    return this.#version;
  }

  /** The text as the editor has it, whether or not it can be drawn. */
  get dsl(): string {
    return this.#dsl;
  }

  /** The last text that could be drawn; an empty diagram while there is none. */
  get valid(): ValidState {
    return this.#valid ?? emptyState();
  }

  docChanged({ dsl, uri, version }: DocumentChange): void {
    // The page may have drawn this very version already, from what the host put into it.
    const drawn =
      uri !== undefined && uri === this.#uri && version !== undefined && version === this.#version;
    if (drawn) return;
    if (uri !== this.#uri) {
      this.#uri = uri;
      this.#planner.cancel();
      this.#awaitingLayout = false;
      this.#heldCursorOffset = null;
      this.#valid = null;
      this.#view.switched(uri);
    }
    this.#version = version;
    this.#apply(dsl);
  }

  cursorMoved(offset: number): void {
    if (this.#awaitingLayout) {
      this.#heldCursorOffset = offset;
      return;
    }
    const hit = findAtOffset(this.valid.sourceMap, offset);
    this.#view.cursorAt(hit.elementId, hit.stepIndex);
  }

  #apply(dsl: string): void {
    this.#dsl = dsl;
    const parsed = parse(dsl);
    const fatal = hasFatalError(parsed);
    this.#view.textChanged(dsl, fatal);
    if (fatal) {
      this.#view.show(this.valid);
      return;
    }
    this.#awaitingLayout = true;
    this.#planner.whenPlanned(parsed.document, () => {
      this.#awaitingLayout = false;
      this.#valid = {
        dsl,
        document: parsed.document,
        layout: computeLayout(parsed.document),
        sourceMap: parsed.sourceMap,
      };
      this.#view.show(this.#valid);
      if (this.#heldCursorOffset !== null) {
        const offset = this.#heldCursorOffset;
        this.#heldCursorOffset = null;
        this.cursorMoved(offset);
      }
    });
  }
}
