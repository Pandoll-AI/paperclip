import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityLog,
  agents,
  companies,
  createDb,
  issues,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { reliabilityMetricsService } from "../services/reliability-metrics.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres reliability metrics tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function seedCompanyIssue(db: ReturnType<typeof createDb>) {
  const companyId = randomUUID();
  const agentId = randomUUID();
  const issueId = randomUUID();

  await db.insert(companies).values({
    id: companyId,
    name: "Paperclip",
    issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
    requireBoardApprovalForNewAgents: false,
  });
  await db.insert(agents).values({
    id: agentId,
    companyId,
    name: "CodexCoder",
    role: "engineer",
    status: "active",
    adapterType: "codex_local",
    adapterConfig: {},
    runtimeConfig: {},
    permissions: {},
  });
  await db.insert(issues).values({
    id: issueId,
    companyId,
    title: "Reliability issue",
    identifier: "PAP-777",
    status: "todo",
    priority: "medium",
    assigneeAgentId: agentId,
    startedAt: new Date("2026-05-01T00:00:00.000Z"),
  });

  return { companyId, agentId, issueId };
}

describeEmbeddedPostgres("reliabilityMetricsService", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-reliability-metrics-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(activityLog);
    await db.delete(issues);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("parses existing issue.updated status payload shapes", async () => {
    const { companyId, issueId } = await seedCompanyIssue(db);
    const createdAt = new Date("2026-05-10T12:00:00.000Z");

    await db.insert(activityLog).values([
      {
        companyId,
        actorType: "plugin",
        actorId: "plugin",
        action: "issue.updated",
        entityType: "issue",
        entityId: issueId,
        details: {
          patch: { status: "in_progress" },
          _previous: { status: "todo" },
        },
        createdAt,
      },
      {
        companyId,
        actorType: "system",
        actorId: "system",
        action: "issue.updated",
        entityType: "issue",
        entityId: issueId,
        details: {
          status: "blocked",
          previousStatus: "in_progress",
        },
        createdAt: new Date(createdAt.getTime() + 1_000),
      },
      {
        companyId,
        actorType: "user",
        actorId: "board",
        action: "issue.updated",
        entityType: "issue",
        entityId: issueId,
        details: {
          status: "todo",
          reopenedFrom: "done",
        },
        createdAt: new Date(createdAt.getTime() + 2_000),
      },
    ]);

    const result = await reliabilityMetricsService(db).listReliabilityIssueEventsV1({
      companyId,
      from: new Date("2026-05-10T00:00:00.000Z"),
      to: new Date("2026-05-11T00:00:00.000Z"),
      limit: null,
    });

    const transitions = result.rows
      .filter((event) => event.event_name === "issue.transition.succeeded")
      .map((event) => [event.status_from, event.status_to]);

    expect(transitions).toEqual([
      ["todo", "in_progress"],
      ["in_progress", "blocked"],
      ["done", "todo"],
    ]);
  });

  it("does not report checkout failure coverage when only successes exist", async () => {
    const { companyId, issueId, agentId } = await seedCompanyIssue(db);

    await db.insert(activityLog).values({
      companyId,
      actorType: "agent",
      actorId: agentId,
      agentId,
      action: "issue.checked_out",
      entityType: "issue",
      entityId: issueId,
      details: { agentId },
      createdAt: new Date("2026-05-10T12:00:00.000Z"),
    });

    const report = await reliabilityMetricsService(db).getWeeklyReliabilityReport({
      companyId,
      from: new Date("2026-05-10T00:00:00.000Z"),
      to: new Date("2026-05-11T00:00:00.000Z"),
    });

    expect(report.metric_quality.checkout_failure_coverage.value).toBeNull();
    expect(report.metric_quality.checkout_failure_coverage.denominator).toBe(0);
  });

  it("computes weekly KPIs from more than 1,000 events", async () => {
    const { companyId, issueId, agentId } = await seedCompanyIssue(db);
    const createdAt = new Date("2026-05-10T12:00:00.000Z");

    await db.insert(activityLog).values({
      companyId,
      actorType: "agent",
      actorId: agentId,
      agentId,
      action: "issue.checked_out",
      entityType: "issue",
      entityId: issueId,
      details: { agentId },
      createdAt,
    });

    await db.insert(activityLog).values(
      Array.from({ length: 1_005 }, (_, index) => ({
        companyId,
        actorType: "agent" as const,
        actorId: agentId,
        agentId,
        action: "issue.checkout_rejected",
        entityType: "issue",
        entityId: issueId,
        details: {
          current_status: "todo",
          attempted_status: "in_progress",
          reason_code: "status_conflict",
        },
        createdAt: new Date(createdAt.getTime() + index + 1),
      })),
    );

    const report = await reliabilityMetricsService(db).getWeeklyReliabilityReport({
      companyId,
      from: new Date("2026-05-10T00:00:00.000Z"),
      to: new Date("2026-05-11T00:00:00.000Z"),
    });

    expect(report.kpis.checkout_success_rate.numerator).toBe(1);
    expect(report.kpis.checkout_success_rate.denominator).toBe(1_006);
    expect(report.metric_quality.checkout_failure_coverage.numerator).toBe(1_005);
    expect(report.metric_quality.checkout_failure_coverage.denominator).toBe(1_005);
  });
});
