import type { Agent } from "@paperclipai/shared";

export type KawaiiCharacterId = "rika" | "sera" | "yuna" | "nari";

export type KawaiiCharacter = {
  id: KawaiiCharacterId;
  name: string;
  role: string;
  accent: string;
  avatarImage: string;
  sourceImage: string;
  sceneImage: string;
  dockCutinImage: string;
  referenceImage: string;
  avatarTraits: string[];
  expressions: string[];
  scenes: string[];
  accessories: string[];
  moods: string[];
};

const referenceImage = "/kawaii/characters/reference/character-lineup-reference.png";
const sourceImage = (id: KawaiiCharacterId) => `/kawaii/characters/sources/${id}-white.png`;
const sceneImage = (id: KawaiiCharacterId) => `/kawaii/characters/scenes/${id}-dialogue-scene.png`;
const dockCutinImage = (id: KawaiiCharacterId) => `/kawaii/characters/cutins/${id}-dock.png`;

export const kawaiiUserOutline = "/kawaii/generated/ceo-crest-avatar.png";

export const kawaiiCharacters: KawaiiCharacter[] = [
  {
    id: "rika",
    name: "Rika",
    role: "CTO / Engineer",
    accent: "#9a78dc",
    avatarImage: "/kawaii/characters/avatars/rika.png",
    sourceImage: sourceImage("rika"),
    sceneImage: sceneImage("rika"),
    dockCutinImage: dockCutinImage("rika"),
    referenceImage,
    avatarTraits: ["black hair with purple sheen", "violet eyes", "purple headphones", "gold code hairpin"],
    expressions: ["neutral", "happy", "thinking", "concerned", "celebrating", "confident"],
    scenes: ["engineering desk", "deployment review", "code planning", "issue detail", "late-night build room"],
    accessories: ["laptop", "headphones", "ID card", "purple hoodie", "code hairpin"],
    moods: ["focused", "energetic", "urgent", "relieved", "ship-ready"],
  },
  {
    id: "sera",
    name: "Sera",
    role: "PM / UI Designer",
    accent: "#8fb3e8",
    avatarImage: "/kawaii/characters/avatars/sera.png",
    sourceImage: sourceImage("sera"),
    sceneImage: sceneImage("sera"),
    dockCutinImage: dockCutinImage("sera"),
    referenceImage,
    avatarTraits: ["honey-blonde hair", "blue eyes", "blue bow", "stationery planner accessory"],
    expressions: ["neutral", "happy", "explaining", "thinking", "gentle concern", "approval smile"],
    scenes: ["planning board", "user-flow desk", "design review", "goal room", "onboarding workshop"],
    accessories: ["planner", "pen", "blue bow", "clipboard", "paperclip charm"],
    moods: ["calm", "helpful", "organized", "polished", "encouraging"],
  },
  {
    id: "yuna",
    name: "Yuna",
    role: "QA Agent",
    accent: "#f4a34d",
    avatarImage: "/kawaii/characters/avatars/yuna.png",
    sourceImage: sourceImage("yuna"),
    sceneImage: sceneImage("yuna"),
    dockCutinImage: dockCutinImage("yuna"),
    referenceImage,
    avatarTraits: ["silver-white hair", "amber eyes", "orange flower hair clip", "cream QA uniform"],
    expressions: ["neutral", "observing", "concerned", "strict", "happy", "resolved"],
    scenes: ["checklist desk", "test report room", "approval warning", "quality gate", "bug triage"],
    accessories: ["checklist clipboard", "orange flower clip", "test badge", "brown tie", "review pen"],
    moods: ["precise", "watchful", "cautious", "firm", "clear"],
  },
  {
    id: "nari",
    name: "Nari",
    role: "Finance Agent",
    accent: "#75c8a3",
    avatarImage: "/kawaii/characters/avatars/nari.png",
    sourceImage: sourceImage("nari"),
    sceneImage: sceneImage("nari"),
    dockCutinImage: dockCutinImage("nari"),
    referenceImage,
    avatarTraits: ["warm brown bob", "green eyes", "round glasses", "green finance ribbon"],
    expressions: ["neutral", "thinking", "concerned", "approving", "warning", "soft smile"],
    scenes: ["budget room", "approval queue", "forecast desk", "spend review", "risk meeting"],
    accessories: ["round glasses", "calculator charm", "green notebook", "ledger pen", "finance badge"],
    moods: ["careful", "gentle", "analytical", "protective", "budget-safe"],
  },
];

export function characterForAgent(
  agent?: Pick<Agent, "id" | "name" | "role" | "title"> | null,
  preferredIndex?: number,
): KawaiiCharacter {
  if (typeof preferredIndex === "number" && Number.isFinite(preferredIndex)) {
    return kawaiiCharacters[Math.abs(preferredIndex) % kawaiiCharacters.length]!;
  }

  const text = `${agent?.name ?? ""} ${agent?.role ?? ""} ${agent?.title ?? ""}`.toLowerCase();
  if (/\bceo\b/.test(text)) return kawaiiCharacters[0]!;
  if (/\b(cto|engineer|frontend|backend|architect|builder|code|devops)\b/.test(text)) return kawaiiCharacters[0]!;
  if (/\b(pm|product|designer|design|ui|ux|planning|goal)\b/.test(text)) return kawaiiCharacters[1]!;
  if (/\b(qa|test|quality|audit|review|checklist)\b/.test(text)) return kawaiiCharacters[2]!;
  if (/\b(finance|budget|ledger|cost|ops|operations|risk)\b/.test(text)) return kawaiiCharacters[3]!;

  const seed = `${agent?.id ?? ""}${agent?.name ?? ""}`;
  const hash = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return kawaiiCharacters[hash % kawaiiCharacters.length]!;
}
