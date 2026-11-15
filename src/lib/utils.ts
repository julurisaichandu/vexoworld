export { cn } from "cn"

/** Reads a request body, giving up (null) as soon as it passes `max` bytes instead of buffering it all. */
export async function readBytes(req: Request, max: number): Promise<Uint8Array | null> {
  if (Number(req.headers.get("content-length")) > max) return null;
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** JSON body capped at 16KB; throws when it is too large or not JSON. */
export async function readJson(req: Request, max = 16 * 1024): Promise<unknown> {
  const bytes = await readBytes(req, max);
  if (!bytes) throw new Error("body too large");
  return JSON.parse(new TextDecoder().decode(bytes));
}
