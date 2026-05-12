import { useLocation } from "@/lib/router";
import { useCompany } from "../context/CompanyContext";
import { kawaiiCharacters } from "./characterLibrary";
import { kawaiiCeoHonorific } from "./display";
import { resolveKawaiiScene } from "./sceneRegistry";

export function useKawaiiScene() {
  const location = useLocation();
  const { selectedCompany } = useCompany();
  const definition = resolveKawaiiScene(location.pathname);
  const character = kawaiiCharacters.find((item) => item.id === definition.speaker.characterId) ?? kawaiiCharacters[0]!;
  const companyName = selectedCompany?.name ?? "오피스";
  const ceoHonorific = kawaiiCeoHonorific(selectedCompany);

  return {
    ...definition,
    character,
    speakerLabel: `${definition.speaker.title}, ${definition.speaker.name}`,
    ceoHonorific,
    text: definition.text({ companyName, ceoHonorific }),
  };
}
