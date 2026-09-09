import { Router } from "express";
import { prisma } from "../db.js";
import { requireStaff } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const assetsRouter = Router();

// Requires the same X-FARA-Staff-Key header as the rest of the API, so it
// cannot be used as a plain <img src>; fetch it with that header and render
// it from a blob URL instead.
assetsRouter.get(
  "/assets/:id",
  requireStaff,
  asyncHandler(async (req, res) => {
    const asset = await prisma.generatedAsset.findUnique({ where: { id: req.params.id } });
    if (!asset) return res.status(404).json({ error: "الملف غير موجود" });
    res.setHeader("Content-Type", asset.mimeType);
    res.send(Buffer.from(asset.dataBase64, "base64"));
  })
);
