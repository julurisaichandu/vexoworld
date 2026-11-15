import { processJobs } from "../src/lib/engine";
import { publishDue } from "../src/lib/band";

// Optional: the app also processes jobs inline (kickJobs + /api/jobs/tick).
async function main() {
  console.log("vexoworld worker running");
  for (;;) {
    try {
      await processJobs();
      await publishDue();
    } catch (e) {
      console.error("worker:", e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

void main();
