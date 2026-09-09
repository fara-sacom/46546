import { Router } from "express";
import { prisma } from "../db.js";
import { requireStaff, type AuthedRequest } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { runAgentTurn, AgentNotConfiguredError } from "../agent/core.js";

export const chatRouter = Router();

chatRouter.post(
  "/conversations/:id/chat",
  requireStaff,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { text } = req.body ?? {};
    if (!text || typeof text !== "string") return res.status(400).json({ error: "text مطلوب" });

    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    if (!conversation) return res.status(404).json({ error: "المحادثة غير موجودة" });

    try {
      const result = await runAgentTurn(conversation.id, text, { staffUserId: req.staff!.id, actorLabel: req.staff!.name });
      res.json(result);
    } catch (err: any) {
      if (err instanceof AgentNotConfiguredError) return res.status(503).json({ error: err.message });
      res.status(500).json({ error: err?.message ?? "فشل تنفيذ الطلب" });
    }
  })
);
