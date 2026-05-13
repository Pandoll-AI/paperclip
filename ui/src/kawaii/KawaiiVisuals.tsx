import type { Agent, KawaiiAssetSet } from "@paperclipai/shared";
import { Sparkles } from "lucide-react";
import { cn } from "../lib/utils";
import { assetByKey, isKawaiiGenerating } from "./assets";
import { characterForAgent } from "./characterLibrary";
import { kawaiiFirstName, kawaiiStaffTitle } from "./display";

export function KawaiiPortrait({
  agent,
  assetSet,
  size = "hero",
  characterIndex,
}: {
  agent?: Pick<Agent, "id" | "name" | "role" | "title"> | null;
  assetSet?: KawaiiAssetSet | null;
  size?: "hero" | "card" | "cutin";
  characterIndex?: number;
}) {
  const portrait = assetByKey(assetSet, ["portrait_full", "portrait_bust", "dialogue_cutin", "avatar_square"]);
  const generating = isKawaiiGenerating(assetSet);
  const character = characterForAgent(agent, characterIndex);
  const fallbackSrc = size === "card"
    ? character.avatarImage
    : character.overlayImage;

  return (
    <div className={cn("kawaii-portrait", `kawaii-portrait--${size}`, generating && "is-painting")}>
      {portrait?.contentPath || fallbackSrc ? (
        <img src={portrait?.contentPath ?? fallbackSrc} alt="" loading="lazy" />
      ) : (
        <div className="kawaii-portrait__placeholder">
          <div className="kawaii-portrait__hair" />
          <div className="kawaii-portrait__face" />
          <div className="kawaii-portrait__body" />
          <Sparkles className="kawaii-portrait__spark h-5 w-5" />
        </div>
      )}
      {agent && (
        <div className="kawaii-portrait__nameplate">
          <strong>{kawaiiFirstName(agent.name)}</strong>
          <span>{kawaiiStaffTitle(agent)}</span>
        </div>
      )}
    </div>
  );
}

export function KawaiiMiniChart({ values }: { values: number[] }) {
  const hasData = values.some((value) => value > 0);
  if (!hasData) {
    return (
      <div className="kawaii-mini-chart kawaii-mini-chart--empty">
        <em>No activity yet</em>
      </div>
    );
  }

  const max = Math.max(1, ...values);
  return (
    <div className="kawaii-mini-chart">
      {values.map((value, index) => (
        <span key={index} style={{ height: `${Math.max(14, (value / max) * 92)}%` }} />
      ))}
    </div>
  );
}
