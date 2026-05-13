import { describe, expect, it } from "vitest";
import { buildStaffPromptPlan } from "../services/kawaii/prompt-builder.js";

describe("buildStaffPromptPlan", () => {
  it("keeps stage scenes and dialogue cut-ins as separate visual assets", () => {
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
    expect(keys).toContain("dialogue_cutin_default");
    expect(keys).toContain("dialogue_cutin_emotional");

    const sceneComposites = plan.assets.filter((asset) => asset.role === "scene_composite");
    expect(sceneComposites).toHaveLength(3);
    expect(sceneComposites.every((asset) => asset.size === "1536x1024")).toBe(true);
    expect(sceneComposites.every((asset) => asset.referenceImages?.some((image) => image.includes("/sources/")))).toBe(true);
    expect(sceneComposites.every((asset) => asset.prompt?.includes("center at 76%"))).toBe(true);
    expect(sceneComposites.every((asset) => asset.prompt?.includes("complete visual novel office scene"))).toBe(true);

    const dialogueCutins = plan.assets.filter((asset) => asset.key.startsWith("dialogue_cutin_"));
    expect(dialogueCutins).toHaveLength(2);
    expect(dialogueCutins.every((asset) => asset.role === "dialogue")).toBe(true);
    expect(dialogueCutins.every((asset) => asset.prompt?.includes("background-removed"))).toBe(true);
    expect(dialogueCutins.every((asset) => asset.prompt?.includes("waist-up"))).toBe(true);
    expect(dialogueCutins.every((asset) => asset.negativePrompt?.includes("visible legs"))).toBe(true);
  });
});
