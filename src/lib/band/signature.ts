import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SKEW_S = 300;
const MAX_BODY = 256 * 1024;

export type VerifyResult = { ok: true; raw: string; body: unknown } | { ok: false; status: number; error: string };

export const signBand = (secret: string, timestamp: string, body: Uint8Array | string) =>
  createHmac("sha256", Buffer.from(secret, "utf8")).update(`${timestamp}.`).update(body).digest("hex");

/** Checks the capture script's HMAC (see the wire protocol in docs). Never throws. */
export async function verifyBandRequest(req: Request): Promise<VerifyResult> {
  const fail = (status: number, error: string): VerifyResult => ({ ok: false, status, error });
  const secret = process.env.VEXOWORLD_BAND_SECRET ?? "";
  if (secret.length < 32) return fail(401, "band secret not configured");
  const ts = req.headers.get("x-vexo-timestamp") ?? "";
  const sig = req.headers.get("x-vexo-signature") ?? "";
  if (!/^\d{1,12}$/.test(ts) || !/^[0-9a-fA-F]{64}$/.test(sig)) return fail(401, "missing or malformed signature headers");
  if (Math.abs(Date.now() / 1000 - Number(ts)) > MAX_SKEW_S) return fail(401, "timestamp out of range");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > MAX_BODY) return fail(413, "body too large");
  const want = Buffer.from(signBand(secret, ts, bytes), "hex");
  if (!timingSafeEqual(want, Buffer.from(sig, "hex"))) return fail(401, "bad signature");
  const raw = new TextDecoder().decode(bytes);
  try {
    return { ok: true, raw, body: JSON.parse(raw) };
  } catch {
    return fail(400, "invalid JSON");
  }
}
