import type { KawaiiAssetEntry, KawaiiAssetPurpose } from "@paperclipai/shared";
import {
  assignCharacterToEntry,
  characterBibleForText,
  characterReferenceManifest,
  KAWAII_PERSONA_VERSION,
  KAWAII_STYLE_VERSION,
  type KawaiiCharacterBible,
} from "./character-bible.js";

export type KawaiiPromptStaff = {
  id: string;
  companyId: string;
  name: string;
  role: string;
  title?: string | null;
};

export type KawaiiPromptPlan = {
  styleVersion: string;
  personaVersion: string;
  batchPrompt: string;
  negativePrompt: string;
  referenceManifest: Record<string, unknown>;
  assets: KawaiiAssetEntry[];
};

export type KawaiiSceneId =
  | "office"
  | "staff_room"
  | "approval_budget_room"
  | "issue_quest_room"
  | "goal_strategy_room"
  | "inbox_message_room"
  | "settings_atelier"
  | "project_studio"
  | "runtime_room"
  | "company_hall"
  | "tool_atelier"
  | "onboarding_throne_room";

const baseNegative = [
  "text",
  "caption",
  "watermark",
  "logo",
  "UI chrome",
  "extra fingers",
  "extra hands",
  "extra arms",
  "duplicate limbs",
  "distorted hands",
  "photorealistic face",
  "skin discoloration",
  "unfinished pasted edges",
  "face stains",
  "face blotches",
  "dark gritty mood",
  "purple-dominant generic gradient",
].join(", ");

function baseStylePrompt() {
  return [
    "Kawaii anime visual novel asset for Paperclip, an AI-agent company control plane.",
    "Warm cream, coral, honey, mint, and soft gold palette.",
    "Polished product UI atmosphere, bright daylight, soft line art, gentle paper texture.",
    "Elegant office stationery, subtle paperclip motifs, cozy professional workspace.",
    "No readable text, no labels, no watermark, no logo.",
  ].join(" ");
}

function characterIdentity(character: KawaiiCharacterBible) {
  return [
    `${character.name} identity must stay consistent.`,
    `Traits: ${character.avatarTraits.join(", ")}.`,
    `Palette: ${character.palette.join(", ")}.`,
    `Voice tone for scene intent: ${character.voiceTone}.`,
  ].join(" ");
}

function staffRoleForPrompt(agent: KawaiiPromptStaff) {
  const role = (agent.role ?? "").trim().toLowerCase();
  const title = (agent.title ?? "").trim();
  if (role === "ceo" || /\bceo\b/i.test(title)) return "CTO";
  return title || agent.role || "Staff";
}

function staffBase(agent: KawaiiPromptStaff, character: KawaiiCharacterBible) {
  const role = staffRoleForPrompt(agent);
  return [
    baseStylePrompt(),
    characterIdentity(character),
    `Paperclip staff member name: ${agent.name}. Role: ${role}.`,
    "The CEO/user is the sovereign operator and must be treated like royalty in mood and posture.",
    "Character is an adult professional worker with youthful anime styling.",
  ].join(" ");
}

function entry(input: KawaiiAssetEntry): KawaiiAssetEntry {
  return { ...input, status: "planned" };
}

function staffEntry(
  character: KawaiiCharacterBible,
  input: Omit<KawaiiAssetEntry, "referenceImages" | "characterId">,
) {
  return assignCharacterToEntry(entry(input), character);
}

