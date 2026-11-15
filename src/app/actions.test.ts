import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ requireUserId: async () => "usr_marcus", setSession: async () => {}, clearSession: async () => {}, hashPassword: () => "", verifyPassword: () => false }));
vi.mock("next/navigation", () => ({ redirect: () => {} }));

import { store } from "@/lib/store";
import { resetDemoAction, updateAgentAction, updatePermissionsAction } from "./actions";

beforeEach(() => store.reset());

describe("server actions trust nothing from the client", () => {
  it("updateAgentAction copies known keys only", async () => {
    const before = (await store.get("agents", "agt_marcus"))!;
    await updateAgentAction({ name: "Renamed", userId: "usr_sarah", budget: { messagesPerHour: 1e9, questionsPerDay: 1e9 }, createdAt: "2099-01-01" } as never);
    const after = (await store.get("agents", "agt_marcus"))!;
    expect(after.name).toBe("Renamed");
    expect({ userId: after.userId, budget: after.budget, createdAt: after.createdAt }).toEqual({ userId: before.userId, budget: before.budget, createdAt: before.createdAt });
  });

  it("updatePermissionsAction ignores unknown and non-boolean keys", async () => {
    await updatePermissionsAction({ shareAvailability: false, bogus: true, shareGoals: "yes" } as never);
    const p = (await store.get("agents", "agt_marcus"))!.permissions as unknown as Record<string, unknown>;
    expect(p.shareAvailability).toBe(false);
    expect(p.bogus).toBeUndefined();
    expect(p.shareGoals).toBe(true);
  });

  it("resetDemoAction is off unless the operator enables it", async () => {
    await expect(resetDemoAction()).rejects.toThrow("Reset is disabled.");
    expect(await store.get("users", "usr_sarah")).toBeTruthy();
  });
});
