import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    setupFiles: ["./src/lib/engine/test-setup.ts"],
    env: { GEMINI_API_KEY: "", VEXOWORLD_STEP_MS: "0" },
    testTimeout: 30_000,
  },
});
