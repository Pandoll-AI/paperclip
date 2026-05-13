import { describe, expect, it } from "vitest";
import { usesNativeKawaiiBody } from "./KawaiiShell";

describe("usesNativeKawaiiBody", () => {
  it("only treats top-level native kawaii routes as native bodies", () => {
    expect(usesNativeKawaiiBody("/dashboard")).toBe(true);
    expect(usesNativeKawaiiBody("/KAW/dashboard")).toBe(true);
    expect(usesNativeKawaiiBody("/KAW/issues")).toBe(true);
    expect(usesNativeKawaiiBody("/KAW/projects")).toBe(true);
    expect(usesNativeKawaiiBody("/KAW/agents/all")).toBe(true);
    expect(usesNativeKawaiiBody("/KAW/agents/active")).toBe(true);
    expect(usesNativeKawaiiBody("/KAW/agents/paused")).toBe(true);
    expect(usesNativeKawaiiBody("/KAW/agents/error")).toBe(true);
    expect(usesNativeKawaiiBody("/KAW/approvals/pending")).toBe(true);
    expect(usesNativeKawaiiBody("/KAW/approvals/all")).toBe(true);
  });

  it("keeps legacy detail pages inside the kawaii legacy frame", () => {
    expect(usesNativeKawaiiBody("/KAW/agents/agent-1/dashboard")).toBe(false);
    expect(usesNativeKawaiiBody("/KAW/agents/agent-1/runs/run-1")).toBe(false);
    expect(usesNativeKawaiiBody("/KAW/projects/project-1/dashboard")).toBe(false);
    expect(usesNativeKawaiiBody("/KAW/dashboard/live")).toBe(false);
    expect(usesNativeKawaiiBody("/KAW/issues/issue-1")).toBe(false);
  });
});