export function buildStaffPromptPlan(agent: KawaiiPromptStaff): KawaiiPromptPlan {
  const role = staffRoleForPrompt(agent);
  const character = characterBibleForText(`${agent.name} ${role}`);
  const base = staffBase(agent, character);
  const negativePrompt = `${baseNegative}, ${character.negativePrompt}`;
  const sceneCompositeRule = [
    `Use ${character.sourceCharacterImage} as the approved source-character image.`,
    "Generate one complete visual novel office scene containing the approved character and environment.",
    "Canvas is 1536x1024 landscape.",
    "Character placement: full body on the right side, character center at 76% of canvas width, body height 82-90% of canvas height, head top between 5-10%, feet between 92-97%, right edge no closer than 4%, no clipping.",
    "Leave the left 58% of the canvas as readable warm office atmosphere for the interface text layer.",
    "Preserve the source character identity, face, hair, outfit family, pose language, both legs, both feet, both shoes, both arms, hands, and accessories.",
    "Anatomy constraint: exactly two arms and exactly two hands total; do not add a duplicate raised hand when the character holds an accessory.",
    "Paint the room behind and around the character so the final image feels like a single illustrated scene.",
  ].join(" ");
  const sceneNegativePrompt = [
    negativePrompt,
    "visible source-card edge",
    "hard rectangle around character",
    "unfinished pasted border",
    "missing limb",
    "missing leg",
    "one leg",
    "hollow limb",
    "distorted feet",
    "clipped head",
    "clipped shoes",
  ].join(", ");
  const dialogueCutinRule = [
    `Use ${character.sourceCharacterImage} as the approved source-character image.`,
    "Generate a background-removed visual novel dialogue cut-in PNG.",
    "Crop is waist-up, ending at the waist or upper abdomen; no legs or lower body are visible.",
    "Head, hair, shoulders, hands, and role accessory remain visible.",
    "Anatomy constraint: exactly two arms and exactly two hands total; accessories must not create extra hands.",
    "Character faces slightly toward the CEO/operator and fits a lower-right dialogue dock.",
    "No scene background, no rectangle, no frame, no UI text.",
  ].join(" ");

  const assets: KawaiiAssetEntry[] = [
    staffEntry(character, {
      key: "avatar_square_neutral",
      label: "Neutral avatar",
      role: "avatar",
      expression: "neutral",
      size: "1024x1024",
      prompt: `${base} Square app avatar, face close-up, neutral attentive expression, decorative paperclip frame, clean icon crop.`,
      negativePrompt,
    }),
    staffEntry(character, {
      key: "avatar_square_happy",
      label: "Happy avatar",
      role: "avatar",
      expression: "happy",
      size: "1024x1024",
      prompt: `${base} Square app avatar, face close-up, happy approval expression, consistent outfit and hair.`,
      negativePrompt,
    }),
    staffEntry(character, {
      key: "avatar_square_focused",
      label: "Focused avatar",
      role: "avatar",
      expression: "focused",
      size: "1024x1024",
      prompt: `${base} Square app avatar, face close-up, focused working expression, consistent character identity.`,
      negativePrompt,
    }),
    staffEntry(character, {
      key: "avatar_square_concerned",
      label: "Concerned avatar",
      role: "avatar",
      expression: "concerned",
      size: "1024x1024",
      prompt: `${base} Square app avatar, face close-up, gentle concern expression for risky decisions.`,
      negativePrompt,
    }),
    staffEntry(character, {
      key: "portrait_bust_neutral",
      label: "Neutral bust portrait",
      role: "portrait",
      expression: "neutral",
      size: "1024x1536",
      prompt: `${base} Half-body bust portrait, facing the CEO, calm professional posture, visual novel character art.`,
      negativePrompt,
    }),
    staffEntry(character, {
      key: "portrait_bust_talking",
      label: "Talking bust portrait",
      role: "portrait",
      expression: "talking",
      size: "1024x1536",
      prompt: `${base} Half-body bust portrait, speaking kindly to the CEO, one hand gesture, visual novel dialogue pose.`,
      negativePrompt,
    }),
    staffEntry(character, {
      key: "portrait_bust_warning",
      label: "Warning bust portrait",
      role: "portrait",
      expression: "warning",
      size: "1024x1536",
      prompt: `${base} Half-body bust portrait, warning or caution expression, still cute and respectful, no alarmist harshness.`,
      negativePrompt,
    }),
    staffEntry(character, {
      key: "dialogue_cutin_default",
      label: "Default dialogue cut-in",
      role: "dialogue",
      expression: "talking",
      size: "1024x1024",
      prompt: `${base} ${dialogueCutinRule} Expression: calm talking, warm and attentive.`,
      negativePrompt: `${negativePrompt}, full-body stage scene, visible legs, office background, landscape background, hard rectangular border, cropped head, missing hands, unreadable UI text`,
    }),
    staffEntry(character, {
      key: "dialogue_cutin_emotional",
      label: "Emotional dialogue cut-in",
      role: "dialogue",
      expression: "concerned",
      mood: character.allowedMoods[2],
      size: "1024x1024",
      prompt: `${base} ${dialogueCutinRule} Expression: ${character.allowedMoods[2]} but cute, suitable for approvals, warnings, or important dialogue.`,
      negativePrompt: `${negativePrompt}, full-body stage scene, visible legs, office background, landscape background, hard rectangular border, cropped head, missing hands, unreadable UI text`,
    }),
    staffEntry(character, {
      key: "portrait_full_idle",
      label: "Idle full portrait",
      role: "portrait",
      expression: "neutral",
      size: "1024x1536",
      prompt: `${base} Full-body standing character art, clear silhouette, office outfit, gentle idle pose.`,
      negativePrompt,
    }),
    staffEntry(character, {
      key: "portrait_full_working",
      label: "Working full portrait",
      role: "portrait",
      expression: "focused",
      size: "1024x1536",
      accessory: character.allowedAccessories[0],
      prompt: `${base} Full-body working pose with ${character.allowedAccessories[0]}, role-specific office accessory, clear silhouette.`,
      negativePrompt,
    }),
    staffEntry(character, {
      key: "scene_composite_default",
      label: "Default character scene",
      role: "scene_composite",
      expression: "neutral",
      scene: "office",
      size: "1536x1024",
      prompt: `${base} ${sceneCompositeRule} Scene mood: calm Paperclip office daylight, respectful visual-novel staff presence.`,
      negativePrompt: sceneNegativePrompt,
    }),
    staffEntry(character, {
      key: "scene_composite_focus",
      label: "Focused character scene",
      role: "scene_composite",
      expression: "focused",
      scene: character.allowedScenes[0],
      mood: character.allowedMoods[0],
      accessory: character.allowedAccessories[0],
      size: "1536x1024",
      prompt: `${base} ${sceneCompositeRule} Scene mood: ${character.allowedMoods[0]} ${character.allowedScenes[0]} with ${character.allowedAccessories[0]}, polished but quiet.`,
      negativePrompt: sceneNegativePrompt,
    }),
    staffEntry(character, {
      key: "scene_composite_warning",
      label: "Warning character scene",
      role: "scene_composite",
      expression: "concerned",
      scene: character.allowedScenes[2],
      mood: character.allowedMoods[2],
      size: "1536x1024",
      prompt: `${base} ${sceneCompositeRule} Scene mood: ${character.allowedMoods[2]} soft warning, visual-novel tension without harsh danger colors.`,
      negativePrompt: sceneNegativePrompt,
    }),
    staffEntry(character, {
      key: "chibi_sticker",
      label: "Chibi sticker",
      role: "sticker",
      expression: "happy",
      size: "1024x1024",
      prompt: `${base} Cute chibi sticker pose for empty states and status moments, same character identity, simple removable background.`,
      negativePrompt,
    }),
    staffEntry(character, {
      key: "talking_sheet",
      label: "Talking sheet",
      role: "talking_sheet",
      size: "1536x1024",
      prompt: `${base} Compact same-character expression sheet with neutral, happy, focused, concerned expressions, no labels, same outfit and face consistency.`,
      negativePrompt,
    }),
  ];

  return {
    styleVersion: KAWAII_STYLE_VERSION,
    personaVersion: KAWAII_PERSONA_VERSION,
    batchPrompt: [
      "Generate a consistent Paperclip kawaii staff character image set.",
      "Every item must preserve the same character identity and outfit family.",
      "Large stage panels use complete character-in-scene illustrations; the lower-right dialogue dock uses background-removed waist-up dialogue cut-ins.",
      base,
    ].join(" "),
    negativePrompt,
    referenceManifest: characterReferenceManifest(character),
    assets,
  };
}

