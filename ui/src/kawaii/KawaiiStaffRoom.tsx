import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileText, Shield, Target, Users } from "lucide-react";
import type { Agent, KawaiiAssetSet } from "@paperclipai/shared";
import { agentsApi } from "../api/agents";
import { authApi } from "../api/auth";
import { issuesApi } from "../api/issues";
import { kawaiiAssetsApi } from "../api/kawaiiAssets";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { queryKeys } from "../lib/queryKeys";
import { formatCents, relativeTime } from "../lib/utils";
import { KawaiiAgentAvatar } from "./KawaiiAgentAvatar";
import { KawaiiPortrait } from "./KawaiiVisuals";
import { needsKawaiiPolling } from "./assets";
import { characterForAgent } from "./characterLibrary";
import { kawaiiCeoLabel, kawaiiStaffDisplayParts, kawaiiStaffTitle } from "./display";
import { useKawaiiSceneAssets } from "./useKawaiiSceneAssets";

export type KawaiiStaffFilterTab = "all" | "active" | "paused" | "error";

function mapVisuals(sets: KawaiiAssetSet[] | undefined) {
  const map = new Map<string, KawaiiAssetSet>();
  for (const set of sets ?? []) {
    if (set.ownerType === "agent") map.set(set.ownerId, set);
  }
  return map;
}

export function kawaiiStaffFilterFromPathname(pathname: string): KawaiiStaffFilterTab {
  const segments = pathname.split("/").filter(Boolean);
  const agentsIndex = segments.indexOf("agents");
  const tab = agentsIndex >= 0 ? segments[agentsIndex + 1] : null;
  if (tab === "active" || tab === "paused" || tab === "error") return tab;
  return "all";
}

export function matchesKawaiiStaffFilter(agent: Pick<Agent, "status">, tab: KawaiiStaffFilterTab) {
  if (agent.status === "terminated") return false;
  if (tab === "all") return true;
  if (tab === "active") return agent.status === "active" || agent.status === "running" || agent.status === "idle";
  if (tab === "paused") return agent.status === "paused";
  if (tab === "error") return agent.status === "error";
  return true;
}

function staffTitleForFilter(tab: KawaiiStaffFilterTab) {
  if (tab === "active") return "활성 Staff";
  if (tab === "paused") return "일시정지 Staff";
  if (tab === "error") return "확인 필요";
  return "전체 Staff";
}

function lastHeartbeatLabel(agent: Agent | null) {
  return agent?.lastHeartbeatAt ? relativeTime(agent.lastHeartbeatAt) : "신호 없음";
}

function displayParts(agent: Agent | null, index?: number) {
  if (!agent) return null;
  return kawaiiStaffDisplayParts(agent, characterForAgent(agent, index).name);
}

