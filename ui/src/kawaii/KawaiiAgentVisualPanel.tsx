import type { Agent, KawaiiAssetSet } from "@paperclipai/shared";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assetByKey, isKawaiiGenerating } from "./assets";
import { characterForAgent } from "./characterLibrary";
import { kawaiiStaffDisplayParts } from "./display";

export function KawaiiAgentVisualPanel({
  agent,
  assetSet,
  onRegenerate,
  regenerating,
}: {
  agent: Agent;
  assetSet?: KawaiiAssetSet | null;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const sceneComposite = assetByKey(assetSet, ["scene_composite"]);
  const character = characterForAgent(agent);
  const display = kawaiiStaffDisplayParts(agent, character.name);
  const sceneSrc = sceneComposite?.contentPath ?? character.sceneImage;
  const generating = regenerating || isKawaiiGenerating(assetSet);
  const dialogue = assetSet?.status === "failed"
    ? "캐릭터 이미지가 다시 필요합니다."
    : generating
      ? "백그라운드에서 캐릭터를 그리고 있습니다."
      : "다음 장면 준비가 끝났습니다.";

  return (
    <section className="kawaii-agent-stage" aria-label="Kawaii staff visual scene">
      <img src={sceneSrc} alt="" className="kawaii-agent-stage__bg" />
      <div className="kawaii-agent-stage__light" />
      <div className="kawaii-agent-stage__copy">
        <p className="kawaii-agent-stage__eyebrow">Staff Room</p>
        <h3>{display.label}</h3>
        <p>{display.title}</p>
      </div>
      {!sceneSrc && (
        <div className="kawaii-agent-stage__placeholder">
          <Sparkles className="h-8 w-8" />
        </div>
      )}
      <div className="kawaii-dialogue">
        <div>
          <span>{display.label}</span>
          <p>{dialogue}</p>
        </div>
        {onRegenerate && (
          <Button size="sm" variant="outline" onClick={onRegenerate} disabled={generating}>
            <RefreshCw className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">{generating ? "제작 중" : "다시 생성"}</span>
          </Button>
        )}
      </div>
    </section>
  );
}
