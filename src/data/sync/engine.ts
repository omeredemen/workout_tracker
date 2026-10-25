import type { LocalStorageRepository } from "../localStorageRepository";
import type { Remote } from "./remote";
import { naturalKeyOf, SYNC_TABLES, toLocal, toRemote, type RemoteRow, type SyncTable } from "./tables";

const PAGE = 1000;
/** Pulls re-read a minute back, so rows committed slightly out of order aren't missed. */
const OVERLAP_MS = 60_000;

export type SyncResult = { pushed: number; pulled: number };

/**
 * One round of sync for a device owned by `userId`: push every queued local
 * change (parents first), then pull everything changed on the server since
 * the last pull. Safe to repeat: pushes are idempotent upserts and merges are
 * last-write-wins.
 */
export async function syncOnce(
  store: LocalStorageRepository,
  remote: Remote,
  userId: string,
  now: () => Date = () => new Date(),
): Promise<SyncResult> {
  if (store.getSyncMeta().ownerUserId !== userId) {
    throw new Error("This device's data belongs to a different account");
  }

  let pushed = 0;
  for (const table of SYNC_TABLES) {
    if (store.dirtyRows(table.local).length === 0) continue;
    await adoptServerIds(store, remote, table);
    const rows = store.dirtyRows(table.local);
    // Deactivations first, so the "one active enrollment" rule never trips mid-push.
    if (table.local === "enrollments") {
      rows.sort((a, b) => Number((a as { isActive: boolean }).isActive) - Number((b as { isActive: boolean }).isActive));
    }
    await remote.upsert(table.remote, rows.map((r) => toRemote(table, r, userId)));
    store.markClean(table.local, rows);
    pushed += rows.length;
  }

  let pulled = 0;
  for (const table of SYNC_TABLES) {
    const cursor = store.getSyncMeta().cursors[table.local] ?? null;
    let since = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : null;
    for (;;) {
      const rows = await remote.pull(table.remote, since, PAGE);
      if (rows.length === 0) break;
      const last = rows.at(-1)!.server_updated_at as string;
      store.applyRemote(table.local, rows.map((r) => toLocal(table, r)), maxCursor(cursor, last));
      pulled += rows.length;
      if (rows.length < PAGE) break;
      since = last;
    }
  }

  store.setLastSyncedAt(now().toISOString());
  return { pushed, pulled };
}

/**
 * If the server already has a row with the same natural key under another id
 * (made on another device), take over the server's id before pushing, so the
 * push updates that row instead of hitting a unique constraint.
 */
async function adoptServerIds(store: LocalStorageRepository, remote: Remote, table: SyncTable) {
  if (!table.naturalKey) return;
  const rows = store.dirtyRows(table.local) as unknown as Record<string, unknown>[];
  const parentColumn = table.columns.find((c) => c.local === table.naturalKey!.parent)!.remote;
  const parents = [...new Set(rows.map((r) => String(r[table.naturalKey!.parent])))];
  const existing = await remote.selectWhereIn(table.remote, parentColumn, parents);

  const serverIdByKey = new Map<string, string>();
  for (const row of existing) {
    const local = toLocal(table, row as RemoteRow) as unknown as Record<string, unknown>;
    serverIdByKey.set(naturalKeyOf(table, local)!, local.id as string);
  }
  for (const row of rows) {
    const serverId = serverIdByKey.get(naturalKeyOf(table, row)!);
    if (serverId && serverId !== row.id) store.remapId(table.local, row.id as string, serverId);
  }
}

function maxCursor(a: string | null, b: string): string {
  return a && Date.parse(a) > Date.parse(b) ? a : b;
}
