import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "ac_session";
const WEEK = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required in production");
  return s || "dev-only-vexoworld-secret";
}

const sign = (body: string) => crypto.createHmac("sha256", secret()).update(body).digest("base64url");

/** HMAC-signed, expiring token. Used for the session cookie and for voice-agent tool calls. */
export function signToken(payload: Record<string, unknown>, ttlSec: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyToken<T extends Record<string, unknown>>(token?: string | null): (T & { exp: number }) | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return typeof data.exp === "number" && data.exp > Date.now() / 1000 ? data : null;
  } catch {
    return null;
  }
}

export async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  const t = verifyToken<{ uid: string; scope?: string }>(jar.get(COOKIE)?.value);
  return t?.scope === "session" ? t.uid : null;
}

/** For pages and server actions: redirects to /login when signed out. */
export async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) redirect("/login");
  return id;
}

/** For route handlers: cookie session. A `Bearer` voice token (Pipecat bot) counts only where the route opts in with `allowVoice`. */
export async function userIdFromRequest(req: Request, opts: { allowVoice?: boolean } = {}): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (opts.allowVoice && auth?.startsWith("Bearer ")) {
    const t = verifyToken<{ uid: string; scope?: string }>(auth.slice(7));
    return t?.scope === "voice" ? t.uid : null;
  }
  return currentUserId();
}

export async function setSession(uid: string) {
  const jar = await cookies();
  jar.set(COOKIE, signToken({ uid, scope: "session" }, WEEK), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WEEK,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored?: string): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  const a = Buffer.from(hash, "hex");
  const b = crypto.scryptSync(password, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
