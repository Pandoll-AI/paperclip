import type { Agent, KawaiiAssetSet } from "@paperclipai/shared";
import { cn } from "../lib/utils";
import { assetByKey, isKawaiiGenerating } from "./assets";
import { characterForAgent, kawaiiUserOutline } from "./characterLibrary";

export function KawaiiAgentAvatar({
  agent,
  assetSet,
  statusClassName,
  className,
  characterIndex,
  variant = "staff",
}: {
  agent?: Pick<Agent, "id" | "name" | "role" | "title"> | null;
  assetSet?: KawaiiAssetSet | null;
  statusClassName?: string;
  className?: string;
  characterIndex?: number;
  variant?: "staff" | "user";
}) {
  const avatar = assetByKey(
    assetSet,
    variant === "user"
      ? ["ceo_crest_avatar", "user_dotted_outline", "avatar_square", "expression_neutral"]
      : ["avatar_square", "expression_neutral"],
  );
  const generating = isKawaiiGenerating(assetSet);
  const fallbackSrc = variant === "user"
    ? kawaiiUserOutline
    : characterForAgent(agent, characterIndex).avatarImage;

  return (
    <span className={cn("kawaii-avatar", generating && "kawaii-avatar--loading", className)}>
      {avatar?.contentPath ? (
        <img src={avatar.contentPath} alt="" className="kawaii-avatar__image" loading="lazy" />
      ) : (
        <img src={fallbackSrc} alt="" className="kawaii-avatar__image" loading="lazy" />
      )}
      {statusClassName && <span className={cn("kawaii-avatar__status", statusClassName)} />}
    </span>
  );
}
