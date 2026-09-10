import { Router } from "express";
import { prisma } from "../db.js";
import { requireStaff, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { getPlatformSettings } from "../agent/settings.js";

export const settingsRouter = Router();

settingsRouter.get(
  "/settings",
  requireStaff,
  asyncHandler(async (_req, res) => {
    const settings = await getPlatformSettings();
    res.json({ settings });
  })
);

settingsRouter.put(
  "/settings",
  requireStaff,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { responseStyle, shippingPolicy, paymentPolicy, exchangePolicy } = req.body ?? {};
    const settings = await prisma.platformSettings.upsert({
      where: { id: "default" },
      update: { responseStyle, shippingPolicy, paymentPolicy, exchangePolicy },
      create: { id: "default", responseStyle, shippingPolicy, paymentPolicy, exchangePolicy },
    });
    res.json({ settings });
  })
);
