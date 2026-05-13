import { describe, expect, it } from "vitest";
import {
  kawaiiStaffFilterFromPathname,
  matchesKawaiiStaffFilter,
  nextKawaiiStaffInfoPanel,
  type KawaiiStaffFilterTab,
} from "./KawaiiStaffRoom";

describe("kawaii staff route filters", () => {
  it("reads status tabs after an optional company prefix", () => {
    expect(kawaiiStaffFilterFromPathname("/agents/active")).toBe("active");
    expect(kawaiiStaffFilterFromPathname("/PAP/agents/paused")).toBe("paused");
    expect(kawaiiStaffFilterFromPathname("/PAP/agents/error")).toBe("error");
    expect(kawaiiStaffFilterFromPathname("/PAP/agents/all")).toBe("all");
  });

  it("matches legacy agent status filters", () => {
    const visible = (tab: KawaiiStaffFilterTab, status: Parameters<typeof matchesKawaiiStaffFilter>[0]["status"]) =>
      matchesKawaiiStaffFilter({ status }, tab);

    expect(visible("active", "active")).toBe(true);
    expect(visible("active", "running")).toBe(true);
    expect(visible("active", "idle")).toBe(true);
    expect(visible("paused", "paused")).toBe(true);
    expect(visible("error", "error")).toBe(true);
    expect(visible("all", "terminated")).toBe(false);
  });
});

describe("kawaii staff info panel controls", () => {
  it("cycles profile panels independently from staff selection", () => {
    expect(nextKawaiiStaffInfoPanel("basic", 1)).toBe("signal");
    expect(nextKawaiiStaffInfoPanel("signal", 1)).toBe("quest");
    expect(nextKawaiiStaffInfoPanel("quest", 1)).toBe("org");
    expect(nextKawaiiStaffInfoPanel("org", 1)).toBe("basic");
    expect(nextKawaiiStaffInfoPanel("basic", -1)).toBe("org");
  });
});
