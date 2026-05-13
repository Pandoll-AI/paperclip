import { describe, expect, it } from "vitest";
import { kawaiiSceneMoodForPath } from "./useKawaiiSceneAssets";

describe("kawaiiSceneMoodForPath", () => {
  it("uses soft warning art for approval and budget rooms", () => {
    expect(kawaiiSceneMoodForPath("approval_budget_room", "/PAP/approvals/pending")).toBe("soft_warning");
    expect(kawaiiSceneMoodForPath("approval_budget_room", "/PAP/costs")).toBe("soft_warning");
  });

  it("uses night focus art for runtime rooms", () => {
    expect(kawaiiSceneMoodForPath("runtime_room", "/PAP/execution-workspaces/workspace-1")).toBe("night_focus");
  });

  it("escalates blocked quest paths to urgent art", () => {
    expect(kawaiiSceneMoodForPath("issue_quest_room", "/PAP/issues?status=blocked")).toBe("urgent");
  });

  it("defaults stable rooms to calm art", () => {
    expect(kawaiiSceneMoodForPath("project_studio", "/PAP/projects")).toBe("calm");
    expect(kawaiiSceneMoodForPath("staff_room", "/PAP/agents/all")).toBe("calm");
  });
});
