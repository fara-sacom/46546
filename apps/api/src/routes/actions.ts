import { Router } from "express";
import { prisma } from "../db.js";
import { requireStaff, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { approveAction, rejectAction, listPendingActions, ActionNotPendingError } from "../approvals/service.js";

export const actionsRouter = Router();

actionsRouter.get(
  "/actions/pending",
  requireStaff,
  asyncHandler(async (_req, res) => {
    const actions = await listPendingActions();
    res.json({ actions });
  })
);

actionsRouter.get(
  "/actions",
  requireStaff,
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const actions = await prisma.agentAction.findMany({
      where: status ? { status: status as any } : undefined,
      include: { tool: true, requestedBy: true, decidedBy: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ actions });
  })
);

actionsRouter.post(
  "/actions/:id/approve",
  requireStaff,
  requireAdmin,
  asyncHandler<AuthedRequest>(async (req, res) => {
    try {
      const action = await approveAction(req.params.id, req.staff!.id, req.body?.note);
      res.json({ action });
    } catch (err: any) {
      if (err instanceof ActionNotPendingError) return res.status(409).json({ error: err.message });
      res.status(500).json({ error: err?.message ?? "فشلت الموافقة" });
    }
  })
);

actionsRouter.post(
  "/actions/:id/reject",
  requireStaff,
  requireAdmin,
  asyncHandler<AuthedRequest>(async (req, res) => {
    try {
      const action = await rejectAction(req.params.id, req.staff!.id, req.body?.note);
      res.json({ action });
    } catch (err: any) {
      if (err instanceof ActionNotPendingError) return res.status(409).json({ error: err.message });
      res.status(500).json({ error: err?.message ?? "فشل الرفض" });
    }
  })
);
