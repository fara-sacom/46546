import { Router } from "express";
import { requireStaff } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { listAIServices } from "../agent/aiServices.js";

export const aiServicesRouter = Router();

aiServicesRouter.get(
  "/ai-services",
  requireStaff,
  asyncHandler(async (_req, res) => {
    res.json({ services: listAIServices() });
  })
);
