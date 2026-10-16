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
    const { channel = "DASHBOARD", language = "ar", customerRef } = req.body ?? {};
    const conversation = await prisma.conversation.create({
      data: { channel, language, customerRef, staffUserId: req.staff!.id },
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

// FARA-06: clears the escalated flag once a staff member has actually followed
// up - the agent never resolves its own escalation, only ever raises one.
conversationsRouter.post(
  "/conversations/:id/resolve-escalation",
  requireStaff,
  asyncHandler(async (req, res) => {
    const conversation = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { escalated: false, escalationReason: null },
    });
    res.json({ conversation });
  })
);
