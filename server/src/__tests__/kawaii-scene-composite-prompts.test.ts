import { describe, expect, it } from "vitest";
import { buildStaffPromptPlan } from "../services/kawaii/prompt-builder.js";

describe("buildStaffPromptPlan", () => {
  it("uses scene composites as the only large character presentation path", () => {
    const plan = buildStaffPromptPlan({
      id: "agent-1",
      companyId: "company-1",
      name: "Yuna",
      role: "qa",
      title: "QA",
    });

    const keys = plan.assets.map((asset) => asset.key);
    expect(keys).toContain("scene_composite_default");
    expect(keys).toContain("scene_composite_focus");
    expect(keys).toContain("scene_composite_warning");

    const sceneComposites = plan.assets.filter((asset) => asset.role === "scene_composite");
    expect(sceneComposites).toHaveLength(3);
    expect(sceneComposites.every((asset) => asset.size === "1536x1024")).toBe(true);
    expect(sceneComposites.every((asset) => asset.referenceImages?.some((image) => image.includes("/sources/")))).toBe(true);
    expect(sceneComposites.every((asset) => asset.prompt?.includes("center at 76%"))).toBe(true);
    expect(sceneComposites.every((asset) => asset.prompt?.includes("complete visual novel office scene"))).toBe(true);
  });
});
