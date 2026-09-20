import { Router } from "express";
import { prisma } from "../db.js";
import { requireStaff } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const orderDraftsRouter = Router();

orderDraftsRouter.get(
  "/order-drafts",
  requireStaff,
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const drafts = await prisma.orderDraft.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ drafts });
  })
);

// Records the REAL Salla order id/number after a staff member has actually
// created that order themselves in Salla (there is no API to do this for
// them - see salla.orders.requestExecution). Only callable on a draft that
// already went through ADMIN-approved requestExecution ("readyForPlacement"),
// so this can never be used to fabricate a "placed" order out of thin air.
orderDraftsRouter.post(
  "/order-drafts/:id/record-salla-order",
  requireStaff,
  asyncHandler(async (req, res) => {
    const { sallaOrderId, sallaReferenceId } = req.body ?? {};
    if (!sallaOrderId) return res.status(400).json({ error: "sallaOrderId مطلوب - رقم الطلب الحقيقي من سلة بعد إنشائه يدويًا" });

    const draft = await prisma.orderDraft.findUnique({ where: { id: req.params.id } });
    if (!draft) return res.status(404).json({ error: "مسودة الطلب غير موجودة" });
    if (draft.status !== "readyForPlacement") {
      return res.status(409).json({ error: `لا يمكن تسجيل رقم طلب لمسودة بحالة "${draft.status}" - يجب أن تكون بحالة readyForPlacement` });
    }

    const updated = await prisma.orderDraft.update({
      where: { id: req.params.id },
      data: { status: "placed", sallaOrderId, sallaReferenceId, placedAt: new Date() },
    });
    res.json({ draft: updated });
  })
);
