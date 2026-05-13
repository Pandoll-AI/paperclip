import { Router } from "express";
import type { Db } from "@paperclipai/db";
import type { KawaiiAssetOwnerType, KawaiiAssetPurpose } from "@paperclipai/shared";
import { agentService } from "../services/agents.js";
import type { KawaiiVisualAssetService } from "../services/kawaii-visual-assets.js";
import { assertCompanyAccess } from "./authz.js";

const ownerTypes = new Set<KawaiiAssetOwnerType>(["company", "agent", "scene", "user"]);
const purposes = new Set<KawaiiAssetPurpose>(["ceo_setup", "scene_background", "staff_character", "user_outline"]);

function parseOwnerType(value: unknown): KawaiiAssetOwnerType | undefined {
  return typeof value === "string" && ownerTypes.has(value as KawaiiAssetOwnerType)
    ? value as KawaiiAssetOwnerType
    : undefined;
}

function parsePurpose(value: unknown): KawaiiAssetPurpose | undefined {
  return typeof value === "string" && purposes.has(value as KawaiiAssetPurpose)
    ? value as KawaiiAssetPurpose
    : undefined;
}

export function kawaiiAssetRoutes(
  db: Db,
  options: { service: KawaiiVisualAssetService },
) {
  const router = Router();
  const agents = agentService(db);

  router.get("/companies/:companyId/kawaii/assets", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const ownerType = parseOwnerType(req.query.ownerType);
    const purpose = parsePurpose(req.query.purpose);
    const ownerId = typeof req.query.ownerId === "string" && req.query.ownerId.trim()
      ? req.query.ownerId.trim()
      : undefined;

    const rows = await options.service.list(companyId, { ownerType, ownerId, purpose });
    res.json(rows);
  });

  router.post("/companies/:companyId/kawaii/setup", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const setup = await options.service.enqueueCeoSetup(companyId);
    const scenes = await Promise.all(
      [
        "office",
        "staff_room",
        "approval_budget_room",
        "issue_quest_room",
        "goal_strategy_room",
        "inbox_message_room",
        "settings_atelier",
        "project_studio",
        "runtime_room",
        "company_hall",
        "tool_atelier",
        "onboarding_throne_room",
      ]
        .map((sceneId) => options.service.enqueueSceneBackground(companyId, sceneId)),
    );
    res.status(202).json({ setup, scenes });
  });

  router.post("/companies/:companyId/kawaii/scenes/:sceneId/regenerate", async (req, res) => {
    const companyId = req.params.companyId as string;
    const sceneId = req.params.sceneId as string;
    assertCompanyAccess(req, companyId);
    const row = await options.service.enqueueSceneBackground(companyId, sceneId);
    res.status(202).json(row);
  });

  router.post("/companies/:companyId/kawaii/assets/regenerate", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const ownerType = parseOwnerType(req.body?.ownerType);
    const purpose = parsePurpose(req.body?.purpose);
    const ownerId = typeof req.body?.ownerId === "string" ? req.body.ownerId.trim() : "";
    if (!ownerType || !purpose || !ownerId) {
      res.status(400).json({ error: "ownerType, ownerId, and purpose are required" });
      return;
    }

    if (ownerType === "company" || ownerType === "scene" || ownerType === "user") {
      const row = await options.service.regenerate(companyId, { ownerType, ownerId, purpose });
      res.status(202).json(row);
      return;
    }

    const agent = await agents.getById(ownerId);
    if (!agent || agent.companyId !== companyId) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    const row = await options.service.regenerate(companyId, { ownerType, ownerId, purpose, agent });
    res.status(202).json(row);
  });

  router.post("/agents/:agentId/kawaii-assets/regenerate", async (req, res) => {
    const agentId = req.params.agentId as string;
    const agent = await agents.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const row = await options.service.enqueueStaffSet(agent);
    res.status(202).json(row);
  });

  return router;
}
