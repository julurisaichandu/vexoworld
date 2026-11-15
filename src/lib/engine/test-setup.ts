import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { vi } from "vitest";

// Each test file gets its own data dir, so the JSON store starts from the seed.
process.env.VEXOWORLD_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "vexoworld-test-"));

vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
