import { describe, expect, it } from "vitest";
import {
  canRequestMoreInfo,
  isActionableApprovalStatus,
  kawaiiApprovalFilterFromPathname,
} from "./KawaiiApprovalBudgetRoom";

describe("kawaii approval route filters", () => {
  it("preserves pending and all approval routes", () => {
    expect(kawaiiApprovalFilterFromPathname("/approvals/pending")).toBe("pending");
    expect(kawaiiApprovalFilterFromPathname("/PAP/approvals/pending")).toBe("pending");
    expect(kawaiiApprovalFilterFromPathname("/approvals/all")).toBe("all");
    expect(kawaiiApprovalFilterFromPathname("/PAP/approvals/all")).toBe("all");
  });

  it("treats only pending and revision-requested approvals as actionable", () => {
    expect(isActionableApprovalStatus("pending")).toBe(true);
    expect(isActionableApprovalStatus("revision_requested")).toBe(true);
    expect(isActionableApprovalStatus("approved")).toBe(false);
    expect(isActionableApprovalStatus("rejected")).toBe(false);
    expect(isActionableApprovalStatus("cancelled")).toBe(false);
  });

  it("only maps the more-info action to approvals that can request revision", () => {
    expect(canRequestMoreInfo("pending")).toBe(true);
    expect(canRequestMoreInfo("revision_requested")).toBe(false);
    expect(canRequestMoreInfo("approved")).toBe(false);
    expect(canRequestMoreInfo("rejected")).toBe(false);
  });
});
