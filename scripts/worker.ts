import { processJobs } from "../src/lib/engine";

// Optional: the app also processes jobs inline (kickJobs + /api/jobs/tick).
async function main() {
  console.log("agent-connect worker running");
  for (;;) {
    try {
      await processJobs();
    } catch (e) {
      console.error("worker:", e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

void main();
