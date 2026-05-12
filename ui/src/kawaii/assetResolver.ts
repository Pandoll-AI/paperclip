import type { KawaiiAssetEntry, KawaiiAssetSet } from "@paperclipai/shared";
import { assetByKey } from "./assets";

export function resolveKawaiiAsset(
  set: KawaiiAssetSet | null | undefined,
  preferredKeys: string[],
  fallbackPath: string,
): string {
  return assetByKey(set, preferredKeys)?.contentPath ?? fallbackPath;
}

export function resolveKawaiiSceneBackground(
  set: KawaiiAssetSet | null | undefined,
  mood: "calm" | "urgent" | "celebration" | "night_focus" | "soft_warning",
  fallbackPath: string,
): string {
  const key = `scene_background_${mood}`;
  return resolveKawaiiAsset(set, [key, "scene_background_calm"], fallbackPath);
}

export function listReadyKawaiiAssets(set: KawaiiAssetSet | null | undefined): KawaiiAssetEntry[] {
  return set?.manifest.assets.filter((asset) => asset.status === "ready" && asset.contentPath) ?? [];
}
