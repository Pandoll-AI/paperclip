export type KawaiiAssetSetStatus = "pending" | "generating" | "ready" | "failed";
export type KawaiiAssetOwnerType = "company" | "agent" | "scene" | "user";
export type KawaiiAssetPurpose =
  | "ceo_setup"
  | "scene_background"
  | "staff_character"
  | "user_outline";

export type KawaiiAssetSlot =
  | "avatar_square_neutral"
  | "avatar_square_happy"
  | "avatar_square_focused"
  | "avatar_square_concerned"
  | "portrait_bust_neutral"
  | "portrait_bust_talking"
  | "portrait_bust_warning"
  | "portrait_full_idle"
  | "portrait_full_working"
  | "dialogue_cutin_default"
  | "dialogue_cutin_emotional"
  | "overlay_full_transparent"
  | "chibi_sticker"
  | "talking_sheet"
  | "scene_background_calm"
  | "scene_background_urgent"
  | "scene_background_celebration"
  | "scene_background_night_focus"
  | "scene_background_soft_warning"
  | "user_dotted_outline"
  | "ceo_throne_office_bg"
  | "ceo_crest_avatar"
  | "office_brand_motif";

export type KawaiiAssetRole =
  | "avatar"
  | "portrait"
  | "expression"
  | "background"
  | "dialogue"
  | "overlay"
  | "sticker"
  | "talking_sheet"
  | "scene_background"
  | "brand";

export interface KawaiiAssetEntry {
  key: KawaiiAssetSlot | string;
  label: string;
  role: KawaiiAssetRole;
  characterId?: string | null;
  expression?: string | null;
  scene?: string | null;
  mood?: string | null;
  accessory?: string | null;
  assetId?: string | null;
  contentPath?: string | null;
  prompt?: string | null;
  negativePrompt?: string | null;
  referenceImages?: string[];
  size?: string | null;
  transparent?: boolean;
  pinned?: boolean;
  status?: "planned" | "ready" | "missing" | "failed";
}

export interface KawaiiAssetSetManifest {
  styleVersion: string;
  personaVersion?: string;
  generator: "imagegen-codex";
  promptPack?: Record<string, unknown>;
  referenceManifest?: Record<string, unknown>;
  assets: KawaiiAssetEntry[];
  diagnostics?: Record<string, unknown>;
}

export interface KawaiiAssetSet {
  id: string;
  companyId: string;
  ownerType: KawaiiAssetOwnerType;
  ownerId: string;
  purpose: KawaiiAssetPurpose;
  status: KawaiiAssetSetStatus;
  manifest: KawaiiAssetSetManifest;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
