CREATE TABLE "kawaii_asset_sets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "owner_type" text NOT NULL,
  "owner_id" text NOT NULL,
  "purpose" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "manifest" jsonb DEFAULT '{"styleVersion":"paperclip-kawaii-v1","generator":"imagegen-codex","assets":[]}'::jsonb NOT NULL,
  "error" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "kawaii_asset_sets_company_id_companies_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX "kawaii_asset_sets_company_owner_purpose_uq"
  ON "kawaii_asset_sets" ("company_id", "owner_type", "owner_id", "purpose");

CREATE INDEX "kawaii_asset_sets_company_status_idx"
  ON "kawaii_asset_sets" ("company_id", "status");

CREATE INDEX "kawaii_asset_sets_owner_idx"
  ON "kawaii_asset_sets" ("owner_type", "owner_id");