const sceneLabels: Record<KawaiiSceneId, string> = {
  office: "main AI-agent company office, morning command room",
  staff_room: "staff room and character management atelier",
  approval_budget_room: "approval and budget room with ledgers and soft warning lights",
  issue_quest_room: "quest room for issues, boards, notes, and task planning",
  goal_strategy_room: "strategy room for company goals and roadmap planning",
  inbox_message_room: "message room with letters, notifications, and soft lamps",
  settings_atelier: "settings atelier with tools, shelves, and calm admin atmosphere",
  project_studio: "project studio with work maps, desks, and project boards",
  runtime_room: "runtime room with safe server consoles, logs, and soft desk lamps",
  company_hall: "company hall with org charts, paper records, and welcoming office light",
  tool_atelier: "tool atelier with shelves, adapters, plugin tools, and tidy records",
  onboarding_throne_room: "CEO setup throne-office with royal stationery and dotted faceless user outline",
};

const sceneMoods = [
  ["scene_background_calm", "calm", "clear daylight and quiet focus"],
  ["scene_background_urgent", "urgent", "soft warning energy without harsh danger colors"],
  ["scene_background_celebration", "celebration", "tiny celebration details, ribbons and warm sparkle"],
  ["scene_background_night_focus", "night_focus", "cozy evening focus with desk lamps"],
  ["scene_background_soft_warning", "soft_warning", "gentle caution atmosphere for approvals and risk"],
] as const;

