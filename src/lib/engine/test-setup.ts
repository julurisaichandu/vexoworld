import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { vi } from "vitest";

// Each test file gets its own data dir, so the JSON store starts from the seed.
process.env.AGENT_CONNECT_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "agent-connect-test-"));

vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
