import type { KawaiiAssetEntry, KawaiiAssetSet } from "@paperclipai/shared";

export function assetByKey(
  set: KawaiiAssetSet | null | undefined,
  keys: string | string[],
): KawaiiAssetEntry | null {
  const wanted = Array.isArray(keys) ? keys : [keys];
  for (const key of wanted) {
    const asset = set?.manifest.assets.find((candidate) =>
      candidate.contentPath && (candidate.key === key || candidate.key.startsWith(`${key}_`))
    );
    if (asset) return asset;
  }
  return null;
}

export function isKawaiiGenerating(set: KawaiiAssetSet | null | undefined) {
  return set?.status === "pending" || set?.status === "generating";
}

export function needsKawaiiPolling(sets: KawaiiAssetSet[] | null | undefined) {
  return Boolean(sets?.some(isKawaiiGenerating));
}
