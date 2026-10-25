import { useSyncExternalStore } from "react";

/** A small per-device preference in localStorage, shared by every component using the same key. */
const listeners = new Map<string, Set<() => void>>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalSetting(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Not persisted; fine for a preference.
  }
  for (const listener of listeners.get(key) ?? []) listener();
}

export function useLocalSetting(key: string): string | null {
  return useSyncExternalStore(
    (listener) => {
      const set = listeners.get(key) ?? new Set();
      set.add(listener);
      listeners.set(key, set);
      return () => set.delete(listener);
    },
    () => read(key),
    () => null,
  );
}