export function buildScenePromptPlan(sceneId: KawaiiSceneId): KawaiiPromptPlan {
  const label = sceneLabels[sceneId] ?? sceneId;
  const negativePrompt = `${baseNegative}, people, character portrait, face close-up, unreadable UI text, flat single-color background`;
  const assets: KawaiiAssetEntry[] = sceneMoods.map(([key, mood, description]) => entry({
    key,
    label: `${label} ${mood}`,
    role: "scene_background",
    scene: sceneId,
    mood,
    size: "1536x1024",
    prompt: [
      baseStylePrompt(),
      `Visual novel background: ${label}.`,
      `Mood: ${description}.`,
      "No people, no character faces, no readable text, leave clear space for dialogue UI.",
    ].join(" "),
    negativePrompt,
  }));

  return {
    styleVersion: KAWAII_STYLE_VERSION,
    personaVersion: KAWAII_PERSONA_VERSION,
    batchPrompt: `Generate Paperclip kawaii visual novel scene backgrounds for ${label}. ${baseStylePrompt()}`,
    negativePrompt,
    referenceManifest: { sceneId, label, moods: sceneMoods.map(([, mood]) => mood) },
    assets,
  };
}

export function buildCeoSetupPromptPlan(companyId: string): KawaiiPromptPlan {
  const negativePrompt = [
    baseNegative,
    "human face",
    "eyes",
    "mouth",
    "nose",
    "real person",
    "portrait",
    "anime face",
  ].join(", ");
  const royalRule = [
    baseStylePrompt(),
    `Company ${companyId} CEO/user must be represented only as a faceless dotted outline or royal symbol.`,
    "Never draw a face. Use a dotted silhouette, tiny crown, paperclip crest, and gentle royal office symbolism.",
  ].join(" ");
  const assets: KawaiiAssetEntry[] = [
    entry({
      key: "user_dotted_outline",
      label: "Faceless user outline",
      role: "brand",
      size: "1024x1024",
      prompt: `${royalRule} Simple faceless dotted outline avatar on warm cream paper-texture background, no facial features.`,
      negativePrompt: `${negativePrompt}, face, facial features`,
    }),
    entry({
      key: "ceo_crest_avatar",
      label: "CEO crest avatar",
      role: "brand",
      size: "1024x1024",
      prompt: `${royalRule} Cute royal paperclip crest avatar, tiny crown, warm cream background, no person.`,
      negativePrompt,
    }),
    entry({
      key: "ceo_throne_office_bg",
      label: "CEO throne office",
      role: "background",
      size: "1536x1024",
      prompt: `${royalRule} Visual novel throne-office setup background, warm daylight, luxurious cute stationery, no people.`,
      negativePrompt,
    }),
    entry({
      key: "office_brand_motif",
      label: "Office motif",
      role: "brand",
      size: "1536x1024",
      prompt: `${royalRule} Wide brand motif background, paperclip ribbons, gold desk details, no text and no people.`,
      negativePrompt,
    }),
  ];

  return {
    styleVersion: KAWAII_STYLE_VERSION,
    personaVersion: KAWAII_PERSONA_VERSION,
    batchPrompt: `Generate Paperclip kawaii CEO setup assets for company ${companyId}. The user is faceless royalty, never a rendered face.`,
    negativePrompt,
    referenceManifest: {
      userAvatarRule: "CEO/user must be a faceless dotted outline or royal symbol; never a face.",
    },
    assets,
  };
}

export function buildKawaiiPromptPlan(input: {
  purpose: KawaiiAssetPurpose;
  companyId: string;
  ownerId: string;
  agent?: KawaiiPromptStaff;
}): KawaiiPromptPlan {
  if (input.purpose === "staff_character") {
    if (!input.agent) {
      throw new Error("staff_character prompt plan requires an agent");
    }
    return buildStaffPromptPlan(input.agent);
  }
  if (input.purpose === "scene_background") {
    return buildScenePromptPlan(input.ownerId as KawaiiSceneId);
  }
  return buildCeoSetupPromptPlan(input.companyId);
}
