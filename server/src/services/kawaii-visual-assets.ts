import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { KawaiiAssetEntry, KawaiiAssetOwnerType, KawaiiAssetPurpose, KawaiiAssetSetManifest } from "@paperclipai/shared";
import type { Db } from "@paperclipai/db";
import { agents, kawaiiAssetSets } from "@paperclipai/db";
import type { StorageService } from "../storage/types.js";
import { assetService } from "./assets.js";
import { logActivity } from "./activity-log.js";
import { runCodexImageBatch, safeCodexDiagnostics } from "./kawaii/codex-image-connector.js";
import { buildKawaiiPromptPlan } from "./kawaii/prompt-builder.js";
import { KAWAII_PERSONA_VERSION, KAWAII_STYLE_VERSION } from "./kawaii/character-bible.js";

const DEFAULT_TIMEOUT_MS = 1000 * 60 * 8;

type AssetSetRow = typeof kawaiiAssetSets.$inferSelect;
export type KawaiiStaffAgent = {
  id: string;
  companyId: string;
  name: string;
  role: string;
  title?: string | null;
};
type Job = {
  setId: string;
  companyId: string;
  ownerType: KawaiiAssetOwnerType;
  ownerId: string;
  purpose: KawaiiAssetPurpose;
  agent?: KawaiiStaffAgent;
};

type ListOptions = {
  ownerType?: KawaiiAssetOwnerType;
  ownerId?: string;
  purpose?: KawaiiAssetPurpose;
};

type RegenerateInput = {
  ownerType: KawaiiAssetOwnerType;
  ownerId: string;
  purpose: KawaiiAssetPurpose;
  agent?: KawaiiStaffAgent;
};
type PendingInput = RegenerateInput & { companyId: string };

function emptyManifest(): KawaiiAssetSetManifest {
  return {
    styleVersion: KAWAII_STYLE_VERSION,
    personaVersion: KAWAII_PERSONA_VERSION,
    generator: "imagegen-codex",
    assets: [],
  };
}

function contentPath(assetId: string) {
  return `/api/assets/${assetId}/content`;
}

