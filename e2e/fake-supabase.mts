/**
 * A stand-in for Supabase for end-to-end tests: just the auth (GoTrue) and
 * REST (PostgREST) endpoints the app uses, backed by PGlite running the real
 * migrations, with every query executed as the signed-in user so row level
 * security applies. Email codes are always 123456.
 *
 * Run: node e2e/fake-supabase.mts (port from FAKE_SUPABASE_PORT, default 54321)
 */
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54321);
const CODE = "123456";
const root = join(import.meta.dirname, "..", "supabase");

const db = await PGlite.create();
await db.exec(readFileSync(join(root, "tests/supabase-stub.sql"), "utf8"));
for (const file of readdirSync(join(root, "migrations")).sort()) {
  await db.exec(readFileSync(join(root, "migrations", file), "utf8"));
}

const usersByEmail = new Map<string, string>();
const emailByUser = new Map<string, string>();
const userByToken = new Map<string, string>();

const base64url = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

async function sessionFor(userId: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const email = emailByUser.get(userId)!;
  const accessToken = `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url({ sub: userId, email, role: "authenticated", exp, aud: "authenticated" })}.sig`;
  const refreshToken = randomUUID();
  userByToken.set(accessToken, userId);
  userByToken.set(refreshToken, userId);
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    refresh_token: refreshToken,
    user: userJson(userId),
  };
}

function userJson(id: string) {
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: emailByUser.get(id),
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
}

async function asUser<T>(userId: string, run: () => Promise<T>): Promise<T> {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`,
  );
  try {
    return await run();
  } finally {
    await db.exec("reset role;");
  }
}

const ident = (name: string) => {
  if (!/^[a-z_]+$/.test(name)) throw new Error(`Bad identifier ${name}`);
  return `"${name}"`;
};

async function rest(
  req: IncomingMessage,
  url: URL,
  userId: string,
  body: unknown,
) {
  const table = ident(url.pathname.replace("/rest/v1/", ""));
  if (req.method === "POST") {
    const rows = body as Record<string, unknown>[];
    for (const row of rows) {
      const cols = Object.keys(row);
      const values = cols.map((c) => {
        const v = row[c];
        return v !== null && typeof v === "object" && !Array.isArray(v)
          ? JSON.stringify(v)
          : v;
      });
      const updates = cols
        .filter((c) => c !== "id")
        .map((c) => `${ident(c)} = excluded.${ident(c)}`);
      await asUser(userId, () =>
        db.query(
          `insert into public.${table} (${cols.map(ident).join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})
           on conflict (id) do update set ${updates.join(", ")}`,
          values,
        ),
      );
    }
    return null;
  }

  const where: string[] = [];
  const params: unknown[] = [];
  let order = "";
  let limit = "";
  for (const [key, value] of url.searchParams) {
    if (key === "select") continue;
    if (key === "order")
      order = `order by ${ident(value.replace(/\.asc$/, ""))} asc`;
    else if (key === "limit") limit = `limit ${Number(value)}`;
    else if (value.startsWith("gt.")) {
      params.push(value.slice(3));
      where.push(`${ident(key)} > $${params.length}`);
    } else if (value.startsWith("in.(")) {
      const list = value
        .slice(4, -1)
        .split(",")
        .map((v) => v.replace(/^"|"$/g, ""));
      params.push(list);
      where.push(`${ident(key)}::text = any($${params.length})`);
    } else throw new Error(`Unsupported filter ${key}=${value}`);
  }
  const sql = `select coalesce(json_agg(t), '[]'::json) as rows from (select * from public.${table} ${
    where.length ? `where ${where.join(" and ")}` : ""
  } ${order} ${limit}) t`;
  const result = await asUser(userId, () =>
    db.query<{ rows: unknown }>(sql, params),
  );
  return result.rows[0]!.rows;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString();
  return text ? JSON.parse(text) : undefined;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body === null ? "" : JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS",
  );
  if (req.method === "OPTIONS") return void res.writeHead(204).end();

  const url = new URL(req.url!, `http://localhost:${PORT}`);
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  try {
    const body = await readBody(req);
    const path = url.pathname;

    if (path === "/auth/v1/otp") return send(res, 200, {});
    if (path === "/auth/v1/verify") {
      const { email, token: code } = body as { email: string; token: string };
      if (code !== CODE)
        return send(res, 403, {
          code: 403,
          error_code: "otp_expired",
          msg: "Token has expired or is invalid",
        });
      let userId = usersByEmail.get(email);
      if (!userId) {
        userId = randomUUID();
        usersByEmail.set(email, userId);
        emailByUser.set(userId, email);
        await db.query("insert into auth.users (id) values ($1)", [userId]);
      }
      return send(res, 200, await sessionFor(userId));
    }
    if (path === "/auth/v1/token") {
      const { refresh_token } = body as { refresh_token: string };
      const userId = userByToken.get(refresh_token);
      return userId
        ? send(res, 200, await sessionFor(userId))
        : send(res, 400, { error: "invalid_grant" });
    }
    if (path === "/auth/v1/logout") return void res.writeHead(204).end();

    const userId = token ? userByToken.get(token) : undefined;
    if (path === "/auth/v1/user") {
      return userId
        ? send(res, 200, userJson(userId))
        : send(res, 401, { msg: "invalid token" });
    }
    if (path.startsWith("/rest/v1/")) {
      if (!userId) return send(res, 401, { message: "JWT expired" });
      return send(
        res,
        req.method === "POST" ? 201 : 200,
        await rest(req, url, userId, body),
      );
    }
    send(res, 404, { message: `No fake for ${req.method} ${path}` });
  } catch (e) {
    send(res, 400, {
      message: e instanceof Error ? e.message : String(e),
      code: "fake",
    });
  }
});

server.listen(PORT, () =>
  console.log(`fake supabase on http://localhost:${PORT}`),
);
