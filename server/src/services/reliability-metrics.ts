import { and, eq, gte, inArray, isNotNull, lt, ne, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { type Db } from "@paperclipai/db";
import { activityLog, agentWakeupRequests, issueRelations, issues } from "@paperclipai/db";

const RELIABILITY_ACTIVITY_ACTIONS = [
  "issue.checked_out",
  "issue.checkout_rejected",
  "issue.updated",
  "issue.update_rejected",
  "issue.blockers_updated",
] as const;

const RELIABILITY_WAKE_REASONS = [
  "issue_assigned",
  "issue_checked_out",
  "issue_status_changed",
  "issue_commented",
  "issue_comment_mentioned",
  "issue_reopened_via_comment",
  "issue_blockers_resolved",
  "issue_children_completed",
] as const;

const HOURS_IN_MS = 60 * 60 * 1000;

export type ReliabilityTrendDirection = "up" | "down" | "flat" | "insufficient_data";

type ReliabilityEventName =
  | "issue.checkout.succeeded"
  | "issue.checkout.failed"
  | "issue.transition.succeeded"
  | "issue.transition.failed"
  | "issue.blockers.updated"
  | "issue.wake.requested"
  | "issue.wake.claimed"
  | "issue.wake.finished"
  | "issue.completion.outcome";

export type ReliabilityIssueEventV1 = {
  event_id: string;
  event_name: ReliabilityEventName;
  event_version: 1;
  event_ts: Date;
  source_table: "activity_log" | "agent_wakeup_requests";
  source_id: string;
  company_id: string;
  issue_id: string;
  issue_identifier: string;
  run_id: string | null;
  assignee_agent_id: string | null;
  assignee_user_id: string | null;
  wake_reason: string | null;
  blocker_state_unresolved_count: number;
  blocker_state_issue_ids: string[];
  status_from: string | null;
  status_to: string | null;
  outcome: string | null;
  payload: Record<string, unknown>;
};

type ReliabilityWindowMetrics = {
  checkoutSucceeded: number;
  checkoutFailed: number;
  checkoutSuccessRate: number | null;
  transitionSucceeded: number;
  transitionFailed: number;
  transitionErrorRate: number | null;
  blockerResolutionLatencyHours: number | null;
  blockerResolutionSamples: number;
  cycleTimeHours: number | null;
  cycleTimeSamples: number;
  checkoutFailureCoverage: number | null;
  checkoutFailureCoverageNumerator: number;
  checkoutFailureCoverageDenominator: number;
  transitionFailureCoverage: number | null;
  transitionFailureCoverageNumerator: number;
  transitionFailureCoverageDenominator: number;
};

type IssueSummary = {
  id: string;
  identifier: string | null;
  assigneeAgentId: string | null;
  assigneeUserId: string | null;
  startedAt: Date | null;
};

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => readString(entry))
    .filter((entry): entry is string => entry !== null);
}

function toDate(value: Date | null | undefined): Date | null {
  return value ?? null;
}

function inWindow(ts: Date | null | undefined, from: Date, to: Date): ts is Date {
  if (!ts) return false;
  return ts.getTime() >= from.getTime() && ts.getTime() < to.getTime();
}

