import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";
import type { Approval, Agent, KawaiiAssetSet } from "@paperclipai/shared";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { budgetsApi } from "../api/budgets";
import { kawaiiAssetsApi } from "../api/kawaiiAssets";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { formatCents } from "../lib/utils";
import { KawaiiAgentAvatar } from "./KawaiiAgentAvatar";
import { KawaiiPortrait } from "./KawaiiVisuals";
import { needsKawaiiPolling } from "./assets";
import { kawaiiCeoHonorific, kawaiiStaffLabel } from "./display";

function titleForApproval(approval: Approval) {
  const payload = approval.payload ?? {};
  const title = payload.title ?? payload.name ?? payload.action ?? payload.type;
  return typeof title === "string" && title.trim() ? title : approval.type.replace(/_/g, " ");
}

function requester(approval: Approval, agents: Agent[] | undefined) {
  return agents?.find((agent) => agent.id === approval.requestedByAgentId) ?? null;
}

function visualMap(sets: KawaiiAssetSet[] | undefined) {
  const map = new Map<string, KawaiiAssetSet>();
  for (const set of sets ?? []) if (set.ownerType === "agent") map.set(set.ownerId, set);
  return map;
}

export function KawaiiApprovalBudgetRoom() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const ceoHonorific = kawaiiCeoHonorific(selectedCompany);

  useEffect(() => {
    setBreadcrumbs([{ label: "Approval & Budget Room" }]);
  }, [setBreadcrumbs]);

  const { data: approvals } = useQuery({
    queryKey: queryKeys.approvals.list(selectedCompanyId ?? "__none__"),
    queryFn: () => approvalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId ?? "__none__"),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: budget } = useQuery({
    queryKey: queryKeys.budgets.overview(selectedCompanyId ?? "__none__"),
    queryFn: () => budgetsApi.overview(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: visualSets } = useQuery({
    queryKey: queryKeys.kawaiiAssets.list(selectedCompanyId ?? "__none__", { purpose: "staff_character" }),
    queryFn: () => kawaiiAssetsApi.list(selectedCompanyId!, { purpose: "staff_character" }),
    enabled: !!selectedCompanyId,
    refetchInterval: (query) => needsKawaiiPolling(query.state.data) ? 4_000 : false,
  });
  const visuals = useMemo(() => visualMap(visualSets), [visualSets]);
  const queue = (approvals ?? [])
    .filter((approval) => approval.status === "pending" || approval.status === "revision_requested")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const selected = queue.find((approval) => approval.id === selectedId) ?? queue[0] ?? null;
  const selectedAgent = selected ? requester(selected, agents) : null;

  useEffect(() => {
    if (!selectedId && queue[0]) setSelectedId(queue[0].id);
  }, [queue, selectedId]);

  const approve = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id, "Approved from Kawaii Approval Room"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
  });
  const reject = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id, "Rejected from Kawaii Approval Room"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
  });

  const spend = budget?.policies.reduce((sum, policy) => sum + policy.observedAmount, 0) ?? 0;
  const totalBudget = budget?.policies.reduce((sum, policy) => sum + policy.amount, 0) ?? 0;

  return (
    <div className="kawaii-page">
      <section className="kawaii-stat-strip">
        <div className="kawaii-stat"><span><Clock className="h-4 w-4" /></span><div><p>Pending Approvals</p><strong>{queue.length}</strong></div></div>
        <div className="kawaii-stat"><span><ShieldCheck className="h-4 w-4" /></span><div><p>Monthly Budget</p><strong>{formatCents(totalBudget)}</strong></div></div>
        <div className="kawaii-stat"><span><CheckCircle2 className="h-4 w-4" /></span><div><p>Spend (MTD)</p><strong>{formatCents(spend)}</strong></div></div>
        <div className="kawaii-stat"><span><AlertTriangle className="h-4 w-4" /></span><div><p>Risk Level</p><strong>{queue.length > 2 ? "Medium" : "Safe"}</strong></div></div>
      </section>

      <section className="kawaii-approval-room">
        <div className="kawaii-panel">
          <h3>Approval Queue <span className="kawaii-pill">{queue.length}</span></h3>
          <div className="kawaii-list">
            {queue.map((approval) => {
              const agent = requester(approval, agents);
              const agentIndex = agent ? (agents ?? []).findIndex((candidate) => candidate.id === agent.id) : -1;
              return (
                <button
                  key={approval.id}
                  className={selected?.id === approval.id ? "kawaii-approval-card is-active" : "kawaii-approval-card"}
                  onClick={() => setSelectedId(approval.id)}
                >
                  <KawaiiAgentAvatar
                    agent={agent}
                    assetSet={agent ? visuals.get(agent.id) : undefined}
                    characterIndex={agentIndex >= 0 ? agentIndex : undefined}
                  />
                  <span>
                    <strong>{agent ? kawaiiStaffLabel(agent) : "Board"}</strong>
                    <span>{titleForApproval(approval)}</span>
                  </span>
                </button>
              );
            })}
            {queue.length === 0 && <div><span>No pending approvals</span><strong>Safe</strong></div>}
          </div>
        </div>

        <article className="kawaii-card kawaii-decision-card">
          <h2>Approval Request</h2>
          {selected ? (
            <>
              <div className="kawaii-decision-card__body">
                <KawaiiPortrait
                  agent={selectedAgent}
                  assetSet={selectedAgent ? visuals.get(selectedAgent.id) : null}
                  characterIndex={
                    selectedAgent
                      ? (agents ?? []).findIndex((candidate) => candidate.id === selectedAgent.id)
                      : undefined
                  }
                  size="card"
                />
                <div>
                  <span className="kawaii-pill">High Priority</span>
                  <h3>{titleForApproval(selected)}</h3>
                  <p>에이전트가 {ceoHonorific}의 결정을 기다리고 있습니다. 제한 승인으로 위험을 줄이거나, 전체 승인으로 속도를 높일 수 있습니다.</p>
                  <div className="kawaii-list">
                    <div><span>Requester</span><strong>{selectedAgent ? kawaiiStaffLabel(selectedAgent) : "Board"}</strong></div>
                    <div><span>Created</span><strong>{new Date(selected.createdAt).toLocaleTimeString()}</strong></div>
                  </div>
                </div>
              </div>
              <div className="kawaii-decision-grid">
                <button onClick={() => approve.mutate(selected.id)} disabled={approve.isPending}>Approve Limited</button>
                <button onClick={() => approve.mutate(selected.id)} disabled={approve.isPending}>Approve Full</button>
                <button onClick={() => reject.mutate(selected.id)} disabled={reject.isPending}><XCircle className="inline h-4 w-4" /> Deny</button>
                <button>Ask for More Info</button>
              </div>
            </>
          ) : (
            <p>대기 중인 승인 요청이 없습니다.</p>
          )}
        </article>

        <div className="kawaii-page">
          <div className="kawaii-panel">
            <h3>Budget Overview</h3>
            <div className="kawaii-budget-donut"><strong>{formatCents(spend)}</strong></div>
            <div className="kawaii-list">
              <div><span>Remaining</span><strong>{formatCents(Math.max(0, totalBudget - spend))}</strong></div>
              <div><span>Used</span><strong>{totalBudget > 0 ? Math.round((spend / totalBudget) * 100) : 0}%</strong></div>
            </div>
          </div>
          <div className="kawaii-panel">
            <h3>Risk Forecast</h3>
            <div className="kawaii-list">
              <div><span>Today</span><strong>Safe</strong></div>
              <div><span>This Week</span><strong>{queue.length > 2 ? "Medium" : "Safe"}</strong></div>
              <div><span>Month End</span><strong>Safe</strong></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
