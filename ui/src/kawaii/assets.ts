import type { KawaiiAssetEntry, KawaiiAssetSet } from "@paperclipai/shared";

export function assetByKey(
  set: KawaiiAssetSet | null | undefined,
  keys: string | string[],
): KawaiiAssetEntry | null {
  const wanted = Array.isArray(keys) ? keys : [keys];
  return set?.manifest.assets.find((asset) => wanted.includes(asset.key) && asset.contentPath) ?? null;
}

export function isKawaiiGenerating(set: KawaiiAssetSet | null | undefined) {
  return set?.status === "pending" || set?.status === "generating";
}

export function needsKawaiiPolling(sets: KawaiiAssetSet[] | null | undefined) {
  return Boolean(sets?.some(isKawaiiGenerating));
}

