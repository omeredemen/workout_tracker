import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseRemote } from "../remote";

/** A real supabase-js client whose HTTP requests are recorded instead of sent. */
function recordingRemote(response: unknown = []) {
  const requests: { method: string; url: URL; headers: Headers; body: unknown }[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      method: init?.method ?? "GET",
      url: new URL(String(input)),
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const client = createClient("https://project.supabase.co", "anon-key", {
    global: { fetch },
    auth: { persistSession: false },
  });
  return { remote: new SupabaseRemote(client), requests };
}

describe("SupabaseRemote", () => {
  it("pulls rows changed since the cursor, oldest first", async () => {
    const { remote, requests } = recordingRemote([{ id: "a" }]);
    expect(await remote.pull("set_logs", "2026-10-19T10:00:00.000Z", 1000)).toEqual([{ id: "a" }]);
    const { method, url } = requests[0]!;
    expect(method).toBe("GET");
    expect(url.pathname).toBe("/rest/v1/set_logs");
    expect(url.searchParams.get("select")).toBe("*");
    expect(url.searchParams.get("order")).toBe("server_updated_at.asc");
    expect(url.searchParams.get("limit")).toBe("1000");
    expect(url.searchParams.get("server_updated_at")).toBe("gt.2026-10-19T10:00:00.000Z");
  });

  it("pulls everything on the first sync", async () => {
    const { remote, requests } = recordingRemote();
    await remote.pull("sessions", null, 1000);
    expect(requests[0]!.url.searchParams.has("server_updated_at")).toBe(false);
  });

  it("upserts on id, in chunks", async () => {
    const { remote, requests } = recordingRemote(null);
    const rows = Array.from({ length: 450 }, (_, i) => ({ id: String(i), reps: 10 }));
    await remote.upsert("set_logs", rows);
    expect(requests).toHaveLength(3);
    const { method, url, headers, body } = requests[0]!;
    expect(method).toBe("POST");
    expect(url.searchParams.get("on_conflict")).toBe("id");
    expect(headers.get("Prefer")).toContain("resolution=merge-duplicates");
    expect(body).toHaveLength(200);
  });

  it("selects by a column's values", async () => {
    const { remote, requests } = recordingRemote();
    await remote.selectWhereIn("sessions", "enrollment_id", ["e1", "e2"]);
    expect(requests[0]!.url.searchParams.get("enrollment_id")).toBe("in.(e1,e2)");
  });

  it("reports errors with the table name", async () => {
    const client = createClient("https://project.supabase.co", "anon-key", {
      global: {
        fetch: async () =>
          new Response(JSON.stringify({ message: "permission denied", code: "42501" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }),
      },
      auth: { persistSession: false },
    });
    await expect(new SupabaseRemote(client).pull("sessions", null, 10)).rejects.toThrow(
      "Pulling sessions: permission denied",
    );
  });
});
