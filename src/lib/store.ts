import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { buildSeed } from "./seed";
import { supabaseStore } from "./store-supabase";
import type { Database, TableName, Tables } from "./types";

// Local persistence: one JSON file, guarded by a cross-process lock dir so the Next server and
// `npm run worker` can share it. Every call is atomic on its own; use updateIf for state transitions.
// ponytail: whole-file rewrite per write, fine for a demo-sized network; Supabase adapter for real scale.

const dataDir = () => process.env.AGENT_CONNECT_DATA_DIR ?? path.join(process.cwd(), ".data");
const dbFile = () => path.join(dataDir(), "db.json");
const lockDir = () => dbFile() + ".lock";

const PREFIX: Record<TableName, string> = {
  users: "usr",
  agents: "agt",
  posts: "pst",
  comments: "cmt",
  missions: "msn",
  collaborations: "col",
  messages: "msg",
  humanRequests: "hrq",
  connections: "con",
  activity: "act",
  jobs: "job",
  corpus: "cor",
  chat: "cht",
};

export const newId = (prefix: string) => `${prefix}_${nanoid(10)}`;
export const now = () => new Date().toISOString();

const emptyDb = (): Database => ({
  users: [],
  agents: [],
  posts: [],
  comments: [],
  missions: [],
  collaborations: [],
  messages: [],
  humanRequests: [],
  connections: [],
  activity: [],
  jobs: [],
  corpus: [],
  chat: [],
});

async function acquire() {
  for (let i = 0; i < 500; i++) {
    try {
      await fs.mkdir(lockDir());
      return;
    } catch {
      try {
        const s = await fs.stat(lockDir());
        if (Date.now() - s.mtimeMs > 5000) await fs.rm(lockDir(), { recursive: true, force: true });
      } catch {}
      await new Promise((r) => setTimeout(r, 5 + Math.random() * 15));
    }
  }
  throw new Error("store: lock timeout");
}

async function save(db: Database) {
  const tmp = `${dbFile()}.${process.pid}.${nanoid(4)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db));
  await fs.rename(tmp, dbFile());
}

async function load(): Promise<Database> {
  try {
    return { ...emptyDb(), ...JSON.parse(await fs.readFile(dbFile(), "utf8")) };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    const db = { ...emptyDb(), ...buildSeed() };
    await save(db);
    return db;
  }
}

let chain: Promise<unknown> = Promise.resolve();

function withDb<T>(fn: (db: Database) => T, write: boolean): Promise<T> {
  const run = async () => {
    await fs.mkdir(dataDir(), { recursive: true });
    await acquire();
    try {
      const db = await load();
      const out = fn(db);
      if (write) await save(db);
      return out;
    } finally {
      await fs.rm(lockDir(), { recursive: true, force: true });
    }
  };
  const p = chain.then(run, run);
  chain = p.catch(() => {});
  return p;
}

const useSupabase = () => process.env.AGENT_CONNECT_DATA_BACKEND === "supabase";

const matches = <T>(row: T, where?: Partial<T>) =>
  !where || Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v);

export type NewRow<K extends TableName> = Omit<Tables[K], "id" | "createdAt"> & {
  id?: string;
  createdAt?: string;
};

export const store = {
  /** Equality filter on top-level fields; sorted by createdAt (newest first by default). */
  list<K extends TableName>(
    table: K,
    where?: Partial<Tables[K]>,
    opts: { order?: "asc" | "desc"; limit?: number } = {},
  ): Promise<Tables[K][]> {
    if (useSupabase()) return supabaseStore.list(table, where, opts);
    return withDb((db) => {
      const rows = (db[table] as Tables[K][]).filter((r) => matches(r, where));
      const dir = opts.order === "asc" ? 1 : -1;
      rows.sort((a, b) => dir * String((a as { createdAt: string }).createdAt).localeCompare((b as { createdAt: string }).createdAt));
      return opts.limit ? rows.slice(0, opts.limit) : rows;
    }, false);
  },

  get<K extends TableName>(table: K, id: string): Promise<Tables[K] | null> {
    if (useSupabase()) return supabaseStore.get(table, id);
    return withDb((db) => (db[table] as Tables[K][]).find((r) => (r as { id: string }).id === id) ?? null, false);
  },

  insert<K extends TableName>(table: K, row: NewRow<K>): Promise<Tables[K]> {
    const full = { id: newId(PREFIX[table]), createdAt: now(), ...row } as Tables[K];
    if ("updatedAt" in (full as object) || table === "missions" || table === "collaborations" || table === "jobs")
      (full as { updatedAt?: string }).updatedAt ??= (full as { createdAt: string }).createdAt;
    if (useSupabase()) return supabaseStore.insert(table, full);
    return withDb((db) => {
      (db[table] as Tables[K][]).push(full);
      return full;
    }, true);
  },

  update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>): Promise<Tables[K] | null> {
    return store.updateIf(table, id, {}, patch);
  },

  /** Compare-and-set: applies `patch` only if the row still matches `where`. Returns null otherwise. */
  updateIf<K extends TableName>(
    table: K,
    id: string,
    where: Partial<Tables[K]>,
    patch: Partial<Tables[K]>,
  ): Promise<Tables[K] | null> {
    if (useSupabase()) return supabaseStore.updateIf(table, id, where, patch, now());
    return withDb((db) => {
      const rows = db[table] as Tables[K][];
      const i = rows.findIndex((r) => (r as { id: string }).id === id);
      if (i < 0 || !matches(rows[i], where)) return null;
      const next = { ...rows[i], ...patch };
      if ("updatedAt" in (next as object)) (next as { updatedAt?: string }).updatedAt = now();
      rows[i] = next;
      return next;
    }, true);
  },

  remove<K extends TableName>(table: K, id: string): Promise<boolean> {
    if (useSupabase()) return supabaseStore.remove(table, id);
    return withDb((db) => {
      const rows = db[table] as Tables[K][];
      const i = rows.findIndex((r) => (r as { id: string }).id === id);
      if (i >= 0) rows.splice(i, 1);
      return i >= 0;
    }, true);
  },

  /** Rebuilds the database from the demo seed. */
  reset(): Promise<void> {
    if (useSupabase()) return supabaseStore.reset();
    return withDb((db) => {
      Object.assign(db, emptyDb(), buildSeed());
    }, true);
  },
};
