import { Router } from "express";
import { prisma } from "../db.js";
import { requireStaff, type AuthedRequest } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const conversationsRouter = Router();

conversationsRouter.get(
  "/conversations",
  requireStaff,
  asyncHandler(async (_req, res) => {
    const conversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { _count: { select: { messages: true, actions: true } } },
    });
    res.json({ conversations });
  })
);

conversationsRouter.post(
  "/conversations",
  requireStaff,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { channel = "DASHBOARD", assistantType = "PERSONAL", language = "ar", customerRef } = req.body ?? {};
    const conversation = await prisma.conversation.create({
      data: { channel, assistantType, language, customerRef, staffUserId: req.staff!.id },
    });
    res.status(201).json({ conversation });
  })
);

conversationsRouter.get(
  "/conversations/:id/messages",
  requireStaff,
  asyncHandler(async (req, res) => {
    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: "asc" },
    });
    res.json({ messages });
  })
);
