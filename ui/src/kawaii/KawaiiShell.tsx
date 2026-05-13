import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  BookOpen,
  CheckSquare,
  ClipboardList,
  DollarSign,
  Flag,
  Home,
  MessageCircle,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { KawaiiAssetSet } from "@paperclipai/shared";
import { agentsApi } from "../api/agents";
import { approvalsApi } from "../api/approvals";
import { authApi } from "../api/auth";
import { kawaiiAssetsApi, type KawaiiAssetListOptions } from "../api/kawaiiAssets";
import { SidebarCompanyMenu } from "../components/SidebarCompanyMenu";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { needsKawaiiPolling } from "./assets";
import { kawaiiCeoLabel, kawaiiStaffLabel } from "./display";
import { KawaiiAgentAvatar } from "./KawaiiAgentAvatar";
import type { KawaiiSceneId } from "./sceneRegistry";
import { useKawaiiSceneAssets } from "./useKawaiiSceneAssets";
import { useKawaiiScene } from "./useKawaiiScene";

const routeLabels: Array<{ match: string; title: string; subtitle: string; icon: LucideIcon }> = [
  { match: "/onboarding", title: "Onboarding", subtitle: "회사와 Staff를 처음 세팅하는 공간", icon: Sparkles },
  { match: "/instance/settings/adapters", title: "Adapter Settings", subtitle: "Staff가 사용할 실행 어댑터 연결", icon: Settings },
  { match: "/dashboard/live", title: "Live Office", subtitle: "실시간 실행과 시스템 흐름", icon: BarChart3 },
  { match: "/company/settings", title: "Company Settings", subtitle: "CEO 호칭, 권한, 연결 설정", icon: Settings },
  { match: "/company/export", title: "Export Room", subtitle: "회사 데이터를 정리해 내보내기", icon: ClipboardList },
  { match: "/company/import", title: "Import Room", subtitle: "외부 데이터를 회사 흐름으로 가져오기", icon: ClipboardList },
  { match: "/companies", title: "Company Hall", subtitle: "운영할 회사를 선택하고 정리하세요.", icon: Home },
  { match: "/skills", title: "Skill Library", subtitle: "Staff가 사용할 능력과 도구 관리", icon: Sparkles },
  { match: "/plugins", title: "Plugin Manager", subtitle: "외부 확장과 어댑터 연결", icon: Settings },
  { match: "/org", title: "Org Chart", subtitle: "Staff 조직 구조와 보고 흐름", icon: Users },
  { match: "/projects", title: "Project Studio", subtitle: "프로젝트별 퀘스트와 작업 공간", icon: ClipboardList },
  { match: "/workspaces", title: "Workspace Studio", subtitle: "실행 공간과 작업 상태", icon: BarChart3 },
  { match: "/search", title: "Search Desk", subtitle: "회사 기록과 업무 찾기", icon: ClipboardList },
  { match: "/routines", title: "Routine Room", subtitle: "반복 업무와 자동 실행 흐름", icon: CheckSquare },
  { match: "/execution-workspaces", title: "Runtime Room", subtitle: "실행 환경, 로그, 연결 상태", icon: BarChart3 },
  { match: "/u/", title: "Profile", subtitle: "사용자와 활동 정보", icon: Users },
  { match: "/design-guide", title: "Design Guide", subtitle: "카와이 오피스의 표시 기준", icon: Sparkles },
  { match: "/dashboard", title: "Office", subtitle: "AI 에이전트 회사 운영 대시보드", icon: Home },
  { match: "/issues", title: "Quests", subtitle: "진행 중인 업무와 검토 요청", icon: ClipboardList },
  { match: "/agents", title: "Staff Room", subtitle: "AI 에이전트 직원들을 관리하고 팀을 구성하세요.", icon: Users },
  { match: "/approvals", title: "Approval & Budget Room", subtitle: "에이전트의 요청을 검토하고 예산을 관리하세요.", icon: ShieldCheck },
  { match: "/goals", title: "Goals", subtitle: "회사 목표와 진행 상태", icon: Flag },
  { match: "/inbox", title: "Messages", subtitle: "새 알림과 대화", icon: MessageCircle },
  { match: "/costs", title: "Budget", subtitle: "지출과 제한 관리", icon: DollarSign },
  { match: "/activity", title: "Diary", subtitle: "오늘의 업무 기록", icon: BookOpen },
];