function readTimeoutMs() {
  const parsed = Number(process.env.KAWAII_IMAGEGEN_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.trunc(parsed);
}

function codexRequest(
  job: Job,
  plan: ReturnType<typeof buildKawaiiPromptPlan>,
) {
  return {
    prompt: plan.batchPrompt,
    raw_input: plan.batchPrompt,
    negative: plan.negativePrompt,
    asset_type: "paperclip-kawaii-ui-assets",
    style: ["kawaii visual novel", "warm office", "paperclip control plane"],
    continuity: {
      enabled: job.purpose === "staff_character",
      anchor_strategy: job.purpose === "staff_character" ? "same_character_all_images" : "shared_style",
    },
    meta: {
      app: "paperclip",
      styleVersion: plan.styleVersion,
      personaVersion: plan.personaVersion,
      ownerType: job.ownerType,
      ownerId: job.ownerId,
      purpose: job.purpose,
    },
    referenceManifest: plan.referenceManifest,
    items: plan.assets.map((item) => ({
      id: item.key,
      size: item.size ?? "1024x1024",
      prompt: item.prompt,
      negative: item.negativePrompt,
      referenceImages: item.referenceImages ?? [],
      notes: [
        item.characterId ? `character_id=${item.characterId}` : null,
        item.expression ? `expression=${item.expression}` : null,
        item.scene ? `scene=${item.scene}` : null,
        item.mood ? `mood=${item.mood}` : null,
      ].filter(Boolean).join("; "),
    })),
  };
}

export function kawaiiVisualAssetService(db: Db, storage: StorageService) {
  const assets = assetService(db);
  const queue: Job[] = [];
  let running = false;

  async function upsertPending(input: PendingInput) {
    const now = new Date();
    return db
      .insert(kawaiiAssetSets)
      .values({
        companyId: input.companyId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        purpose: input.purpose,
        status: "pending",
        manifest: emptyManifest(),
        error: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          kawaiiAssetSets.companyId,
          kawaiiAssetSets.ownerType,
          kawaiiAssetSets.ownerId,
          kawaiiAssetSets.purpose,
        ],
        set: {
          status: "pending",
          manifest: emptyManifest(),
          error: null,
          startedAt: null,
          completedAt: null,
          updatedAt: now,
        },
      })
      .returning()
      .then((rows) => rows[0]);
  }

  async function updateSet(id: string, values: Partial<typeof kawaiiAssetSets.$inferInsert>) {
    await db
      .update(kawaiiAssetSets)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(kawaiiAssetSets.id, id));
  }

  async function runJob(job: Job) {
    const startedAt = new Date();
    await updateSet(job.setId, { status: "generating", error: null, startedAt, completedAt: null });

    let plan: ReturnType<typeof buildKawaiiPromptPlan>;
    try {
      plan = buildKawaiiPromptPlan({
        purpose: job.purpose,
        companyId: job.companyId,
        ownerId: job.ownerId,
        agent: job.agent,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await updateSet(job.setId, {
        status: "failed",
        error,
        completedAt: new Date(),
        manifest: {
          ...emptyManifest(),
          diagnostics: { error },
        },
      });
      return;
    }
    const plannedItems = plan.assets;
    const jobDir = path.resolve(process.cwd(), ".paperclip", "generated-assets", job.setId);
    await mkdir(jobDir, { recursive: true });
    const requestPath = path.join(jobDir, "request.json");
    await writeFile(requestPath, `${JSON.stringify(codexRequest(job, plan), null, 2)}\n`, "utf8");

    let stdout = "";
    let stderr = "";
    try {
      const quality = process.env.KAWAII_IMAGE_QUALITY?.trim() || "low";
      const result = await runCodexImageBatch({
        requestPath,
        outDir: jobDir,
        quality,
        timeoutMs: readTimeoutMs(),
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      stdout = typeof (err as { stdout?: unknown }).stdout === "string" ? (err as { stdout: string }).stdout : stdout;
      stderr = typeof (err as { stderr?: unknown }).stderr === "string" ? (err as { stderr: string }).stderr : stderr;
      await updateSet(job.setId, {
        status: "failed",
        error,
        completedAt: new Date(),
        manifest: {
          ...emptyManifest(),
          personaVersion: plan.personaVersion,
          promptPack: {
            itemCount: plannedItems.length,
            requestPath,
            jobDir,
          },
          referenceManifest: plan.referenceManifest,
          assets: plannedItems.map((item) => ({ ...item, status: "failed" })),
          diagnostics: safeCodexDiagnostics(stdout, stderr),
        },
      });
      await logActivity(db, {
        companyId: job.companyId,
        actorType: "system",
        actorId: "kawaii-visual-assets",
        action: "kawaii_asset_set.failed",
        entityType: "kawaii_asset_set",
        entityId: job.setId,
        details: { ownerType: job.ownerType, ownerId: job.ownerId, purpose: job.purpose, error },
      });
      return;
    }

    const manifestAssets: KawaiiAssetEntry[] = [];
    for (const item of plannedItems) {
      const filePath = path.join(jobDir, `${item.key}.png`);
      try {
        const info = await stat(filePath);
        if (!info.isFile() || info.size <= 0) throw new Error("missing generated image");
        const body = await readFile(filePath);
        const stored = await storage.putFile({
          companyId: job.companyId,
          namespace: `kawaii/${job.ownerType}/${job.ownerId}/${job.purpose}`,
          originalFilename: `${item.key}.png`,
          contentType: "image/png",
          body,
        });
        const asset = await assets.create(job.companyId, {
          provider: stored.provider,
          objectKey: stored.objectKey,
          contentType: stored.contentType,
          byteSize: stored.byteSize,
          sha256: stored.sha256,
          originalFilename: stored.originalFilename,
          createdByAgentId: job.ownerType === "agent" ? job.ownerId : null,
          createdByUserId: null,
        });
        manifestAssets.push({
          ...item,
          assetId: asset.id,
          contentPath: contentPath(asset.id),
          status: "ready",
        });
      } catch {
        manifestAssets.push({ ...item, status: "missing" });
      }
    }

    const readyCount = manifestAssets.filter((item) => item.status === "ready").length;
    const status = readyCount > 0 ? "ready" : "failed";
    await updateSet(job.setId, {
      status,
      error: status === "ready" ? null : "imagegen-codex completed without usable images",
      completedAt: new Date(),
      manifest: {
        styleVersion: plan.styleVersion,
        generator: "imagegen-codex",
        personaVersion: plan.personaVersion,
        promptPack: {
          itemCount: plannedItems.length,
          requestPath,
          jobDir,
        },
        referenceManifest: plan.referenceManifest,
        assets: manifestAssets,
        diagnostics: safeCodexDiagnostics(stdout, stderr),
      },
    });
    await logActivity(db, {
      companyId: job.companyId,
      actorType: "system",
      actorId: "kawaii-visual-assets",
      action: status === "ready" ? "kawaii_asset_set.ready" : "kawaii_asset_set.failed",
      entityType: "kawaii_asset_set",
      entityId: job.setId,
      details: { ownerType: job.ownerType, ownerId: job.ownerId, purpose: job.purpose, readyCount },
    });
  }

  async function drainQueue() {
    if (running) return;
    running = true;
    try {
      while (queue.length > 0) {
        const job = queue.shift();
        if (job) await runJob(job);
      }
    } finally {
      running = false;
    }
  }

  function enqueue(job: Job) {
    if (!queue.some((queued) => queued.setId === job.setId)) queue.push(job);
    setTimeout(() => void drainQueue(), 0);
  }

  return {
    async list(companyId: string, opts: ListOptions = {}) {
      const conditions = [eq(kawaiiAssetSets.companyId, companyId)];
      if (opts.ownerType) conditions.push(eq(kawaiiAssetSets.ownerType, opts.ownerType));
      if (opts.ownerId) conditions.push(eq(kawaiiAssetSets.ownerId, opts.ownerId));
      if (opts.purpose) conditions.push(eq(kawaiiAssetSets.purpose, opts.purpose));
      return db
        .select()
        .from(kawaiiAssetSets)
        .where(and(...conditions))
        .orderBy(desc(kawaiiAssetSets.updatedAt));
    },

    async getLatestForOwner(
      companyId: string,
      ownerType: KawaiiAssetOwnerType,
      ownerId: string,
      purpose: KawaiiAssetPurpose,
    ): Promise<AssetSetRow | null> {
      const rows = await this.list(companyId, { ownerType, ownerId, purpose });
      return rows[0] ?? null;
    },

    async regenerate(companyId: string, input: RegenerateInput) {
      const row = await upsertPending({ ...input, companyId, agent: input.agent ?? undefined });
      enqueue({
        setId: row.id,
        companyId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        purpose: input.purpose,
        agent: input.agent,
      });
      return row;
    },

    async enqueueStaffSet(agent: KawaiiStaffAgent) {
      return this.regenerate(agent.companyId, {
        ownerType: "agent",
        ownerId: agent.id,
        purpose: "staff_character",
        agent,
      });
    },

    async enqueueCeoSetup(companyId: string) {
      return this.regenerate(companyId, {
        ownerType: "company",
        ownerId: companyId,
        purpose: "ceo_setup",
      });
    },

    async enqueueSceneBackground(companyId: string, sceneId: string) {
      return this.regenerate(companyId, {
        ownerType: "scene",
        ownerId: sceneId,
        purpose: "scene_background",
      });
    },

    async recoverPendingJobs() {
      const rows = await db
        .select()
        .from(kawaiiAssetSets)
        .where(inArray(kawaiiAssetSets.status, ["pending", "generating"]));

      for (const row of rows) {
        let agent: KawaiiStaffAgent | undefined;
        if (row.ownerType === "agent") {
          const agentRow = await db
            .select()
            .from(agents)
            .where(eq(agents.id, row.ownerId))
            .then((matches) => matches[0] ?? null);
          if (!agentRow) {
            await updateSet(row.id, {
              status: "failed",
              error: "Cannot recover asset job because the owning agent no longer exists",
              completedAt: new Date(),
            });
            continue;
          }
          agent = {
            id: agentRow.id,
            companyId: agentRow.companyId,
            name: agentRow.name,
            role: agentRow.role,
            title: agentRow.title,
          };
        }
        enqueue({
          setId: row.id,
          companyId: row.companyId,
          ownerType: row.ownerType as KawaiiAssetOwnerType,
          ownerId: row.ownerId,
          purpose: row.purpose as KawaiiAssetPurpose,
          agent,
        });
      }
    },
  };
}

export type KawaiiVisualAssetService = ReturnType<typeof kawaiiVisualAssetService>;
