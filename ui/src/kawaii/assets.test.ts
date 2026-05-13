import { describe, expect, it } from "vitest";
import type { KawaiiAssetSet } from "@paperclipai/shared";
import { assetByKey } from "./assets";

function setWithKeys(keys: string[]): KawaiiAssetSet {
  return {
    id: "set-1",
    companyId: "company-1",
    ownerType: "agent",
    ownerId: "agent-1",
    purpose: "staff_character",
    status: "ready",
    error: null,
    startedAt: null,
    completedAt: null,
    createdAt: "2026-05-13T00:00:00.000Z",
    updatedAt: "2026-05-13T00:00:00.000Z",
    manifest: {
      styleVersion: "test",
      generator: "imagegen-codex",
      assets: keys.map((key) => ({
        key,
        label: key,
        role: "portrait",
        contentPath: `/assets/${key}.png`,
      })),
    },
  };
}

describe("assetByKey", () => {
  it("matches generated concrete asset keys by requested prefix", () => {
    const set = setWithKeys(["avatar_square_neutral", "portrait_full_idle", "dialogue_cutin_default"]);

    expect(assetByKey(set, "avatar_square")?.key).toBe("avatar_square_neutral");
    expect(assetByKey(set, "portrait_full")?.key).toBe("portrait_full_idle");
    expect(assetByKey(set, "dialogue_cutin")?.key).toBe("dialogue_cutin_default");
  });

  it("respects requested key priority", () => {
    const set = setWithKeys(["avatar_square_neutral", "portrait_bust_neutral"]);

    expect(assetByKey(set, ["portrait_full", "portrait_bust", "avatar_square"])?.key).toBe("portrait_bust_neutral");
  });
});
