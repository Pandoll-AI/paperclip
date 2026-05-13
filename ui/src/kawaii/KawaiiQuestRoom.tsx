import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocation, useSearchParams } from "@/lib/router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDot, GitPullRequest, ListChecks, Plus, ShieldAlert } from "lucide-react";
import type { Issue } from "@paperclipai/shared";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { EmptyState } from "../components/EmptyState";
import { IssuesList } from "../components/IssuesList";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { createIssueDetailLocationState } from "../lib/issueDetailBreadcrumb";
import { collectLiveIssueIds } from "../lib/liveIssueIds";
import { queryKeys } from "../lib/queryKeys";
import {
  buildIssuesSearchUrl,
  getNextIssuesPageOffset,
  mergeIssuePagesStable,
} from "../pages/Issues";
import { useKawaiiSceneAssets } from "./useKawaiiSceneAssets";

const WORKSPACE_FILTER_ISSUE_LIMIT = 1000;
const ISSUES_PAGE_SIZE = 500;

function countOpenIssues(issues: Issue[]) {
  return issues.filter((issue) => issue.status !== "done" && issue.status !== "cancelled").length;
}

function countReviewIssues(issues: Issue[]) {
  return issues.filter((issue) => issue.status === "in_review").length;
}

function countBlockedIssues(issues: Issue[]) {
  return issues.filter((issue) => issue.status === "blocked").length;
}

export function KawaiiQuestRoom() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { openNewIssue } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { backgroundImage } = useKawaiiSceneAssets();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const fetchNextPageInFlightRef = useRef(false);

  const urlSearch = searchParams.get("q") ?? "";
  const [searchOverride, setSearchOverride] = useState<{ search: string; locationSearch: string } | null>(null);
  const syncedSearch = useMemo(() => {
    if (typeof window !== "undefined" && searchOverride?.locationSearch === window.location.search) {
      return searchOverride.search;
    }
    return urlSearch;
  }, [searchOverride, urlSearch]);
  const participantAgentId = searchParams.get("participantAgentId") ?? undefined;
  const initialWorkspaces = searchParams.getAll("workspace").filter((workspaceId) => workspaceId.length > 0);
  const workspaceIdFilter = initialWorkspaces.length === 1 ? initialWorkspaces[0] : undefined;

  const handleSearchChange = useCallback((search: string) => {
    const nextUrl = buildIssuesSearchUrl(window.location.href, search);
    if (!nextUrl) {
      setSearchOverride(null);
      return;
    }
    window.history.replaceState(window.history.state, "", nextUrl);
    setSearchOverride({ search, locationSearch: window.location.search });
  }, []);

  useEffect(() => {
    setBreadcrumbs([{ label: "Quests" }]);
  }, [setBreadcrumbs]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 5000,
  });

  const liveIssueIds = useMemo(() => collectLiveIssueIds(liveRuns), [liveRuns]);
  const issueLinkState = useMemo(
    () =>
      createIssueDetailLocationState(
        "Quests",
        `${location.pathname}${location.search}${location.hash}`,
        "issues",
      ),
    [location.pathname, location.search, location.hash],
  );

  const issuePageSize = workspaceIdFilter ? WORKSPACE_FILTER_ISSUE_LIMIT : ISSUES_PAGE_SIZE;
  const {
    data: issuePages,
    isLoading,
    isFetchingNextPage,
    error,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [
      ...queryKeys.issues.list(selectedCompanyId!),
      "participant-agent",
      participantAgentId ?? "__all__",
      "workspace",
      workspaceIdFilter ?? "__all__",
      "with-routine-executions",
      "infinite",
      issuePageSize,
      "kawaii-quest-room",
    ],
    queryFn: ({ pageParam }) => issuesApi.list(selectedCompanyId!, {
      participantAgentId,
      workspaceId: workspaceIdFilter,
      includeRoutineExecutions: true,
      limit: issuePageSize,
      offset: pageParam,
    }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      getNextIssuesPageOffset(lastPage.length, lastPageParam, issuePageSize),
    enabled: !!selectedCompanyId,
    placeholderData: (previousData) => previousData,
  });

  const issues = useMemo(() => mergeIssuePagesStable(issuePages?.pages ?? []), [issuePages]);
  const hasMoreServerIssues = syncedSearch.trim().length === 0 && hasNextPage === true;
  const loadMoreServerIssues = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || fetchNextPageInFlightRef.current) return;
    fetchNextPageInFlightRef.current = true;
    void fetchNextPage({ cancelRefetch: false }).finally(() => {
      fetchNextPageInFlightRef.current = false;
    });
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const updateIssue = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      issuesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
    },
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={CircleDot} message="Select a company to view issues." />;
  }

  const style = { "--kawaii-scene-background": `url("${backgroundImage}")` } as CSSProperties;
  const openCount = countOpenIssues(issues);
  const reviewCount = countReviewIssues(issues);
  const blockedCount = countBlockedIssues(issues);

  return (
    <div className="kawaii-page kawaii-quest-room">
      <section className="kawaii-scene-band" style={style}>
        <div className="kawaii-scene-band__copy">
          <span>Quest Room</span>
          <h2>{selectedCompany?.name ?? "Paperclip"} quests</h2>
          <p>진행 중인 업무, 검토 요청, 막힌 항목을 한 장면에서 정리합니다.</p>
        </div>
        <div className="kawaii-scene-band__stats">
          <div><ListChecks className="h-4 w-4" /><span>Open</span><strong>{openCount}</strong></div>
          <div><GitPullRequest className="h-4 w-4" /><span>Review</span><strong>{reviewCount}</strong></div>
          <div><ShieldAlert className="h-4 w-4" /><span>Blocked</span><strong>{blockedCount}</strong></div>
        </div>
        <button type="button" className="kawaii-scene-band__action" onClick={() => openNewIssue()}>
          <Plus className="h-4 w-4" />
          New Quest
        </button>
      </section>

      <section className="kawaii-native-frame">
        <IssuesList
          issues={issues ?? []}
          isLoading={isLoading}
          isLoadingMoreIssues={isFetchingNextPage}
          error={error as Error | null}
          agents={agents}
          projects={projects}
          liveIssueIds={liveIssueIds}
          viewStateKey="paperclip:kawaii-issues-view"
          issueLinkState={issueLinkState}
          initialAssignees={searchParams.get("assignee") ? [searchParams.get("assignee")!] : undefined}
          initialWorkspaces={initialWorkspaces.length > 0 ? initialWorkspaces : undefined}
          initialSearch={syncedSearch}
          onSearchChange={handleSearchChange}
          createIssueLabel="Quest"
          searchPlaceholder="Search quests..."
          emptyMessage="No quests match the current filters or search."
          enableRoutineVisibilityFilter
          hasMoreIssues={hasMoreServerIssues}
          onLoadMoreIssues={loadMoreServerIssues}
          onUpdateIssue={(id, data) => updateIssue.mutate({ id, data })}
          searchFilters={participantAgentId || workspaceIdFilter ? { participantAgentId, workspaceId: workspaceIdFilter } : undefined}
        />
      </section>
    </div>
  );
}