export function KawaiiStaffRoom() {
  const { selectedCompanyId } = useCompany();
  const { openNewAgent } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { backgroundImage } = useKawaiiSceneAssets();
  const location = useLocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Staff Room" }]);
  }, [setBreadcrumbs]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId ?? "__none__"),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: visualSets } = useQuery({
    queryKey: queryKeys.kawaiiAssets.list(selectedCompanyId ?? "__none__", { purpose: "staff_character" }),
    queryFn: () => kawaiiAssetsApi.list(selectedCompanyId!, { purpose: "staff_character" }),
    enabled: !!selectedCompanyId,
    refetchInterval: (query) => needsKawaiiPolling(query.state.data) ? 4_000 : false,
  });
  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  const visuals = useMemo(() => mapVisuals(visualSets), [visualSets]);
  const filterTab = kawaiiStaffFilterFromPathname(location.pathname);
  const visibleAgents = useMemo(
    () => (agents ?? []).filter((agent) => matchesKawaiiStaffFilter(agent, filterTab)),
    [agents, filterTab],
  );
  const selected = visibleAgents.find((agent) => agent.id === selectedId) ?? visibleAgents[0] ?? null;
  const selectedIndex = selected ? visibleAgents.findIndex((agent) => agent.id === selected.id) : -1;
  const selectedDisplay = displayParts(selected, selectedIndex >= 0 ? selectedIndex : undefined);
  const selectedManager = selected?.reportsTo
    ? (agents ?? []).find((agent) => agent.id === selected.reportsTo) ?? null
    : null;
  const selectedManagerIndex = selectedManager ? (agents ?? []).findIndex((agent) => agent.id === selectedManager.id) : -1;
  const selectedManagerDisplay = displayParts(selectedManager, selectedManagerIndex >= 0 ? selectedManagerIndex : undefined);
  const directReportCount = selected
    ? (agents ?? []).filter((agent) => agent.reportsTo === selected.id && agent.status !== "terminated").length
    : 0;

  const { data: assignedIssues } = useQuery({
    queryKey: selectedCompanyId && selected
      ? [...queryKeys.issues.list(selectedCompanyId), "assignee", selected.id, "kawaii-staff-room"]
      : ["issues", "__none__", "assignee", "__none__", "kawaii-staff-room"],
    queryFn: () => issuesApi.list(selectedCompanyId!, {
      assigneeAgentId: selected!.id,
      limit: 5,
    }),
    enabled: !!selectedCompanyId && !!selected,
  });

  useEffect(() => {
    if (visibleAgents.length === 0) {
      if (selectedId) setSelectedId(null);
      return;
    }
    if (!selectedId || !visibleAgents.some((agent) => agent.id === selectedId)) {
      setSelectedId(visibleAgents[0].id);
    }
  }, [visibleAgents, selectedId]);

  function selectRelativeStaff(delta: number) {
    if (visibleAgents.length <= 1) return;
    const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIndex = (currentIndex + delta + visibleAgents.length) % visibleAgents.length;
    setSelectedId(visibleAgents[nextIndex]!.id);
  }

  return (
    <div className="kawaii-staff-room">
      <section className="kawaii-card kawaii-roster">
        <div className="kawaii-page-title">
          <h2>{staffTitleForFilter(filterTab)}</h2>
          <p>{visibleAgents.length} / {agents?.length ?? 0}</p>
        </div>
        <button type="button" className="kawaii-sidebar__primary" onClick={openNewAgent}>
          + 새 Staff
        </button>
        {visibleAgents.map((agent, index) => {
          const staff = displayParts(agent, index)!;
          return (
            <button
              type="button"
              key={agent.id}
              className={selected?.id === agent.id ? "kawaii-roster__item is-active" : "kawaii-roster__item"}
              onClick={() => setSelectedId(agent.id)}
            >
              <KawaiiAgentAvatar agent={agent} assetSet={visuals.get(agent.id)} characterIndex={index} />
              <div className="kawaii-roster__text">
                <strong>{staff.name}</strong>
                <span><em>{staff.title}</em><small>{agent.status}</small></span>
              </div>
            </button>
          );
        })}
      </section>

      <section
        className="kawaii-staff-stage"
        style={{ "--kawaii-scene-background": `url("${backgroundImage}")` } as CSSProperties}
      >
        {selected ? (
          <>
            <button
              type="button"
              className="kawaii-staff-stage__nav kawaii-staff-stage__nav--prev"
              onClick={() => selectRelativeStaff(-1)}
              disabled={visibleAgents.length <= 1}
              aria-label="이전 Staff"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="kawaii-staff-stage__portrait">
              <KawaiiPortrait
                agent={selected}
                assetSet={visuals.get(selected.id)}
                characterIndex={selectedIndex >= 0 ? selectedIndex : undefined}
                showNameplate={false}
              />
            </div>
            <button
              type="button"
              className="kawaii-staff-stage__nav kawaii-staff-stage__nav--next"
              onClick={() => selectRelativeStaff(1)}
              disabled={visibleAgents.length <= 1}
              aria-label="다음 Staff"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="kawaii-staff-stage__strip">
              <span>{selectedDisplay?.title ?? kawaiiStaffTitle(selected)}</span>
              <strong>{selectedDisplay?.name ?? "Staff"}</strong>
              <p>{selected.capabilities || "업무를 준비하고 있습니다."}</p>
            </div>
          </>
        ) : (
          <div className="kawaii-staff-stage__empty">Staff가 아직 없습니다.</div>
        )}
      </section>

      <section className="kawaii-profile-grid">
        <div className="kawaii-panel kawaii-profile-card">
          <Shield className="h-5 w-5 text-orange-500" />
          <strong>기본 정보</strong>
          <div className="kawaii-list">
            <div><span>이름</span><strong>{selectedDisplay?.name ?? "-"}</strong></div>
            <div><span>직책</span><strong>{selectedDisplay?.title ?? "-"}</strong></div>
            <div><span>상태</span><strong>{selected?.status ?? "-"}</strong></div>
            <div><span>어댑터</span><strong>{selected?.adapterType ?? "-"}</strong></div>
          </div>
        </div>
        <div className="kawaii-panel kawaii-profile-card">
          <Target className="h-5 w-5 text-green-500" />
          <strong>운영 신호</strong>
          <div className="kawaii-list">
            <div><span>이번 달 지출</span><strong>{selected ? formatCents(selected.spentMonthlyCents ?? 0) : "-"}</strong></div>
            <div><span>예산 한도</span><strong>{selected ? formatCents(selected.budgetMonthlyCents ?? 0) : "-"}</strong></div>
            <div><span>마지막 신호</span><strong>{lastHeartbeatLabel(selected)}</strong></div>
            <div><span>일시정지 사유</span><strong>{selected?.pauseReason ?? "없음"}</strong></div>
          </div>
        </div>
        <div className="kawaii-panel kawaii-profile-card">
          <FileText className="h-5 w-5 text-coral-500" />
          <strong>배정된 Quest</strong>
          <div className="kawaii-list">
            {(assignedIssues ?? []).slice(0, 4).map((issue) => (
              <div key={issue.id}>
                <span>{issue.identifier ?? issue.title}</span>
                <strong>{issue.status.replace(/_/g, " ")}</strong>
              </div>
            ))}
            {(assignedIssues ?? []).length === 0 && <div><span>배정된 Quest 없음</span><strong>정리됨</strong></div>}
          </div>
        </div>
        <div className="kawaii-panel kawaii-profile-card">
          <Users className="h-5 w-5 text-purple-500" />
          <strong>조직</strong>
          <div className="kawaii-list">
            <div><span>보고 대상</span><strong>{selectedManagerDisplay?.label ?? kawaiiCeoLabel(session)}</strong></div>
            <div><span>직접 보고</span><strong>{directReportCount}</strong></div>
          </div>
        </div>
      </section>
    </div>
  );
}
