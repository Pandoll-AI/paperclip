import { useEffect, useMemo, type CSSProperties } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FolderKanban, Hexagon, Plus, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { projectsApi } from "../api/projects";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useDialogActions } from "../context/DialogContext";
import { queryKeys } from "../lib/queryKeys";
import { formatDate, projectUrl } from "../lib/utils";
import { useKawaiiSceneAssets } from "./useKawaiiSceneAssets";

export function KawaiiProjectStudio() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { openNewProject } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { backgroundImage } = useKawaiiSceneAssets();

  useEffect(() => {
    setBreadcrumbs([{ label: "Project Studio" }]);
  }, [setBreadcrumbs]);

  const { data: allProjects, isLoading, error } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const projects = useMemo(
    () => (allProjects ?? []).filter((project) => !project.archivedAt),
    [allProjects],
  );

  if (!selectedCompanyId) {
    return <EmptyState icon={Hexagon} message="Select a company to view projects." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const style = { "--kawaii-scene-background": `url("${backgroundImage}")` } as CSSProperties;
  const workspaceCount = projects.reduce((count, project) => count + (project.workspaces?.length ?? 0), 0);
  const activeCount = projects.filter((project) => project.status !== "completed" && project.status !== "cancelled").length;

  return (
    <div className="kawaii-page kawaii-project-studio">
      <section className="kawaii-scene-band" style={style}>
        <div className="kawaii-scene-band__copy">
          <span>Project Studio</span>
          <h2>{selectedCompany?.name ?? "Paperclip"} work map</h2>
          <p>프로젝트와 작업 공간을 한 장면처럼 묶어서 볼 수 있게 정리합니다.</p>
        </div>
        <div className="kawaii-scene-band__stats">
          <div><FolderKanban className="h-4 w-4" /><span>Projects</span><strong>{projects.length}</strong></div>
          <div><Workflow className="h-4 w-4" /><span>Workspaces</span><strong>{workspaceCount}</strong></div>
          <div><CalendarDays className="h-4 w-4" /><span>Active</span><strong>{activeCount}</strong></div>
        </div>
        <button type="button" className="kawaii-scene-band__action" onClick={openNewProject}>
          <Plus className="h-4 w-4" />
          Add Project
        </button>
      </section>

      <section className="kawaii-native-frame">
        <div className="kawaii-native-frame__toolbar">
          <h3>Studio Projects</h3>
          <Button size="sm" variant="outline" onClick={openNewProject}>
            <Plus className="h-4 w-4 mr-1" />
            Add Project
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error.message}</p>}

        {projects.length === 0 ? (
          <div className="kawaii-empty-scene">
            <Hexagon className="h-10 w-10" />
            <strong>No projects yet.</strong>
            <p>첫 프로젝트를 만들면 Staff가 사용할 작업 공간과 퀘스트 흐름이 이곳에 나타납니다.</p>
            <Button onClick={openNewProject}>
              <Plus className="h-4 w-4 mr-1" />
              Add Project
            </Button>
          </div>
        ) : (
          <div className="kawaii-project-grid">
            {projects.map((project) => (
              <Link key={project.id} to={projectUrl(project)} className="kawaii-project-card">
                <div>
                  <span className="kawaii-project-card__mark" style={{ background: project.color ?? undefined }} />
                  <StatusBadge status={project.status} />
                </div>
                <h3>{project.name}</h3>
                <p>{project.description || "No description yet."}</p>
                <dl>
                  <div><dt>Workspaces</dt><dd>{project.workspaces?.length ?? 0}</dd></div>
                  <div><dt>Target</dt><dd>{project.targetDate ? formatDate(project.targetDate) : "Unset"}</dd></div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
