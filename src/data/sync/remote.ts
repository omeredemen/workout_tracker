import type { SupabaseClient } from "@supabase/supabase-js";
import type { RemoteRow } from "./tables";

/** The server side of sync. Implemented by Supabase; faked in tests. */
export interface Remote {
  /** Rows with server_updated_at > since, oldest first. */
  pull(table: string, since: string | null, limit: number): Promise<RemoteRow[]>;
  /** Insert or update by id. The server skips updates older than what it has. */
  upsert(table: string, rows: RemoteRow[]): Promise<void>;
  /** Rows whose `column` is one of `values` (used to match natural keys). */
  selectWhereIn(table: string, column: string, values: string[]): Promise<RemoteRow[]>;
}

const CHUNK = 200;

export class SupabaseRemote implements Remote {
  constructor(private readonly client: SupabaseClient) {}

  async pull(table: string, since: string | null, limit: number) {
    let query = this.client.from(table).select("*").order("server_updated_at").limit(limit);
    if (since) query = query.gt("server_updated_at", since);
    const { data, error } = await query;
    if (error) throw new Error(`Pulling ${table}: ${error.message}`);
    return data as RemoteRow[];
  }

  async upsert(table: string, rows: RemoteRow[]) {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await this.client
        .from(table)
        .upsert(rows.slice(i, i + CHUNK), { onConflict: "id" });
      if (error) throw new Error(`Saving ${table}: ${error.message}`);
    }
  }

  async selectWhereIn(table: string, column: string, values: string[]) {
    const out: RemoteRow[] = [];
    for (let i = 0; i < values.length; i += CHUNK) {
      const { data, error } = await this.client
        .from(table)
        .select("*")
        .in(column, values.slice(i, i + CHUNK));
      if (error) throw new Error(`Reading ${table}: ${error.message}`);
      out.push(...(data as RemoteRow[]));
    }
    return out;
  }
}
