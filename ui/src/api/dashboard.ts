import type { DashboardSummary, ReliabilityWeeklyReport } from "@paperclipai/shared";
import { api } from "./client";

export const dashboardApi = {
  summary: (companyId: string) => api.get<DashboardSummary>(`/companies/${companyId}/dashboard`),
  reliabilityReport: (companyId: string) =>
    api.get<ReliabilityWeeklyReport>(`/companies/${companyId}/reliability-weekly-report`),
};
