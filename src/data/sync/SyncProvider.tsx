"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getSupabase } from "@/lib/supabase";
import { LocalStorageRepository } from "../localStorageRepository";
import { useOptionalRepository } from "../RepositoryProvider";
import { syncOnce } from "./engine";
import { SupabaseRemote } from "./remote";

export type SyncState =
  | { kind: "disabled" } // no Supabase configuration
  | { kind: "signed_out" }
  | { kind: "conflict"; user: User } // device holds another account's data
  | { kind: "idle" | "syncing"; user: User }
  | { kind: "error"; user: User; message: string };

type SyncContextValue = {
  state: SyncState;
  pending: number;
  lastSyncedAt: string | null;
  syncNow: () => void;
  /** Replaces this device's data with the signed-in account's (after a conflict). */
  replaceLocalData: () => void;
  signOut: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

const DEBOUNCE_MS = 2_000;
const INTERVAL_MS = 5 * 60_000;

/** Runs background sync while signed in: on start, after local changes, when back online, and periodically. */
export function SyncProvider({ children }: { children: ReactNode }) {
  const repo = useOptionalRepository();
  // Both are browser-only; on the server sync is simply disabled.
  const supabase = repo ? getSupabase() : null;
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  /** Status of the signed-in user's sync; see `state` below for what's shown. */
  const [status, setStatus] = useState<SyncState | null>(null);
  const [meta, setMeta] = useState(() => ({ pending: 0, lastSyncedAt: null as string | null }));
  const running = useRef(false);
  const again = useRef(false);

  const store = repo instanceof LocalStorageRepository ? repo : null;

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const refreshMeta = useCallback(() => {
    if (!store) return;
    const m = store.getSyncMeta();
    setMeta({ pending: store.pendingCount(), lastSyncedAt: m.lastSyncedAt });
  }, [store]);

  const run = useCallback(async () => {
    const user = session?.user;
    if (!supabase || !store || !user) return;
    if (running.current) {
      again.current = true;
      return;
    }
    const owner = store.getSyncMeta().ownerUserId;
    if (owner !== null && owner !== user.id) {
      setStatus({ kind: "conflict", user });
      return;
    }
    if (owner === null) store.claimFor(user.id); // one-time upload of local data
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus({ kind: "error", user, message: "Offline — changes are saved on this device and will sync later" });
      refreshMeta();
      return;
    }

    running.current = true;
    setStatus({ kind: "syncing", user });
    try {
      await syncOnce(store, new SupabaseRemote(supabase), user.id);
      setStatus({ kind: "idle", user });
    } catch (e) {
      setStatus({ kind: "error", user, message: e instanceof Error ? e.message : String(e) });
    } finally {
      running.current = false;
      refreshMeta();
      if (again.current) {
        again.current = false;
        void run();
      }
    }
  }, [session, supabase, store, refreshMeta]);

  // Sync triggers.
  useEffect(() => {
    if (!session?.user || !repo) return;
    let timer: number | undefined;
    const soon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void run(), DEBOUNCE_MS);
    };
    const now = () => void run();
    const onVisible = () => document.visibilityState === "visible" && now();
    const unsubscribe = repo.subscribe(() => {
      refreshMeta();
      if (!running.current) soon();
    });
    window.addEventListener("online", now);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(now, INTERVAL_MS);
    setTimeout(now, 0);
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("online", now);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session, supabase, repo, run, refreshMeta]);

  const state: SyncState = !supabase
    ? { kind: "disabled" }
    : !session?.user
      ? { kind: "signed_out" }
      : status && "user" in status && status.user.id === session.user.id
        ? status
        : { kind: "idle", user: session.user };

  const value: SyncContextValue = {
    state,
    ...meta,
    syncNow: () => void run(),
    replaceLocalData: () => {
      if (!store || !session?.user) return;
      store.clearAll();
      store.claimFor(session.user.id);
      void run();
    },
    signOut: async () => {
      await supabase?.auth.signOut();
    },
  };
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error("useSync must be used inside SyncProvider");
  return value;
}
