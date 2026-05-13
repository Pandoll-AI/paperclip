UPDATE "agent_wakeup_requests"
SET
  "idempotency_key" = "idempotency_key" || ':duplicate:' || "id"::text,
  "updated_at" = now()
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      row_number() OVER (
        PARTITION BY "company_id", "agent_id", "idempotency_key"
        ORDER BY "requested_at" ASC, "id" ASC
      ) AS "duplicate_rank"
    FROM "agent_wakeup_requests"
    WHERE
      "idempotency_key" IS NOT NULL
      AND "status" IN ('queued', 'claimed', 'coalesced', 'deferred_issue_execution', 'completed')
  ) ranked_wakeups
  WHERE "duplicate_rank" > 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_wakeup_requests_active_idempotency_uq"
ON "agent_wakeup_requests" ("company_id", "agent_id", "idempotency_key")
WHERE "idempotency_key" IS NOT NULL
  AND "status" IN ('queued', 'claimed', 'coalesced', 'deferred_issue_execution', 'completed');
