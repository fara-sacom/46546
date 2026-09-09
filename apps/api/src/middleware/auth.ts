import type { NextFunction, Request, Response } from "express";
import { createHash } from "node:crypto";
import { prisma } from "../db.js";
import { asyncHandler } from "./asyncHandler.js";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export interface AuthedRequest extends Request {
  staff?: { id: string; name: string; role: string };
}

/** Requires a valid staff API key in the `X-FARA-Staff-Key` header. */
export const requireStaff = asyncHandler<AuthedRequest>(async (req, res, next) => {
  const key = req.header("X-FARA-Staff-Key");
  if (!key) return res.status(401).json({ error: "مطلوب مفتاح موظف (X-FARA-Staff-Key). شغّلي npm run db:seed لإنشاء أول مفتاح." });

  const staff = await prisma.staffUser.findUnique({ where: { apiKeyHash: hashApiKey(key) } });
  if (!staff) return res.status(401).json({ error: "مفتاح الموظف غير صالح" });

  req.staff = { id: staff.id, name: staff.name, role: staff.role };
  next();
});

/** Requires the staff.role to be ADMIN - used for approving/rejecting ACTION items and credential management. */
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.staff?.role !== "ADMIN") return res.status(403).json({ error: "هذا الإجراء يتطلب صلاحية مدير (ADMIN)" });
  next();
}