function trendDirection(current: number | null, previous: number | null, epsilon = 1e-9): ReliabilityTrendDirection {
  if (current == null || previous == null) return "insufficient_data";
  const delta = current - previous;
  if (Math.abs(delta) <= epsilon) return "flat";
  return delta > 0 ? "up" : "down";
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function parseWindowBounds(input: { from?: Date | null; to?: Date | null; now?: Date }) {
  const now = input.now ?? new Date();
  const to = input.to ?? now;
  const from = input.from ?? new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (from.getTime() >= to.getTime()) {
    throw new Error("Invalid reliability metrics window: from must be before to");
  }
  const previousTo = from;
  const previousFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
  return { from, to, previousFrom, previousTo };
}

function readStatusTransition(payload: Record<string, unknown>): { statusFrom: string | null; statusTo: string | null } {
  const previous = readRecord(payload._previous);
  const patch = readRecord(payload.patch);
  return {
    statusFrom: readString(previous.status) ?? readString(payload.previousStatus) ?? readString(payload.reopenedFrom),
    statusTo: readString(payload.status) ?? readString(patch.status),
  };
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && value !== "";
}

function coverageForEvents(
  events: ReliabilityIssueEventV1[],
  requiredFields: Array<keyof ReliabilityIssueEventV1>,
): { value: number | null; numerator: number; denominator: number } {
  if (events.length === 0) {
    return { value: null, numerator: 0, denominator: 0 };
  }

  const covered = events.filter((event) => requiredFields.every((field) => hasValue(event[field]))).length;
  return {
    value: covered / events.length,
    numerator: covered,
    denominator: events.length,
  };
}

function normalizeBlockerState(input: {
  reason?: string | null;
  payload: Record<string, unknown>;
  fallbackIssueId: string;
  unresolvedByIssueId: Map<string, string[]>;
}): { ids: string[]; count: number } {
  if (input.reason === "issue_blockers_resolved") {
    return { ids: [], count: 0 };
  }

  const blockedByIssueIds = readStringArray(input.payload.blockedByIssueIds);
  const unresolvedBlockerIssueIds = readStringArray(input.payload.unresolvedBlockerIssueIds);
  const blockerIssueIds = readStringArray(input.payload.blockerIssueIds);
  const directIds = blockedByIssueIds.length > 0
    ? blockedByIssueIds
    : unresolvedBlockerIssueIds.length > 0
      ? unresolvedBlockerIssueIds
      : blockerIssueIds;

  const blockerIds = directIds.length > 0
    ? directIds
    : (input.unresolvedByIssueId.get(input.fallbackIssueId) ?? []);

  return { ids: blockerIds, count: blockerIds.length };
}

function startMapFromIssues(issueRows: IssueSummary[]) {
  const map = new Map<string, Date>();
  for (const row of issueRows) {
    if (!row.startedAt) continue;
    map.set(row.id, row.startedAt);
  }
  return map;
}

function computeWindowMetrics(events: ReliabilityIssueEventV1[], issueStartById: Map<string, Date>): ReliabilityWindowMetrics {
  const checkoutSucceeded = events.filter((event) => event.event_name === "issue.checkout.succeeded").length;
  const checkoutFailed = events.filter((event) => event.event_name === "issue.checkout.failed").length;
  const checkoutDenominator = checkoutSucceeded + checkoutFailed;
  const checkoutSuccessRate = checkoutDenominator > 0 ? checkoutSucceeded / checkoutDenominator : null;

  const transitionSucceeded = events.filter((event) => event.event_name === "issue.transition.succeeded").length;
  const transitionFailed = events.filter((event) => event.event_name === "issue.transition.failed").length;
  const transitionDenominator = transitionSucceeded + transitionFailed;
  const transitionErrorRate = transitionDenominator > 0 ? transitionFailed / transitionDenominator : null;

  const blockerLinkedAtByEdge = new Map<string, Date>();
  for (const event of events) {
    if (event.event_name !== "issue.blockers.updated") continue;
    const addedBlockers = readStringArray(event.payload.addedBlockedByIssueIds);
    for (const blockerIssueId of addedBlockers) {
      const key = `${event.issue_id}:${blockerIssueId}`;
      const existing = blockerLinkedAtByEdge.get(key);
      if (!existing || event.event_ts.getTime() < existing.getTime()) {
        blockerLinkedAtByEdge.set(key, event.event_ts);
      }
    }
  }

  const blockerLatencies: number[] = [];
  for (const event of events) {
    if (event.event_name !== "issue.wake.requested" || event.wake_reason !== "issue_blockers_resolved") continue;
    const blockerIssueIds = readStringArray(event.payload.blockerIssueIds);
    for (const blockerIssueId of blockerIssueIds) {
      const key = `${event.issue_id}:${blockerIssueId}`;
      const linkedAt = blockerLinkedAtByEdge.get(key);
      if (!linkedAt) continue;
      const deltaMs = event.event_ts.getTime() - linkedAt.getTime();
      if (deltaMs >= 0) {
        blockerLatencies.push(deltaMs / HOURS_IN_MS);
      }
    }
  }

  const checkoutStartedAtByIssue = new Map<string, Date>();
  for (const event of events) {
    if (event.event_name !== "issue.checkout.succeeded") continue;
    const existing = checkoutStartedAtByIssue.get(event.issue_id);
    if (!existing || event.event_ts.getTime() < existing.getTime()) {
      checkoutStartedAtByIssue.set(event.issue_id, event.event_ts);
    }
  }

  const cycleTimes: number[] = [];
  for (const event of events) {
    if (event.event_name !== "issue.completion.outcome" || event.outcome !== "done") continue;
    const startAt = checkoutStartedAtByIssue.get(event.issue_id) ?? issueStartById.get(event.issue_id);
    if (!startAt) continue;
    const deltaMs = event.event_ts.getTime() - startAt.getTime();
    if (deltaMs >= 0) {
      cycleTimes.push(deltaMs / HOURS_IN_MS);
    }
  }

  const checkoutFailureCoverage = coverageForEvents(
    events.filter((event) => event.event_name === "issue.checkout.failed"),
    ["issue_id", "status_from", "status_to", "outcome"],
  );
  const transitionFailureCoverage = coverageForEvents(
    events.filter((event) => event.event_name === "issue.transition.failed"),
    ["issue_id", "status_from", "status_to", "outcome"],
  );

  return {
    checkoutSucceeded,
    checkoutFailed,
    checkoutSuccessRate,
    transitionSucceeded,
    transitionFailed,
    transitionErrorRate,
    blockerResolutionLatencyHours: average(blockerLatencies),
    blockerResolutionSamples: blockerLatencies.length,
    cycleTimeHours: average(cycleTimes),
    cycleTimeSamples: cycleTimes.length,
    checkoutFailureCoverage: checkoutFailureCoverage.value,
    checkoutFailureCoverageNumerator: checkoutFailureCoverage.numerator,
    checkoutFailureCoverageDenominator: checkoutFailureCoverage.denominator,
    transitionFailureCoverage: transitionFailureCoverage.value,
    transitionFailureCoverageNumerator: transitionFailureCoverage.numerator,
    transitionFailureCoverageDenominator: transitionFailureCoverage.denominator,
  };
}

export function reliabilityMetricsService(db: Db) {
  async function listReliabilityIssueEventsV1(input: {
    companyId: string;
    from: Date;
    to: Date;
    limit?: number | null;
    offset?: number;
  }) {
    const from = input.from;
    const to = input.to;

    const activityRows = await db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        entityId: activityLog.entityId,
        runId: activityLog.runId,
        createdAt: activityLog.createdAt,
        details: activityLog.details,
      })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.companyId, input.companyId),
          eq(activityLog.entityType, "issue"),
          inArray(activityLog.action, [...RELIABILITY_ACTIVITY_ACTIONS]),
          gte(activityLog.createdAt, from),
          lt(activityLog.createdAt, to),
        ),
      );

    const wakeTimePredicates: SQL[] = [
      and(gte(agentWakeupRequests.requestedAt, from), lt(agentWakeupRequests.requestedAt, to))!,
      and(isNotNull(agentWakeupRequests.claimedAt), gte(agentWakeupRequests.claimedAt, from), lt(agentWakeupRequests.claimedAt, to))!,
      and(isNotNull(agentWakeupRequests.finishedAt), gte(agentWakeupRequests.finishedAt, from), lt(agentWakeupRequests.finishedAt, to))!,
    ];

    const wakeRows = await db
      .select({
        id: agentWakeupRequests.id,
        reason: agentWakeupRequests.reason,
        payload: agentWakeupRequests.payload,
        runId: agentWakeupRequests.runId,
        requestedAt: agentWakeupRequests.requestedAt,
        claimedAt: agentWakeupRequests.claimedAt,
        finishedAt: agentWakeupRequests.finishedAt,
        status: agentWakeupRequests.status,
      })
      .from(agentWakeupRequests)
      .where(
        and(
          eq(agentWakeupRequests.companyId, input.companyId),
          inArray(agentWakeupRequests.reason, [...RELIABILITY_WAKE_REASONS]),
          or(...wakeTimePredicates),
        ),
      );

    const issueIdSet = new Set<string>();
    for (const row of activityRows) {
      const issueId = readString(row.entityId);
      if (issueId) issueIdSet.add(issueId);
    }
    for (const row of wakeRows) {
      const payload = readRecord(row.payload);
      const issueId = readString(payload.issueId);
      if (issueId) issueIdSet.add(issueId);
    }

    const issueIds = [...issueIdSet];
    const issueRows: IssueSummary[] = issueIds.length === 0
      ? []
      : await db
          .select({
            id: issues.id,
            identifier: issues.identifier,
            assigneeAgentId: issues.assigneeAgentId,
            assigneeUserId: issues.assigneeUserId,
            startedAt: issues.startedAt,
          })
          .from(issues)
          .where(and(eq(issues.companyId, input.companyId), inArray(issues.id, issueIds)));

    const issueById = new Map(issueRows.map((row) => [row.id, row]));

    const unresolvedByIssueId = new Map<string, string[]>();
    if (issueIds.length > 0) {
      const blockerIssues = alias(issues, "blocker_issue");
      const unresolvedRows = await db
        .select({
          issueId: issueRelations.relatedIssueId,
          blockerIssueId: issueRelations.issueId,
        })
        .from(issueRelations)
        .innerJoin(blockerIssues, eq(issueRelations.issueId, blockerIssues.id))
        .where(
          and(
            eq(issueRelations.companyId, input.companyId),
            inArray(issueRelations.relatedIssueId, issueIds),
            ne(blockerIssues.status, "done"),
          ),
        );

      for (const row of unresolvedRows) {
        const existing = unresolvedByIssueId.get(row.issueId) ?? [];
        existing.push(row.blockerIssueId);
        unresolvedByIssueId.set(row.issueId, existing);
      }
    }

    const events: ReliabilityIssueEventV1[] = [];

    const pushEvent = (event: Omit<ReliabilityIssueEventV1, "event_version">) => {
      events.push({
        ...event,
        event_version: 1,
      });
    };

    const issueIdentifierFor = (issueId: string, payload: Record<string, unknown>) => {
      return issueById.get(issueId)?.identifier ?? readString(payload.identifier) ?? issueId;
    };

    const issueAssigneeFor = (issueId: string) => {
      const issue = issueById.get(issueId);
      return {
        assigneeAgentId: issue?.assigneeAgentId ?? null,
        assigneeUserId: issue?.assigneeUserId ?? null,
      };
    };

    for (const row of activityRows) {
      const issueId = readString(row.entityId);
      if (!issueId) continue;
      const payload = readRecord(row.details);
      const { assigneeAgentId, assigneeUserId } = issueAssigneeFor(issueId);
      const wakeReason = readString(payload.wakeReason);
      const status = readStatusTransition(payload);
      const blockerState = normalizeBlockerState({
        payload,
        fallbackIssueId: issueId,
        unresolvedByIssueId,
      });

      const base = {
        event_ts: row.createdAt,
        source_table: "activity_log" as const,
        source_id: row.id,
        company_id: input.companyId,
        issue_id: issueId,
        issue_identifier: issueIdentifierFor(issueId, payload),
        run_id: row.runId,
        assignee_agent_id: assigneeAgentId,
        assignee_user_id: assigneeUserId,
        wake_reason: wakeReason,
        blocker_state_unresolved_count: blockerState.count,
        blocker_state_issue_ids: blockerState.ids,
        payload,
      };

      if (row.action === "issue.checked_out") {
        pushEvent({
          ...base,
          event_id: `activity_log:${row.id}:issue.checkout.succeeded`,
          event_name: "issue.checkout.succeeded",
          status_from: status.statusFrom,
          status_to: status.statusTo,
          outcome: null,
        });
        continue;
      }

      if (row.action === "issue.checkout_rejected") {
        pushEvent({
          ...base,
          event_id: `activity_log:${row.id}:issue.checkout.failed`,
          event_name: "issue.checkout.failed",
          status_from: readString(payload.current_status) ?? readString(payload.currentStatus) ?? status.statusFrom,
          status_to: readString(payload.attempted_status) ?? readString(payload.attemptedStatus) ?? status.statusTo,
          outcome: readString(payload.reason_code),
        });
        continue;
      }

      if (row.action === "issue.update_rejected") {
        const statusFrom = readString(payload.current_status) ?? readString(payload.currentStatus);
        const statusTo = readString(payload.attempted_status) ?? readString(payload.attemptedStatus);
        if (!statusFrom && !statusTo) continue;
        pushEvent({
          ...base,
          event_id: `activity_log:${row.id}:issue.transition.failed`,
          event_name: "issue.transition.failed",
          status_from: statusFrom,
          status_to: statusTo,
          outcome: readString(payload.reason_code),
        });
        continue;
      }

      if (row.action === "issue.blockers_updated") {
        pushEvent({
          ...base,
          event_id: `activity_log:${row.id}:issue.blockers.updated`,
          event_name: "issue.blockers.updated",
          status_from: null,
          status_to: null,
          outcome: null,
        });
        continue;
      }

      if (row.action === "issue.updated") {
        const transitioned = Boolean(status.statusFrom && status.statusTo && status.statusFrom !== status.statusTo);
        if (transitioned) {
          pushEvent({
            ...base,
            event_id: `activity_log:${row.id}:issue.transition.succeeded`,
            event_name: "issue.transition.succeeded",
            status_from: status.statusFrom,
            status_to: status.statusTo,
            outcome: null,
          });
        }

        if (transitioned && (status.statusTo === "done" || status.statusTo === "cancelled")) {
          pushEvent({
            ...base,
            event_id: `activity_log:${row.id}:issue.completion.outcome`,
            event_name: "issue.completion.outcome",
            status_from: status.statusFrom,
            status_to: status.statusTo,
            outcome: status.statusTo,
          });
        }
      }
    }

    for (const row of wakeRows) {
      const payload = readRecord(row.payload);
      const issueId = readString(payload.issueId);
      if (!issueId) continue;
      const reason = readString(row.reason);
      const { assigneeAgentId, assigneeUserId } = issueAssigneeFor(issueId);
      const blockerState = normalizeBlockerState({
        reason,
        payload,
        fallbackIssueId: issueId,
        unresolvedByIssueId,
      });

      const base = {
        source_table: "agent_wakeup_requests" as const,
        source_id: row.id,
        company_id: input.companyId,
        issue_id: issueId,
        issue_identifier: issueIdentifierFor(issueId, payload),
        run_id: row.runId,
        assignee_agent_id: assigneeAgentId,
        assignee_user_id: assigneeUserId,
        wake_reason: reason,
        blocker_state_unresolved_count: blockerState.count,
        blocker_state_issue_ids: blockerState.ids,
        status_from: null,
        status_to: null,
        payload,
      };

      if (inWindow(toDate(row.requestedAt), from, to)) {
        pushEvent({
          ...base,
          event_id: `agent_wakeup_requests:${row.id}:issue.wake.requested`,
          event_name: "issue.wake.requested",
          event_ts: row.requestedAt,
          outcome: null,
        });
      }

      if (inWindow(toDate(row.claimedAt), from, to)) {
        pushEvent({
          ...base,
          event_id: `agent_wakeup_requests:${row.id}:issue.wake.claimed`,
          event_name: "issue.wake.claimed",
          event_ts: row.claimedAt!,
          outcome: null,
        });
      }

      if (inWindow(toDate(row.finishedAt), from, to)) {
        pushEvent({
          ...base,
          event_id: `agent_wakeup_requests:${row.id}:issue.wake.finished`,
          event_name: "issue.wake.finished",
          event_ts: row.finishedAt!,
          outcome: readString(row.status),
        });
      }
    }

    events.sort((a, b) => a.event_ts.getTime() - b.event_ts.getTime());

    const total = events.length;
    const offset = Math.max(0, Math.floor(input.offset ?? 0));
    const limit = input.limit === null ? total : Math.max(1, Math.min(Math.floor(input.limit ?? 200), 1000));
    const paged = events.slice(offset, offset + limit);

    return {
      total,
      offset,
      limit,
      from,
      to,
      rows: paged,
      issueSummaries: issueRows,
    };
  }

  async function getWeeklyReliabilityReport(input: {
    companyId: string;
    from?: Date | null;
    to?: Date | null;
    now?: Date;
  }) {
    const { from, to, previousFrom, previousTo } = parseWindowBounds(input);

    const [currentEventsResult, previousEventsResult] = await Promise.all([
      listReliabilityIssueEventsV1({
        companyId: input.companyId,
        from,
        to,
        limit: null,
        offset: 0,
      }),
      listReliabilityIssueEventsV1({
        companyId: input.companyId,
        from: previousFrom,
        to: previousTo,
        limit: null,
        offset: 0,
      }),
    ]);

    const issueStartByIdCurrent = startMapFromIssues(currentEventsResult.issueSummaries);
    const issueStartByIdPrevious = startMapFromIssues(previousEventsResult.issueSummaries);

    const current = computeWindowMetrics(currentEventsResult.rows, issueStartByIdCurrent);
    const previous = computeWindowMetrics(previousEventsResult.rows, issueStartByIdPrevious);

    return {
      window: {
        from: from.toISOString(),
        to: to.toISOString(),
        previousFrom: previousFrom.toISOString(),
        previousTo: previousTo.toISOString(),
      },
      kpis: {
        checkout_success_rate: {
          value: current.checkoutSuccessRate,
          trendDirection: trendDirection(current.checkoutSuccessRate, previous.checkoutSuccessRate),
          numerator: current.checkoutSucceeded,
          denominator: current.checkoutSucceeded + current.checkoutFailed,
          sources: ["activity_log:issue.checked_out", "activity_log:issue.checkout_rejected"],
        },
        state_transition_error_rate: {
          value: current.transitionErrorRate,
          trendDirection: trendDirection(current.transitionErrorRate, previous.transitionErrorRate),
          numerator: current.transitionFailed,
          denominator: current.transitionSucceeded + current.transitionFailed,
          sources: ["activity_log:issue.updated", "activity_log:issue.update_rejected"],
        },
        blocker_resolution_latency_hours: {
          value: current.blockerResolutionLatencyHours,
          trendDirection: trendDirection(current.blockerResolutionLatencyHours, previous.blockerResolutionLatencyHours),
          sampleCount: current.blockerResolutionSamples,
          sources: ["activity_log:issue.blockers_updated", "agent_wakeup_requests:issue_blockers_resolved"],
        },
        cycle_time_hours: {
          value: current.cycleTimeHours,
          trendDirection: trendDirection(current.cycleTimeHours, previous.cycleTimeHours),
          sampleCount: current.cycleTimeSamples,
          sources: ["activity_log:issue.checked_out", "activity_log:issue.updated(status=done)", "issues.started_at"],
        },
      },
      metric_quality: {
        checkout_failure_coverage: {
          value: current.checkoutFailureCoverage,
          numerator: current.checkoutFailureCoverageNumerator,
          denominator: current.checkoutFailureCoverageDenominator,
        },
        transition_failure_coverage: {
          value: current.transitionFailureCoverage,
          numerator: current.transitionFailureCoverageNumerator,
          denominator: current.transitionFailureCoverageDenominator,
        },
      },
      instrumentation_coverage: {
        reliability_issue_events_v1: {
          eventEnvelopeVersion: 1,
          requiredDimensions: [
            "issue_id",
            "run_id",
            "assignee_agent_id",
            "assignee_user_id",
            "wake_reason",
            "blocker_state_unresolved_count",
            "blocker_state_issue_ids",
          ],
          sourceTables: ["activity_log", "agent_wakeup_requests"],
        },
      },
    };
  }

  return {
    listReliabilityIssueEventsV1,
    getWeeklyReliabilityReport,
  };
}
