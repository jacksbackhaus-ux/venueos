import { useSyncExternalStore } from "react";

const ids = new Set<string>();
const listeners = new Set<() => void>();
let snapshot: ReadonlySet<string> = new Set();

function emit() {
  snapshot = new Set(ids);
  listeners.forEach((l) => l());
}

export const aiShiftsTracker = {
  add(id: string | string[]) {
    const arr = Array.isArray(id) ? id : [id];
    arr.forEach((i) => ids.add(i));
    emit();
  },
  has(id: string) {
    return ids.has(id);
  },
  clear() {
    ids.clear();
    emit();
  },
};

export function useAIAddedShifts() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
    () => snapshot,
  );
}
