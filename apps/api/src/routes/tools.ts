import { Router } from "express";
import { prisma } from "../db.js";
import { requireStaff } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const toolsRouter = Router();

toolsRouter.get(
  "/tools",
  requireStaff,
  asyncHandler(async (_req, res) => {
    const tools = await prisma.toolRegistryEntry.findMany({ orderBy: [{ integration: "asc" }, { tier: "asc" }, { name: "asc" }] });
    res.json({ tools });
  })
);
