export interface EditHistory<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
  readonly saved: T;
}

export function createHistory<T>(value: T): EditHistory<T> {
  return { past: [], present: value, future: [], saved: value };
}

export function pushHistory<T>(history: EditHistory<T>, value: T, limit = 50): EditHistory<T> {
  if (Object.is(history.present, value)) return history;
  return {
    ...history,
    past: [...history.past, history.present].slice(-limit),
    present: value,
    future: [],
  };
}

export function undoHistory<T>(history: EditHistory<T>): EditHistory<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    ...history,
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoHistory<T>(history: EditHistory<T>): EditHistory<T> {
  const next = history.future[0];
  if (next === undefined) return history;
  return {
    ...history,
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}

export function markSaved<T>(history: EditHistory<T>): EditHistory<T> {
  return { ...history, saved: history.present };
}

export function isDirty<T>(history: EditHistory<T>): boolean {
  return JSON.stringify(history.present) !== JSON.stringify(history.saved);
}
