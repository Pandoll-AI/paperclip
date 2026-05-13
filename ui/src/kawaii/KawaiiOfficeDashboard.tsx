import { useEffect, useMemo } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { Bot, DollarSign, Leaf, ShieldCheck, Star, Users } from "lucide-react";
import type { Agent, KawaiiAssetSet } from "@paperclipai/shared";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { dashboardApi } from "../api/dashboard";
import { issuesApi } from "../api/issues";
import { kawaiiAssetsApi } from "../api/kawaiiAssets";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { formatCents } from "../lib/utils";
import { KawaiiPortrait, KawaiiMiniChart } from "./KawaiiVisuals";
import { needsKawaiiPolling } from "./assets";
import { kawaiiFirstName, kawaiiStaffLabel, kawaiiStaffTitle } from "./display";
import { useKawaiiSceneAssets } from "./useKawaiiSceneAssets";

function roleLabel(agent: Agent) {
  return kawaiiStaffTitle(agent);
}

function assetMap(sets: KawaiiAssetSet[] | undefined) {
  const map = new Map<string, KawaiiAssetSet>();
  for (const set of sets ?? []) {
    if (set.ownerType === "agent" && !map.has(set.ownerId)) map.set(set.ownerId, set);
  }
  return map;
}

export function KawaiiOfficeDashboard() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { backgroundImage } = useKawaiiSceneAssets();

  useEffect(() => {
    setBreadcrumbs([{ label: "Office" }]);
  }, [setBreadcrumbs]);

  const { data: summary } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId ?? "__none__"),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId ?? "__none__"),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId ?? "__none__"),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: approvals } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId ?? "__none__"),
    queryFn: () => approvalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: visualSets } = useQuery({
    queryKey: queryKeys.kawaiiAssets.list(selectedCompanyId ?? "__none__", { purpose: "staff_character" }),
    queryFn: () => kawaiiAssetsApi.list(selectedCompanyId!, { purpose: "staff_character" }),
    enabled: !!selectedCompanyId,
    refetchInterval: (query) => needsKawaiiPolling(query.state.data) ? 4_000 : false,
  });

  const visuals = useMemo(() => assetMap(visualSets), [visualSets]);
  const allAgents = agents ?? [];
  const allIssues = issues ?? [];
  const leadAgent = allAgents.find((agent) => agent.role !== "ceo") ?? allAgents[0] ?? null;
  const leadAgentIndex = leadAgent ? allAgents.findIndex((agent) => agent.id === leadAgent.id) : -1;
  const actionableApprovals = (approvals ?? []).filter((approval) => approval.status === "pending" || approval.status === "revision_requested").length;
  const pendingApprovals = approvals ? actionableApprovals : summary?.pendingApprovals ?? 0;
  const activeAgents = summary
    ? summary.agents.active + summary.agents.running
    : allAgents.filter((agent) => agent.status === "active" || agent.status === "idle" || agent.status === "running").length;
  const operationalAgents = agents
    ? allAgents.filter((agent) => agent.status !== "terminated").length
    : (summary?.agents.active ?? 0) + (summary?.agents.running ?? 0) + (summary?.agents.paused ?? 0) + (summary?.agents.error ?? 0);
  const openQuestCount = summary?.tasks.open ?? allIssues.filter((issue) => issue.status !== "done" && issue.status !== "cancelled").length;
  const doneQuestCount = summary?.tasks.done ?? allIssues.filter((issue) => issue.status === "done").length;
  const totalQuestCount = openQuestCount + doneQuestCount;
  const questCompletionPercent = totalQuestCount > 0 ? Math.round((doneQuestCount / totalQuestCount) * 100) : null;
  const activeIncidentCount = summary?.budgets.activeIncidents ?? 0;
  const pausedCount = (summary?.budgets.pausedAgents ?? 0) + (summary?.budgets.pausedProjects ?? 0);
  const riskLabel = activeIncidentCount > 0 ? "Incident" : pausedCount > 0 ? "Paused" : pendingApprovals > 0 ? "Review" : "Clear";
  const runValues = summary?.runActivity.map((day) => day.total) ?? [];
  const budgetUtilization = summary?.costs.monthBudgetCents
    ? Math.round(summary.costs.monthUtilizationPercent)
    : null;

  return (
    <div className="kawaii-page">
      <section className="kawaii-stat-strip">
        <div className="kawaii-stat"><span><Star className="h-4 w-4" /></span><div><p>Open Quests</p><strong>{openQuestCount}</strong></div></div>
        <div className="kawaii-stat"><span><DollarSign className="h-4 w-4" /></span><div><p>Budget</p><strong>{formatCents(summary?.costs.monthSpendCents ?? 0)} / {formatCents(summary?.costs.monthBudgetCents ?? 0)}</strong></div></div>
        <div className="kawaii-stat"><span><Users className="h-4 w-4" /></span><div><p>Active Agents</p><strong>{activeAgents} / {operationalAgents}</strong></div></div>
        <div className="kawaii-stat"><span><Leaf className="h-4 w-4" /></span><div><p>Risk Level</p><strong>{riskLabel}</strong></div></div>
        <div className="kawaii-stat"><span><ShieldCheck className="h-4 w-4" /></span><div><p>Pending Approvals</p><strong>{pendingApprovals}</strong></div></div>
      </section>

      <section className="kawaii-office-grid">
        <div className="kawaii-office-hero">
          <img src={backgroundImage} alt="" className="kawaii-office-hero__bg" />
          <div className="kawaii-office-hero__window" />
          <div className="kawaii-office-hero__desk" />
          <div className="kawaii-office-hero__portrait">
            <KawaiiPortrait
              agent={leadAgent}
              assetSet={leadAgent ? visuals.get(leadAgent.id) : null}
              characterIndex={leadAgentIndex >= 0 ? leadAgentIndex : undefined}
            />
          </div>
          <div className="kawaii-office-hero__nameplate">
            <strong>{leadAgent ? kawaiiFirstName(leadAgent.name) : "Mina"}</strong>
            <span>{leadAgent ? roleLabel(leadAgent) : "PM"}</span>
          </div>
        </div>

        <div className="kawaii-page">
          <div className="kawaii-page-title">
            <h2>Today's Overview</h2>
          </div>
          <div className="kawaii-overview-grid">
            {(agents ?? []).slice(0, 4).map((agent, index) => (
              <article key={agent.id} className="kawaii-card kawaii-staff-card">
                <div className="kawaii-staff-card__top">
                  <h3>{kawaiiStaffLabel(agent)}</h3>
                  <span className="kawaii-pill">{agent.status}</span>
                </div>
                <div className="kawaii-staff-card__portrait">
                  <KawaiiPortrait agent={agent} assetSet={visuals.get(agent.id)} size="card" characterIndex={index} />
                </div>
                <dl>
                  <div><dt>Queue</dt><dd>{openQuestCount > 0 ? `${openQuestCount} open` : "Clear"}</dd></div>
                  <div><dt>Status</dt><dd>{agent.status}</dd></div>
                  <div><dt>Cost</dt><dd>{formatCents(agent.spentMonthlyCents ?? 0)}</dd></div>
                  <div><dt>Role</dt><dd>{roleLabel(agent)}</dd></div>
                </dl>
              </article>
            ))}
            {(agents ?? []).length === 0 && (
              <article className="kawaii-card kawaii-staff-card">
                <Bot className="h-8 w-8" />
                <h3>No staff yet</h3>
                <p>새 Staff를 임명하면 이곳에 캐릭터 카드가 채워집니다.</p>
              </article>
            )}
          </div>

          <div className="kawaii-dashboard-bottom">
            <div className="kawaii-panel">
              <h3>Run Activity</h3>
              <KawaiiMiniChart values={runValues} />
            </div>
            <div className="kawaii-panel">
              <h3>Budget Usage</h3>
              <div className="kawaii-budget-donut"><strong>{budgetUtilization === null ? "No budget" : `${budgetUtilization}%`}</strong></div>
            </div>
            <div className="kawaii-panel">
              <h3>Quest Completion</h3>
              <div className="kawaii-budget-donut"><strong>{questCompletionPercent === null ? "No quests" : `${questCompletionPercent}%`}</strong></div>
            </div>
          </div>
        </div>
      </section>

      <Link to="/agents/all" className="sr-only">Open Staff Room</Link>
    </div>
  );
}