const fallbackRouteLabel = {
  match: "",
  title: "Paperclip Office",
  subtitle: "회사 운영 작업 공간",
  icon: Home,
} satisfies { match: string; title: string; subtitle: string; icon: LucideIcon };

const navItems: Array<{ to: string; label: string; icon: LucideIcon; badge?: string }> = [
  { to: "/dashboard", label: "Office", icon: Home },
  { to: "/issues", label: "Quests", icon: ClipboardList },
  { to: "/agents/all", label: "Staff", icon: Users },
  { to: "/goals", label: "Goals", icon: Flag },
  { to: "/inbox", label: "Messages", icon: MessageCircle },
  { to: "/costs", label: "Budget", icon: DollarSign },
  { to: "/activity", label: "Diary", icon: BookOpen },
  { to: "/approvals/pending", label: "Approvals", icon: ShieldCheck },
  { to: "/company/settings", label: "Settings", icon: Settings },
];

type KawaiiDialogueChoiceAction =
  | { kind: "navigate"; to: string }
  | { kind: "dialog"; target: "newAgent" | "newGoal" | "newIssue" | "newProject" };

const dialogueChoiceActions: Partial<Record<KawaiiSceneId, KawaiiDialogueChoiceAction[]>> = {
  office: [
    { kind: "navigate", to: "/approvals/pending" },
    { kind: "navigate", to: "/dashboard/live" },
    { kind: "navigate", to: "/agents/all" },
    { kind: "navigate", to: "/costs" },
  ],
  staff_room: [
    { kind: "navigate", to: "/company/settings/access" },
    { kind: "dialog", target: "newGoal" },
    { kind: "navigate", to: "/activity" },
    { kind: "navigate", to: "/org" },
  ],
  approval_budget_room: [
    { kind: "navigate", to: "/approvals/pending" },
    { kind: "navigate", to: "/approvals/all" },
    { kind: "navigate", to: "/costs" },
    { kind: "navigate", to: "/inbox/mine" },
  ],
  issue_quest_room: [
    { kind: "navigate", to: "/issues" },
    { kind: "navigate", to: "/issues?q=blocked" },
    { kind: "dialog", target: "newIssue" },
    { kind: "navigate", to: "/agents/all" },
  ],
  goal_strategy_room: [
    { kind: "navigate", to: "/goals" },
    { kind: "dialog", target: "newGoal" },
    { kind: "navigate", to: "/agents/all" },
    { kind: "navigate", to: "/dashboard" },
  ],
  inbox_message_room: [
    { kind: "navigate", to: "/inbox/mine" },
    { kind: "navigate", to: "/inbox/unread" },
    { kind: "navigate", to: "/activity" },
    { kind: "navigate", to: "/agents/all" },
  ],
  project_studio: [
    { kind: "navigate", to: "/projects" },
    { kind: "navigate", to: "/workspaces" },
    { kind: "navigate", to: "/issues?q=blocked" },
    { kind: "navigate", to: "/agents/all" },
  ],
  runtime_room: [
    { kind: "navigate", to: "/execution-workspaces" },
    { kind: "navigate", to: "/dashboard/live" },
    { kind: "navigate", to: "/routines" },
    { kind: "navigate", to: "/activity" },
  ],
  company_hall: [
    { kind: "navigate", to: "/companies" },
    { kind: "navigate", to: "/org" },
    { kind: "navigate", to: "/agents/all" },
    { kind: "navigate", to: "/activity" },
  ],
  tool_atelier: [
    { kind: "navigate", to: "/skills" },
    { kind: "navigate", to: "/search" },
    { kind: "navigate", to: "/company/export" },
    { kind: "navigate", to: "/company/settings/access" },
  ],
  settings_atelier: [
    { kind: "navigate", to: "/company/settings/access" },
    { kind: "navigate", to: "/instance/settings/adapters" },
    { kind: "navigate", to: "/company/settings" },
    { kind: "navigate", to: "/company/settings/secrets" },
  ],
};

export function resolveKawaiiDialogueChoiceAction(sceneId: KawaiiSceneId, index: number) {
  return dialogueChoiceActions[sceneId]?.[index] ?? null;
}

function routeInfo(pathname: string) {
  return routeLabels.find((item) => pathname.includes(item.match)) ?? fallbackRouteLabel;
}

function companyPath(prefix: string | null | undefined, to: string) {
  if (!prefix) return to;
  return `/${prefix}${to}`;
}

