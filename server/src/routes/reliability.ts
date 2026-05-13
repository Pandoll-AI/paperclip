import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { badRequest } from "../errors.js";
import { assertCompanyAccess } from "./authz.js";
import { reliabilityMetricsService } from "../services/index.js";

function parseDateInput(raw: unknown): Date | undefined {
  if (raw == null || raw === "") return undefined;
  const value = new Date(String(raw));
  if (isNaN(value.getTime())) {
    throw badRequest("invalid date");
  }
  return value;
}

export function reliabilityRoutes(db: Db) {
  const router = Router();
  const reliability = reliabilityMetricsService(db);

  router.get("/companies/:companyId/reliability-weekly-report", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const from = parseDateInput(req.query.from);
    const to = parseDateInput(req.query.to);
    const report = await reliability.getWeeklyReliabilityReport({
      companyId,
      from,
      to,
    });
    res.json(report);
  });

  return router;
}
