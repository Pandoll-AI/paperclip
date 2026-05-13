import type { Agent, KawaiiAssetSet } from "@paperclipai/shared";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assetByKey, isKawaiiGenerating } from "./assets";
import { characterForAgent } from "./characterLibrary";
import { kawaiiFirstName, kawaiiStaffTitle } from "./display";

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
  const sceneSrc = sceneComposite?.contentPath ?? character.sceneImage;
  const generating = regenerating || isKawaiiGenerating(assetSet);
  const dialogue = assetSet?.status === "failed"
    ? "Visual atelier needs another pass."
    : generating
      ? "Character art is being painted in the background."
      : "Ready for the next scene.";

  return (
    <section className="kawaii-agent-stage" aria-label="Kawaii staff visual scene">
      <img src={sceneSrc} alt="" className="kawaii-agent-stage__bg" />
      <div className="kawaii-agent-stage__light" />
      <div className="kawaii-agent-stage__copy">
        <p className="kawaii-agent-stage__eyebrow">Staff Room</p>
        <h3>{kawaiiStaffTitle(agent)}, {kawaiiFirstName(agent.name)}</h3>
        <p>{kawaiiStaffTitle(agent)}</p>
      </div>
      {!sceneSrc && (
        <div className="kawaii-agent-stage__placeholder">
          <Sparkles className="h-8 w-8" />
        </div>
      )}
      <div className="kawaii-dialogue">
        <div>
          <span>{kawaiiStaffTitle(agent)}, {kawaiiFirstName(agent.name)}</span>
          <p>{dialogue}</p>
        </div>
        {onRegenerate && (
          <Button size="sm" variant="outline" onClick={onRegenerate} disabled={generating}>
            <RefreshCw className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">{generating ? "Painting" : "Regenerate"}</span>
          </Button>
        )}
      </div>
    </section>
  );
}
