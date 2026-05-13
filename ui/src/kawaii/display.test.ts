import { describe, expect, it } from "vitest";
import {
  kawaiiCeoHonorific,
  kawaiiCeoLabel,
  kawaiiStaffDisplayParts,
  kawaiiStaffLabel,
  kawaiiStaffTitle,
} from "./display";

describe("kawaii display helpers", () => {
  it("keeps CEO identity separate from the dialogue honorific", () => {
    expect(kawaiiCeoLabel({ user: { id: "user-1", name: "SJ", email: "sj@example.com" } } as never)).toBe("CEO, SJ");
    expect(kawaiiCeoHonorific({ ceoHonorific: "대표님" })).toBe("대표님");
  });

  it("does not turn a CEO-role staff member into a fabricated CTO", () => {
    expect(kawaiiStaffTitle({ name: "CEO", role: "ceo", title: "CEO" } as never)).toBe("CEO");
  });

  it("falls back when an agent name is only a role token", () => {
    expect(kawaiiStaffDisplayParts({ name: "CEO", role: "ceo", title: "CTO" } as never, "Rika")).toEqual({
      title: "CTO",
      name: "Rika",
      label: "CTO, Rika",
    });
    expect(kawaiiStaffLabel({ name: "CEO", role: "ceo", title: "CTO" } as never)).toBe("CTO, Staff");
  });
});
