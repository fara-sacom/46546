import { Router } from "express";
import { requireStaff } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { ASSISTANTS } from "../agent/assistants.js";

export const assistantsRouter = Router();

assistantsRouter.get(
  "/assistants",
  requireStaff,
  asyncHandler(async (_req, res) => {
    const assistants = Object.values(ASSISTANTS).map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      customerFacing: a.customerFacing,
      toolCount: a.allowedTools === "all" ? "all" : a.allowedTools.length,
    }));
    res.json({ assistants });
  })
);
