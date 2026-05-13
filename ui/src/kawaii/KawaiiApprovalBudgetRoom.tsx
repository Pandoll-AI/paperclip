import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "@/lib/router";
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

export type KawaiiApprovalFilter = "pending" | "all";

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

export function kawaiiApprovalFilterFromPathname(pathname: string): KawaiiApprovalFilter {
  const segments = pathname.split("/").filter(Boolean);
  const approvalsIndex = segments.indexOf("approvals");
  return approvalsIndex >= 0 && segments[approvalsIndex + 1] === "all" ? "all" : "pending";
}

export function isActionableApprovalStatus(status: Approval["status"]) {
  return status === "pending" || status === "revision_requested";
}

export function canRequestMoreInfo(status: Approval["status"]) {
  return status === "pending";
}

function approvalStatusLabel(status: Approval["status"]) {
  return status.replace(/_/g, " ");
}

export function KawaiiApprovalBudgetRoom() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
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
  const statusFilter = kawaiiApprovalFilterFromPathname(location.pathname);
  const pendingApprovals = useMemo(
    () => (approvals ?? []).filter((approval) => isActionableApprovalStatus(approval.status)),
    [approvals],
  );
  const visibleApprovals = useMemo(
    () => (approvals ?? [])
      .filter((approval) => statusFilter === "all" || isActionableApprovalStatus(approval.status))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [approvals, statusFilter],
  );
  const selected = visibleApprovals.find((approval) => approval.id === selectedId) ?? visibleApprovals[0] ?? null;
  const selectedAgent = selected ? requester(selected, agents) : null;
  const selectedIsActionable = selected ? isActionableApprovalStatus(selected.status) : false;

  useEffect(() => {
    if (visibleApprovals.length === 0) {
      if (selectedId) setSelectedId(null);
      return;
    }
    if (!selectedId || !visibleApprovals.some((approval) => approval.id === selectedId)) {
      setSelectedId(visibleApprovals[0].id);
    }
  }, [visibleApprovals, selectedId]);

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
  const requestMoreInfo = useMutation({
    mutationFn: (id: string) => approvalsApi.requestRevision(id, "Additional details requested from Kawaii Approval Room"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
    },
  });

  const spend = budget?.policies.reduce((sum, policy) => sum + policy.observedAmount, 0) ?? 0;
  const totalBudget = budget?.policies.reduce((sum, policy) => sum + policy.amount, 0) ?? 0;
  const riskLabel = (budget?.activeIncidents.length ?? 0) > 0
    ? "Incident"
    : pendingApprovals.length > 0
      ? "Review"
      : "Clear";

  return (
    <div className="kawaii-page">
      <section className="kawaii-stat-strip">
        <div className="kawaii-stat"><span><Clock className="h-4 w-4" /></span><div><p>Pending Approvals</p><strong>{pendingApprovals.length}</strong></div></div>
        <div className="kawaii-stat"><span><ShieldCheck className="h-4 w-4" /></span><div><p>Monthly Budget</p><strong>{formatCents(totalBudget)}</strong></div></div>
        <div className="kawaii-stat"><span><CheckCircle2 className="h-4 w-4" /></span><div><p>Spend (MTD)</p><strong>{formatCents(spend)}</strong></div></div>
        <div className="kawaii-stat"><span><AlertTriangle className="h-4 w-4" /></span><div><p>Risk Level</p><strong>{riskLabel}</strong></div></div>
      </section>

      <section className="kawaii-approval-room">
        <div className="kawaii-panel">
          <h3>{statusFilter === "all" ? "Approval History" : "Approval Queue"} <span className="kawaii-pill">{visibleApprovals.length}</span></h3>
          <div className="kawaii-list">
            {visibleApprovals.map((approval) => {
              const agent = requester(approval, agents);
              const agentIndex = agent ? (agents ?? []).findIndex((candidate) => candidate.id === agent.id) : -1;
              return (
                <button
                  type="button"
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
            {visibleApprovals.length === 0 && (
              <div>
                <span>{statusFilter === "all" ? "No approvals yet" : "No pending approvals"}</span>
                <strong>Clear</strong>
              </div>
            )}
          </div>
        </div>

        <article className="kawaii-card kawaii-decision-card">
          <h2>{statusFilter === "all" ? "Approval Detail" : "Approval Request"}</h2>
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
                  <span className="kawaii-pill">{approvalStatusLabel(selected.status)}</span>
                  <h3>{titleForApproval(selected)}</h3>
                  <p>
                    {selectedIsActionable
                      ? `에이전트가 ${ceoHonorific}의 결정을 기다리고 있습니다. 승인, 상세 확인, 거절, 추가 설명 요청 중 하나를 선택할 수 있습니다.`
                      : "이 승인 요청은 이미 처리되었습니다. 기록은 감사와 회고를 위해 유지됩니다."}
                  </p>
                  <div className="kawaii-list">
                    <div><span>Requester</span><strong>{selectedAgent ? kawaiiStaffLabel(selectedAgent) : "Board"}</strong></div>
                    <div><span>Created</span><strong>{new Date(selected.createdAt).toLocaleTimeString()}</strong></div>
                    {selected.decidedAt && (
                      <div><span>Resolved</span><strong>{new Date(selected.decidedAt).toLocaleTimeString()}</strong></div>
                    )}
                  </div>
                </div>
              </div>
              {selectedIsActionable && (
                <div className="kawaii-decision-grid">
                  <button type="button" onClick={() => approve.mutate(selected.id)} disabled={approve.isPending}>Approve</button>
                  <button type="button" onClick={() => navigate(`/approvals/${selected.id}`)}>Open Detail</button>
                  <button type="button" onClick={() => reject.mutate(selected.id)} disabled={reject.isPending}><XCircle className="inline h-4 w-4" /> Deny</button>
                  <button
                    type="button"
                    onClick={() => requestMoreInfo.mutate(selected.id)}
                    disabled={requestMoreInfo.isPending || !canRequestMoreInfo(selected.status)}
                  >
                    Ask for More Info
                  </button>
                </div>
              )}
            </>
          ) : (
            <p>{statusFilter === "all" ? "승인 기록이 없습니다." : "대기 중인 승인 요청이 없습니다."}</p>
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
            <h3>Budget Signals</h3>
            <div className="kawaii-list">
              <div><span>Active incidents</span><strong>{budget?.activeIncidents.length ?? 0}</strong></div>
              <div><span>Budget approvals</span><strong>{budget?.pendingApprovalCount ?? 0}</strong></div>
              <div><span>Paused agents</span><strong>{budget?.pausedAgentCount ?? 0}</strong></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
