import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { agentsApi } from "../api/agents";
import { adaptersApi } from "../api/adapters";
import { queryKeys } from "@/lib/queryKeys";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listUIAdapters } from "../adapters";
import { isVisualAdapterChoice } from "../adapters/metadata";
import { getAdapterDisplay } from "../adapters/adapter-display-registry";
import { useDisabledAdaptersSync } from "../adapters/use-disabled-adapters";
import { kawaiiCeoHonorific } from "../kawaii/display";

/**
 * Adapter types that are suitable for agent creation (excludes internal
 * system adapters like "process" and "http").
 */
const SYSTEM_ADAPTER_TYPES = new Set(["process", "http"]);

function isAgentAdapterType(type: string): boolean {
  return !SYSTEM_ADAPTER_TYPES.has(type);
}

export function NewAgentDialog() {
  const { newAgentOpen, closeNewAgent, openNewIssue } = useDialog();
  const { selectedCompany, selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const [showAdvancedCards, setShowAdvancedCards] = useState(false);
  const disabledTypes = useDisabledAdaptersSync();
  const ceoHonorific = kawaiiCeoHonorific(selectedCompany);

  // Fetch registered adapters from server (syncs disabled store + provides data)
  const { data: serverAdapters } = useQuery({
    queryKey: queryKeys.adapters.all,
    queryFn: () => adaptersApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch existing agents for the "Ask CEO" flow
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && newAgentOpen,
  });

  const ceoAgent = (agents ?? []).find((a) => a.role === "ceo");

  // Build the adapter grid from the UI registry merged with display metadata.
  // This automatically includes external/plugin adapters.
  const adapterGrid = useMemo(() => {
    const registered = listUIAdapters()
      .filter((a) =>
        isAgentAdapterType(a.type) &&
        !disabledTypes.has(a.type) &&
        isVisualAdapterChoice(a.type)
      );

    // Sort: recommended first, then alphabetical
    return registered
      .map((a) => {
        const display = getAdapterDisplay(a.type);
        return {
          value: a.type,
          label: display.label,
          desc: display.description,
          icon: display.icon,
          recommended: display.recommended,
          comingSoon: display.comingSoon,
          disabledLabel: display.disabledLabel,
        };
      })
      .sort((a, b) => {
        if (a.recommended && !b.recommended) return -1;
        if (!a.recommended && b.recommended) return 1;
        return a.label.localeCompare(b.label);
      });
  }, [disabledTypes, serverAdapters]);

  function handleAskCeo() {
    closeNewAgent();
    openNewIssue({
      assigneeAgentId: ceoAgent?.id,
      title: "Create a new agent",
      description: "(type in what kind of agent you want here)",
    });
  }

  function handleAdvancedConfig() {
    setShowAdvancedCards(true);
  }

  function handleAdvancedAdapterPick(adapterType: string) {
    closeNewAgent();
    setShowAdvancedCards(false);
    navigate(`/agents/new?adapterType=${encodeURIComponent(adapterType)}`);
  }

  return (
    <Dialog
      open={newAgentOpen}
      onOpenChange={(open) => {
        if (!open) {
          setShowAdvancedCards(false);
          closeNewAgent();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="kawaii-new-agent sm:max-w-3xl p-0 gap-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,127,110,0.18)] bg-[rgba(255,245,235,0.72)]">
          <div>
            <span className="font-serif text-xl text-[#38251f]">Staff Appointment Room</span>
            <p className="text-xs text-[#8d6b5c]">{ceoHonorific}, 새 Staff를 임명할 준비가 되었어요.</p>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            onClick={() => {
              setShowAdvancedCards(false);
              closeNewAgent();
            }}
          >
            <span className="text-lg leading-none">&times;</span>
          </Button>
        </div>

        <div className="grid gap-0 md:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-[360px] overflow-hidden bg-[linear-gradient(135deg,#ffe2cf,#fff8ea_52%,#dff3e6)]">
            <div className="absolute left-8 top-8 h-40 w-32 rounded-2xl border-8 border-white/60 bg-[linear-gradient(180deg,#ffd0b5,#fff2d6)]" />
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-[rgba(139,83,45,0.18)]" />
            <div className="absolute bottom-12 right-7 h-52 w-40 rounded-[48%_48%_36%_36%] bg-[linear-gradient(135deg,#ff987a,#d97955)] shadow-2xl">
              <div className="absolute left-1/2 top-16 h-24 w-20 -translate-x-1/2 rounded-[48%] bg-[#ffe2d4]" />
              <div className="absolute bottom-0 left-1/2 h-24 w-32 -translate-x-1/2 rounded-t-[48%] bg-[#fff7ec]" />
            </div>
            <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-white/75 p-4 shadow-xl backdrop-blur">
              <p className="text-sm font-semibold text-[#9a5d29]">Royal Hiring Attendant</p>
              <p className="mt-1 text-sm text-[#5f3b2b]">새 Staff가 태어나면 백그라운드에서 캐릭터 세트도 함께 그릴게요.</p>
            </div>
          </div>
          <div className="p-7 space-y-6">
          {!showAdvancedCards ? (
            <>
              {/* Recommendation */}
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff0df] text-[#ff7f6e]">
                  <Bot className="h-7 w-7" />
                </div>
                <p className="text-sm leading-7 text-[#6f5044]">
                  {ceoHonorific}의 명령으로 Staff 임명 퀘스트를 만들까요? 조직 구조, 권한, 어댑터는 CEO Agent가 확인하고
                  생성 이후 Staff Room에 새 캐릭터 제작 상태를 표시합니다.
                </p>
              </div>

              <Button className="w-full bg-[#ff7f6e] text-white hover:bg-[#ff6f5d]" size="lg" onClick={handleAskCeo}>
                <Bot className="h-4 w-4 mr-2" />
                CEO Agent에게 새 Staff 임명 요청
              </Button>

              {/* Advanced link */}
              <div className="text-center">
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  onClick={handleAdvancedConfig}
                >
                  제가 직접 고급 설정을 하겠습니다
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <button
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowAdvancedCards(false)}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <p className="text-sm text-muted-foreground">
                  고급 설정용 어댑터 타입을 선택하세요.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {adapterGrid.map((opt) => (
                  <button
                    key={opt.value}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-md border border-border p-3 text-xs transition-colors hover:bg-accent/50 relative",
                      opt.comingSoon && "opacity-40 cursor-not-allowed",
                    )}
                    disabled={!!opt.comingSoon}
                    title={opt.comingSoon ? opt.disabledLabel : undefined}
                    onClick={() => {
                      if (!opt.comingSoon) handleAdvancedAdapterPick(opt.value);
                    }}
                  >
                    {opt.recommended && (
                      <span className="absolute -top-1.5 right-1.5 bg-green-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                        Recommended
                      </span>
                    )}
                    <opt.icon className="h-4 w-4" />
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-muted-foreground text-[10px]">
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
