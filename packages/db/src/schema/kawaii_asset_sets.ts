import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { KawaiiAssetSetManifest } from "@paperclipai/shared";
import { companies } from "./companies.js";

export const kawaiiAssetSets = pgTable(
  "kawaii_asset_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    ownerType: text("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    purpose: text("purpose").notNull(),
    status: text("status").notNull().default("pending"),
    manifest: jsonb("manifest").$type<KawaiiAssetSetManifest>().notNull().default({
      styleVersion: "paperclip-kawaii-v1",
      generator: "imagegen-codex",
      assets: [],
    }),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyOwnerPurposeUq: uniqueIndex("kawaii_asset_sets_company_owner_purpose_uq").on(
      table.companyId,
      table.ownerType,
      table.ownerId,
      table.purpose,
    ),
    companyStatusIdx: index("kawaii_asset_sets_company_status_idx").on(table.companyId, table.status),
    ownerIdx: index("kawaii_asset_sets_owner_idx").on(table.ownerType, table.ownerId),
  }),
);

