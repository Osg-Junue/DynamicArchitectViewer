export interface HistoryEntry {
  readonly value: string;
  readonly coalesceKey?: string | undefined;
  readonly timestamp: number;
}

export interface HistoryState {
  readonly past: readonly HistoryEntry[];
  readonly present: HistoryEntry;
  readonly future: readonly HistoryEntry[];
}

const MAX_HISTORY = 200;
const COALESCE_WINDOW_MS = 1000;

export function createHistory(initial: string, now = Date.now()): HistoryState {
  return {
    past: [],
    present: { value: initial, timestamp: now },
    future: [],
  };
}

export interface PushOptions {
  /**
   * When provided and matching the current entry's `coalesceKey` within the coalesce window
   * (or when `forceCoalesce` is true, e.g. during a continuous pointer drag), the intermediate
   * state replaces `present` without pushing a new undo step.
   */
  coalesceKey?: string;
  forceCoalesce?: boolean;
  now?: number;
}

export function pushHistory(
  state: HistoryState,
  nextValue: string,
  options: PushOptions = {},
): HistoryState {
  if (nextValue === state.present.value) return state;
  const now = options.now ?? Date.now();
  const key = options.coalesceKey;

  const shouldCoalesce =
    key !== undefined &&
    state.present.coalesceKey === key &&
    (options.forceCoalesce === true || now - state.present.timestamp <= COALESCE_WINDOW_MS);

  if (shouldCoalesce) {
    return {
      past: state.past,
      present: { value: nextValue, coalesceKey: key, timestamp: now },
      future: [],
    };
  }

  const past = [...state.past, state.present];
  if (past.length > MAX_HISTORY) past.shift();

  return {
    past,
    present: { value: nextValue, coalesceKey: key, timestamp: now },
    future: [],
  };
}

export function undoHistory(state: HistoryState): HistoryState {
  const previous = state.past[state.past.length - 1];
  if (!previous) return state;
  const past = state.past.slice(0, -1);
  return {
    past,
    present: { value: previous.value, timestamp: previous.timestamp },
    future: [state.present, ...state.future],
  };
}

export function redoHistory(state: HistoryState): HistoryState {
  if (state.future.length === 0) return state;
  const [next, ...future] = state.future;
  if (!next) return state;
  return {
    past: [...state.past, state.present],
    present: { value: next.value, timestamp: next.timestamp },
    future,
  };
}

export function canUndo(state: HistoryState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: HistoryState): boolean {
  return state.future.length > 0;
}
