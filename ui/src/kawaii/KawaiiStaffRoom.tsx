import { useEffect, useMemo, useState } from "react";
import { useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Shield, Target, Users } from "lucide-react";
import type { Agent, KawaiiAssetSet } from "@paperclipai/shared";
import { agentsApi } from "../api/agents";
import { authApi } from "../api/auth";
import { kawaiiAssetsApi } from "../api/kawaiiAssets";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { queryKeys } from "../lib/queryKeys";
import { formatCents } from "../lib/utils";
import { KawaiiAgentAvatar } from "./KawaiiAgentAvatar";
import { KawaiiPortrait } from "./KawaiiVisuals";
import { needsKawaiiPolling } from "./assets";
import { kawaiiCeoLabel, kawaiiFirstName, kawaiiStaffLabel, kawaiiStaffTitle } from "./display";

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
  if (tab === "active") return "Active Staff";
  if (tab === "paused") return "Paused Staff";
  if (tab === "error") return "Needs Attention";
  return "All Agents";
}

export function KawaiiStaffRoom() {
  const { selectedCompanyId } = useCompany();
  const { openNewAgent } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();
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

  useEffect(() => {
    if (visibleAgents.length === 0) {
      if (selectedId) setSelectedId(null);
      return;
    }
    if (!selectedId || !visibleAgents.some((agent) => agent.id === selectedId)) {
      setSelectedId(visibleAgents[0].id);
    }
  }, [visibleAgents, selectedId]);

  return (
    <div className="kawaii-staff-room">
      <section className="kawaii-card kawaii-roster">
        <div className="kawaii-page-title">
          <h2>{staffTitleForFilter(filterTab)}</h2>
          <p>{visibleAgents.length} / {agents?.length ?? 0}</p>
        </div>
        <button className="kawaii-sidebar__primary" onClick={openNewAgent}>
          + Hire Agent
        </button>
        {visibleAgents.map((agent, index) => (
          <button
            key={agent.id}
            className={selected?.id === agent.id ? "kawaii-roster__item is-active" : "kawaii-roster__item"}
            onClick={() => setSelectedId(agent.id)}
          >
            <KawaiiAgentAvatar agent={agent} assetSet={visuals.get(agent.id)} characterIndex={index} />
            <div>
              <strong>{kawaiiStaffLabel(agent)}</strong>
              <span>{agent.status}</span>
            </div>
          </button>
        ))}
      </section>

      <section className="kawaii-staff-stage">
        {selected ? (
          <>
            <div className="kawaii-staff-stage__portrait">
              <KawaiiPortrait
                agent={selected}
                assetSet={visuals.get(selected.id)}
                characterIndex={selectedIndex >= 0 ? selectedIndex : undefined}
              />
            </div>
            <div className="kawaii-staff-stage__card">
              <h2>{kawaiiStaffTitle(selected)}, {kawaiiFirstName(selected.name)}</h2>
              <p>{selected.capabilities || "I build, architect, and ship."}</p>
              <div className="kawaii-list">
                <div><span>Trust Level</span><strong>78 / 100</strong></div>
                <div><span>Today</span><strong>{formatCents(selected.spentMonthlyCents ?? 0)}</strong></div>
              </div>
            </div>
          </>
        ) : (
          <div className="kawaii-staff-stage__card">Staff가 아직 없습니다.</div>
        )}
      </section>

      <section className="kawaii-profile-grid">
        <div className="kawaii-panel kawaii-profile-card">
          <Shield className="h-5 w-5 text-orange-500" />
          <strong>Basic Information</strong>
          <div className="kawaii-list">
            <div><span>Name</span><strong>{selected ? kawaiiFirstName(selected.name) : "-"}</strong></div>
            <div><span>Role</span><strong>{selected ? kawaiiStaffTitle(selected) : "-"}</strong></div>
            <div><span>Status</span><strong>{selected?.status ?? "-"}</strong></div>
            <div><span>Work Style</span><strong>Builder</strong></div>
          </div>
        </div>
        <div className="kawaii-panel kawaii-profile-card">
          <Target className="h-5 w-5 text-green-500" />
          <strong>Skills</strong>
          <div className="kawaii-list">
            <div><span>Software Architecture</span><strong>90</strong></div>
            <div><span>Full Stack Development</span><strong>88</strong></div>
            <div><span>Problem Solving</span><strong>85</strong></div>
          </div>
        </div>
        <div className="kawaii-panel kawaii-profile-card">
          <FileText className="h-5 w-5 text-coral-500" />
          <strong>Current Goals</strong>
          <div className="kawaii-list">
            <div><span>Complete MVP scaffolding</span><strong>Active</strong></div>
            <div><span>Implement onboarding checklist UI</span><strong>In Progress</strong></div>
          </div>
        </div>
        <div className="kawaii-panel kawaii-profile-card">
          <Users className="h-5 w-5 text-purple-500" />
          <strong>Organization Chart</strong>
          <div className="kawaii-list">
            <div><span>Reports to</span><strong>{kawaiiCeoLabel(session)}</strong></div>
            <div><span>Direct reports</span><strong>2</strong></div>
          </div>
        </div>
      </section>
    </div>
  );
}
