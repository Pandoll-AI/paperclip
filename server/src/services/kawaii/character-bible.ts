import type { KawaiiAssetEntry } from "@paperclipai/shared";

export type KawaiiCharacterId = "rika" | "sera" | "yuna" | "nari";

export type KawaiiCharacterBible = {
  id: KawaiiCharacterId;
  name: string;
  roleAffinity: string[];
  referenceImage: string;
  palette: string[];
  voiceTone: string;
  avatarTraits: string[];
  negativePrompt: string;
  allowedExpressions: string[];
  allowedScenes: string[];
  allowedAccessories: string[];
  allowedMoods: string[];
};

export const KAWAII_STYLE_VERSION = "paperclip-kawaii-v1";
export const KAWAII_PERSONA_VERSION = "kawaii-persona-v1";

const referenceImage = "ui/public/kawaii/characters/reference/character-lineup-reference.png";

export const kawaiiCharacterBibles: KawaiiCharacterBible[] = [
  {
    id: "rika",
    name: "Rika",
    roleAffinity: ["cto", "engineer", "frontend", "backend", "architect", "builder", "code", "devops"],
    referenceImage,
    palette: ["deep black", "violet", "soft cream", "gold"],
    voiceTone: "confident, precise, protective of the CEO",
    avatarTraits: ["black hair with purple sheen", "violet eyes", "purple headphones", "gold code hairpin"],
    negativePrompt: "no blonde hair, no green eyes, no glasses, no orange QA flower clip",
    allowedExpressions: ["neutral", "happy", "focused", "concerned", "talking", "warning"],
    allowedScenes: ["engineering desk", "deployment review", "code planning", "late-night build room"],
    allowedAccessories: ["laptop", "headphones", "ID card", "purple hoodie", "code hairpin"],
    allowedMoods: ["focused", "energetic", "urgent", "relieved", "ship-ready"],
  },
  {
    id: "sera",
    name: "Sera",
    roleAffinity: ["pm", "product", "designer", "design", "ui", "ux", "planning", "goal"],
    referenceImage,
    palette: ["honey blonde", "clear blue", "cream", "coral"],
    voiceTone: "warm, organized, gentle, courtly toward the CEO",
    avatarTraits: ["honey-blonde hair", "blue eyes", "blue bow", "stationery planner accessory"],
    negativePrompt: "no black hair, no violet eyes, no glasses, no silver-white hair",
    allowedExpressions: ["neutral", "happy", "focused", "concerned", "talking", "approval smile"],
    allowedScenes: ["planning board", "user-flow desk", "design review", "onboarding workshop"],
    allowedAccessories: ["planner", "pen", "blue bow", "clipboard", "paperclip charm"],
    allowedMoods: ["calm", "helpful", "organized", "polished", "encouraging"],
  },
  {
    id: "yuna",
    name: "Yuna",
    roleAffinity: ["qa", "test", "quality", "audit", "review", "checklist"],
    referenceImage,
    palette: ["silver white", "amber", "orange", "cream"],
    voiceTone: "careful, observant, strict when quality is at risk",
    avatarTraits: ["silver-white hair", "amber eyes", "orange flower hair clip", "cream QA uniform"],
    negativePrompt: "no black hair, no green glasses, no blue bow, no purple headphones",
    allowedExpressions: ["neutral", "observing", "focused", "concerned", "strict", "resolved"],
    allowedScenes: ["checklist desk", "test report room", "quality gate", "bug triage"],
    allowedAccessories: ["checklist clipboard", "orange flower clip", "test badge", "brown tie", "review pen"],
    allowedMoods: ["precise", "watchful", "cautious", "firm", "clear"],
  },
  {
    id: "nari",
    name: "Nari",
    roleAffinity: ["finance", "budget", "ledger", "cost", "ops", "operations", "risk"],
    referenceImage,
    palette: ["warm brown", "green", "cream", "soft gold"],
    voiceTone: "gentle, analytical, protective about budget decisions",
    avatarTraits: ["warm brown bob", "green eyes", "round glasses", "green finance ribbon"],
    negativePrompt: "no purple headphones, no blue bow, no silver-white hair, no orange flower clip",
    allowedExpressions: ["neutral", "thinking", "concerned", "approving", "warning", "soft smile"],
    allowedScenes: ["budget room", "approval queue", "forecast desk", "spend review"],
    allowedAccessories: ["round glasses", "calculator charm", "green notebook", "ledger pen", "finance badge"],
    allowedMoods: ["careful", "gentle", "analytical", "protective", "budget-safe"],
  },
];

export function characterBibleForText(text: string): KawaiiCharacterBible {
  const normalized = text.toLowerCase();
  const match = kawaiiCharacterBibles.find((character) =>
    character.roleAffinity.some((word) => new RegExp(`\\b${word}\\b`).test(normalized)),
  );
  if (match) return match;

  const hash = Array.from(normalized).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return kawaiiCharacterBibles[hash % kawaiiCharacterBibles.length]!;
}

export function characterReferenceManifest(character: KawaiiCharacterBible) {
  return {
    characterId: character.id,
    referenceImage: character.referenceImage,
    avatarTraits: character.avatarTraits,
    palette: character.palette,
    expressions: character.allowedExpressions,
    scenes: character.allowedScenes,
    accessories: character.allowedAccessories,
    moods: character.allowedMoods,
  };
}

export function assignCharacterToEntry<T extends KawaiiAssetEntry>(
  entry: T,
  character: KawaiiCharacterBible,
): T {
  return {
    ...entry,
    characterId: character.id,
    referenceImages: [character.referenceImage],
  };
}