function visualMap(sets: KawaiiAssetSet[] | undefined) {
  const map = new Map<string, KawaiiAssetSet>();
  for (const set of sets ?? []) {
    if (set.ownerType === "agent") map.set(set.ownerId, set);
  }
  return map;
}

function usePendingApprovalsCount(companyId: string | null | undefined) {
  const { data: approvals } = useQuery({
    queryKey: queryKeys.approvals.list(companyId ?? "__none__"),
    queryFn: () => approvalsApi.list(companyId!),
    enabled: !!companyId,
    refetchInterval: 15_000,
  });
  return (approvals ?? []).filter((item) => item.status === "pending" || item.status === "revision_requested").length;
}

function useKawaiiCeoAssetSet(companyId: string | null | undefined) {
  const filters = useMemo(
    (): KawaiiAssetListOptions => ({
      ownerType: "company",
      ownerId: companyId ?? undefined,
      purpose: "ceo_setup",
    }),
    [companyId],
  );
  const assetsQuery = useQuery({
    queryKey: queryKeys.kawaiiAssets.list(companyId ?? "__none__", filters),
    queryFn: () => kawaiiAssetsApi.list(companyId!, filters),
    enabled: !!companyId,
    refetchInterval: (query) => needsKawaiiPolling(query.state.data) ? 4_000 : false,
  });

  return assetsQuery.data?.find((set) => set.companyId === companyId) ?? null;
}

const KawaiiCeoAssetContext = createContext<KawaiiAssetSet | null>(null);

export function KawaiiCeoAssetProvider({ children }: { children: ReactNode }) {
  const { selectedCompanyId } = useCompany();
  const ceoAssetSet = useKawaiiCeoAssetSet(selectedCompanyId);

  return (
    <KawaiiCeoAssetContext.Provider value={ceoAssetSet}>
      {children}
    </KawaiiCeoAssetContext.Provider>
  );
}

function useKawaiiCeoAsset() {
  return useContext(KawaiiCeoAssetContext);
}

function navBadge(label: string, pendingApprovals: number, fallback?: string) {
  if (label === "Approvals" && pendingApprovals > 0) return String(pendingApprovals);
  return fallback;
}

export function KawaiiSidebar() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { openNewIssue } = useDialogActions();
  const prefix = selectedCompany?.issuePrefix ?? null;
  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
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
  const visuals = useMemo(() => visualMap(visualSets), [visualSets]);
  const pendingApprovals = usePendingApprovalsCount(selectedCompanyId);
  const ceoAssetSet = useKawaiiCeoAsset();

  return (
    <aside className="kawaii-sidebar">
      <div className="kawaii-sidebar__brand">
        <div className="kawaii-brand-mark">✿</div>
        <div className="kawaii-sidebar__company-menu">
          <SidebarCompanyMenu />
        </div>
      </div>

      <button type="button" className="kawaii-sidebar__primary" onClick={() => openNewIssue()}>
        <Sparkles className="h-4 w-4" />
        New Quest
      </button>

      <nav className="kawaii-sidebar__nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const badge = navBadge(item.label, pendingApprovals, item.badge);
          return (
            <NavLink
              key={item.to}
              to={companyPath(prefix, item.to)}
              className={({ isActive }) => cn("kawaii-sidebar__item", isActive && "is-active")}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              {badge && <em>{badge}</em>}
            </NavLink>
          );
        })}
      </nav>

      <section className="kawaii-sidebar__owner" aria-label="CEO owner">
        <KawaiiAgentAvatar variant="user" assetSet={ceoAssetSet} className="kawaii-sidebar__owner-avatar" />
        <div>
          <p>CEO</p>
          <strong>{kawaiiCeoLabel(session)}</strong>
          <span>Owner approval</span>
        </div>
      </section>

      <div className="kawaii-sidebar__staff">
        <p>Staff</p>
        {(agents ?? []).slice(0, 5).map((agent, index) => (
          <NavLink key={agent.id} to={companyPath(prefix, `/agents/${agent.id}/dashboard`)}>
            <KawaiiAgentAvatar
              agent={agent}
              assetSet={visuals.get(agent.id)}
              characterIndex={index}
              className="kawaii-sidebar__mini-avatar"
            />
            <span>{kawaiiStaffLabel(agent)}</span>
          </NavLink>
        ))}
      </div>

      <div className="kawaii-sidebar__status">
        <div className="kawaii-cat" />
        <div>
          <strong>System Status</strong>
          <span>All systems operational</span>
        </div>
      </div>
    </aside>
  );
}

