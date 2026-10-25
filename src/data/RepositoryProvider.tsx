"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { LocalStorageRepository } from "./localStorageRepository";
import type { Repository } from "./repository";

const RepositoryContext = createContext<Repository | null>(null);

export function RepositoryProvider({ children }: { children: ReactNode }) {
  // localStorage only exists in the browser; server renders never reach consumers (see ClientOnly).
  const [repo] = useState<Repository | null>(() =>
    typeof window === "undefined" ? null : new LocalStorageRepository(),
  );
  return <RepositoryContext.Provider value={repo}>{children}</RepositoryContext.Provider>;
}

/** The repository, or null during server rendering. */
export function useOptionalRepository(): Repository | null {
  return useContext(RepositoryContext);
}

export function useRepository(): Repository {
  const repo = useContext(RepositoryContext);
  if (!repo) throw new Error("useRepository must be used in the browser, inside RepositoryProvider");
  return repo;
}
