import { describe, expect, it } from "vitest";
import { redact, shareable } from "./privacy";
import type { Permissions } from "./types";

const none: Permissions = {
  shareFirstName: false, shareInterests: false, shareGoals: false, shareCoarseLocation: false,
  shareAvailability: false, allowAutoPublish: false, requirePostApproval: true,
  allowInboundRequests: true, allowObservationQuestions: true,
};

describe("redact", () => {
  it("removes emails, phones, street addresses and query URLs", () => {
    const out = redact("mail a@b.com or call (415) 555-1234, live at 123 Main St, see https://x.com/p?id=9");
    expect(out).not.toMatch(/a@b\.com|555|123 Main|id=9/);
    expect(out.match(/\[redacted\]/g)).toHaveLength(4);
  });
  it("keeps harmless text", () => {
    expect(redact("Playing badminton at 6pm tomorrow")).toBe("Playing badminton at 6pm tomorrow");
  });
});

describe("shareable", () => {
  it("drops forbidden fields", () => {
    const f = { firstName: "Sarah", area: "Mission", availability: ["tomorrow 18:00-21:00"], note: "hi" };
    expect(shareable(f, none)).toEqual({ note: "hi" });
    expect(shareable(f, { ...none, shareAvailability: true, shareCoarseLocation: true })).toEqual({
      area: "Mission", availability: ["tomorrow 18:00-21:00"], note: "hi",
    });
  });
});
