import { describe, expect, it } from "vitest";
import { kawaiiCharacters, kawaiiStaticAssetVersion, kawaiiUserOutline } from "./characterLibrary";

describe("kawaii character static assets", () => {
  it("versions local character assets so browser caches do not hold replaced PNGs", () => {
    const versionSuffix = `?v=${kawaiiStaticAssetVersion}`;

    expect(kawaiiUserOutline).toContain(versionSuffix);
    for (const character of kawaiiCharacters) {
      expect(character.avatarImage).toContain(versionSuffix);
      expect(character.sourceImage).toContain(versionSuffix);
      expect(character.sceneImage).toContain(versionSuffix);
      expect(character.dockCutinImage).toContain(versionSuffix);
      expect(character.referenceImage).toContain(versionSuffix);
    }
  });
});
