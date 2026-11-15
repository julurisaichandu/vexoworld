import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildSeed } from "./seed";
import type { TableName, Tables } from "./types";

// Optional Supabase backend (VEXOWORLD_DATA_BACKEND=supabase). Server-only: uses the secret key.
// Same semantics as the local store; each row lives in `data` jsonb, see supabase/migrations/0001_init.sql.

let client: SupabaseClient | undefined;
const db = () =>
  (client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  }));

const tbl = (t: TableName) => t.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
const check = <T>(r: { data: T; error: { message: string } | null }): T => {
  if (r.error) throw new Error(`supabase: ${r.error.message}`);
  return r.data;
};
const rowsOf = <T>(r: { data: T[] | null; error: { message: string } | null }) => check(r) ?? [];
const matches = (row: object, where: object) =>
  Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v);

type Row = { id: string; createdAt: string };
type Rec = { data: Row; version: number };

export const supabaseStore = {
  async list<K extends TableName>(
    table: K,
    where?: Partial<Tables[K]>,
    opts: { order?: "asc" | "desc"; limit?: number } = {},
  ): Promise<Tables[K][]> {
    const out: Tables[K][] = [];
    const page = 1000; // PostgREST caps a response at 1000 rows by default
    for (let from = 0; ; from += page) {
      let q = db().from(tbl(table)).select("data");
      if (where && Object.keys(where).length) q = q.contains("data", where);
      const want = opts.limit ? Math.min(page, opts.limit - from) : page;
      const rows = rowsOf(await q.order("created_at", { ascending: opts.order === "asc" }).range(from, from + want - 1));
      out.push(...rows.map((r: { data: Tables[K] }) => r.data));
      if (rows.length < want || (opts.limit && out.length >= opts.limit)) return out;
    }
  },

  async get<K extends TableName>(table: K, id: string): Promise<Tables[K] | null> {
    const r = check(await db().from(tbl(table)).select("data").eq("id", id).maybeSingle());
    return (r?.data as Tables[K]) ?? null;
  },

  async insert<K extends TableName>(table: K, full: Tables[K]): Promise<Tables[K]> {
    const { id, createdAt } = full as unknown as Row;
    check(await db().from(tbl(table)).insert({ id, created_at: createdAt, data: full }));
    return full;
  },

  /** Compare-and-set: read, check `where`, write only if `version` is unchanged; retries on a lost race. */
  async updateIf<K extends TableName>(
    table: K,
    id: string,
    where: Partial<Tables[K]>,
    patch: Partial<Tables[K]>,
    nowIso: string,
  ): Promise<Tables[K] | null> {
    for (let i = 0; i < 8; i++) {
      const rec = check(await db().from(tbl(table)).select("data,version").eq("id", id).maybeSingle()) as Rec | null;
      if (!rec || !matches(rec.data, where)) return null;
      const next = { ...rec.data, ...patch } as Tables[K];
      if ("updatedAt" in (next as object)) (next as { updatedAt?: string }).updatedAt = nowIso;
      const won = rowsOf(
        await db()
          .from(tbl(table))
          .update({ data: next, version: rec.version + 1 })
          .eq("id", id)
          .eq("version", rec.version)
          .select("id"),
      );
      if (won.length) return next;
    }
    throw new Error("supabase: updateIf contention");
  },

  async remove(table: TableName, id: string): Promise<boolean> {
    return rowsOf(await db().from(tbl(table)).delete().eq("id", id).select("id")).length > 0;
  },

  /** Deletes every row, then inserts the demo seed. Not atomic across tables. */
  async reset(): Promise<void> {
    const seed = buildSeed() as Record<string, Row[] | undefined>;
    for (const t of Object.keys(seed).concat(["jobs", "corpus", "chat", "bandSettings", "bandTranscripts"]) as TableName[]) {
      check(await db().from(tbl(t)).delete().neq("id", ""));
    }
    for (const [t, rows] of Object.entries(seed)) {
      for (let i = 0; i < (rows?.length ?? 0); i += 500) {
        const chunk = rows!.slice(i, i + 500).map((r) => ({ id: r.id, created_at: r.createdAt, data: r }));
        check(await db().from(tbl(t as TableName)).insert(chunk));
      }
    }
  },
};
