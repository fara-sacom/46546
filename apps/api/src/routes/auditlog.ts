import { Router } from "express";
import { prisma } from "../db.js";
import { requireStaff } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const auditLogRouter = Router();

auditLogRouter.get(
  "/audit-log",
  requireStaff,
  asyncHandler(async (req, res) => {
    const tier = req.query.tier as string | undefined;
    const result = req.query.result as string | undefined;
    const entries = await prisma.auditLog.findMany({
      where: {
        tier: tier as any,
        result: result as any,
      },
      include: { actor: true, action: { include: { tool: true } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    res.json({ entries });
  })
);