export function KawaiiMobileNav() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const prefix = selectedCompany?.issuePrefix ?? null;
  const pendingApprovals = usePendingApprovalsCount(selectedCompanyId);

  return (
    <nav className="kawaii-mobile-nav" aria-label="Kawaii mobile navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const badge = navBadge(item.label, pendingApprovals, item.badge);
        return (
          <NavLink
            key={item.to}
            to={companyPath(prefix, item.to)}
            className={({ isActive }) => cn("kawaii-mobile-nav__item", isActive && "is-active")}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
            {badge && <em>{badge}</em>}
          </NavLink>
        );
      })}
    </nav>
  );
}

const nativeKawaiiRoutePatterns = [
  /^\/(?:[^/]+\/)?dashboard\/?$/,
  /^\/(?:[^/]+\/)?issues\/?$/,
  /^\/(?:[^/]+\/)?projects\/?$/,
  /^\/(?:[^/]+\/)?agents\/(?:all|active|paused|error)\/?$/,
  /^\/(?:[^/]+\/)?approvals\/(?:pending|all)\/?$/,
];

export function usesNativeKawaiiBody(pathname: string) {
  return nativeKawaiiRoutePatterns.some((pattern) => pattern.test(pathname));
}

export function KawaiiPageSurface({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { backgroundImage } = useKawaiiSceneAssets();
  const style = { "--kawaii-scene-background": `url("${backgroundImage}")` } as CSSProperties;

  if (usesNativeKawaiiBody(location.pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="kawaii-legacy-frame" style={style}>
      {children}
    </div>
  );
}

export function KawaiiTopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const info = routeInfo(location.pathname);
  const Icon = info.icon;
  const { selectedCompanyId } = useCompany();
  const ceoAssetSet = useKawaiiCeoAsset();
  const inboxBadge = useInboxBadge(selectedCompanyId);
  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  return (
    <header className="kawaii-topbar">
      <div className="kawaii-topbar__title">
        <span><Icon className="h-5 w-5" /></span>
        <div>
          <h1>{info.title}</h1>
          <p>{info.subtitle}</p>
        </div>
      </div>
      <div className="kawaii-topbar__actions">
        <div className="kawaii-topbar__company">
          <SidebarCompanyMenu />
        </div>
        <button
          type="button"
          aria-label="Open notifications"
          onClick={() => navigate("/inbox/mine")}
        >
          <Bell className="h-4 w-4" />
          {inboxBadge.inbox > 0 && <em>{inboxBadge.inbox > 99 ? "99+" : inboxBadge.inbox}</em>}
        </button>
        <div className="kawaii-ceo-chip">
          <div>
            <strong>{kawaiiCeoLabel(session)}</strong>
            <span>Founder & Owner</span>
          </div>
          <KawaiiAgentAvatar variant="user" assetSet={ceoAssetSet} />
        </div>
      </div>
      {selectedCompanyId ? <span className="sr-only">Current company: {selectedCompanyId}</span> : null}
    </header>
  );
}

export function KawaiiDialogueDock() {
  const scene = useKawaiiScene();
  const navigate = useNavigate();
  const { openNewAgent, openNewGoal, openNewIssue, openNewProject } = useDialogActions();

  function runChoice(action: KawaiiDialogueChoiceAction | null) {
    if (!action) return;
    if (action.kind === "navigate") {
      navigate(action.to);
      return;
    }
    if (action.target === "newAgent") openNewAgent();
    if (action.target === "newGoal") openNewGoal();
    if (action.target === "newIssue") openNewIssue();
    if (action.target === "newProject") openNewProject();
  }

  return (
    <section className="kawaii-dialogue-dock" aria-label="Office dialogue">
      <div className="kawaii-dialogue-dock__speaker">
        <span>{scene.speakerLabel}</span>
      </div>
      <p>{scene.text}</p>
      <div className="kawaii-dialogue-dock__choices">
        {scene.choices.map((choice, index) => (
          <button
            key={choice}
            type="button"
            onClick={() => runChoice(resolveKawaiiDialogueChoiceAction(scene.id, index))}
          >
            <span>{index + 1}</span>
            {choice}
          </button>
        ))}
      </div>
      <div className="kawaii-dialogue-dock__cutin">
        <img src={scene.character.dockCutinImage} alt="" loading="lazy" />
      </div>
    </section>
  );
}
