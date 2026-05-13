import { useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { kawaiiAssetsApi } from "../api/kawaiiAssets";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { resolveKawaiiSceneBackground } from "./assetResolver";
import { needsKawaiiPolling } from "./assets";
import { kawaiiGeneratedAssets } from "./generatedAssets";
import type { KawaiiSceneId } from "./sceneRegistry";
import { useKawaiiScene } from "./useKawaiiScene";

export type KawaiiSceneMood = "calm" | "urgent" | "celebration" | "night_focus" | "soft_warning";

export function kawaiiSceneMoodForPath(sceneId: KawaiiSceneId, pathname: string): KawaiiSceneMood {
  if (sceneId === "approval_budget_room") return "soft_warning";
  if (sceneId === "runtime_room") return "night_focus";
  if (sceneId === "issue_quest_room" && /blocked|error|failed/i.test(pathname)) return "urgent";
  return "calm";
}

export function useKawaiiSceneAssets() {
  const location = useLocation();
  const scene = useKawaiiScene();
  const { selectedCompanyId } = useCompany();
  const mood = kawaiiSceneMoodForPath(scene.id, `${location.pathname}${location.search}`);

  const { data: sceneSets } = useQuery({
    queryKey: queryKeys.kawaiiAssets.list(selectedCompanyId ?? "__none__", {
      ownerType: "scene",
      ownerId: scene.id,
      purpose: "scene_background",
    }),
    queryFn: () => kawaiiAssetsApi.list(selectedCompanyId!, {
      ownerType: "scene",
      ownerId: scene.id,
      purpose: "scene_background",
    }),
    enabled: !!selectedCompanyId,
    refetchInterval: (query) => needsKawaiiPolling(query.state.data) ? 4_000 : false,
  });

  const sceneSet = sceneSets?.[0] ?? null;
  return {
    scene,
    mood,
    sceneSet,
    backgroundImage: resolveKawaiiSceneBackground(sceneSet, mood, kawaiiGeneratedAssets.officeBackground),
  };
}
