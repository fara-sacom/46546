import { prisma } from "../db.js";
import { getTool } from "../agent/toolRegistry.js";

export class ActionNotPendingError extends Error {
  constructor() {
    super("هذا الإجراء لم يعد بانتظار الموافقة (تمت مراجعته مسبقًا)");
    this.name = "ActionNotPendingError";
  }
}

async function writeAudit(params: {
  actionId: string;
  actorId?: string;
  actorLabel: string;
  requestText: string;
  toolsUsed: string[];
  tier: "READ" | "DRAFT" | "ACTION";
  result: "success" | "failed" | "pending" | "rejected";
  changes?: unknown;
  errorText?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actionId: params.actionId,
      actorId: params.actorId,
      actorLabel: params.actorLabel,
      requestText: params.requestText,
      toolsUsed: JSON.stringify(params.toolsUsed),
      tier: params.tier,
      result: params.result,
      changes: params.changes ? JSON.stringify(params.changes) : undefined,
      errorText: params.errorText,
    },
  });
}

export async function listPendingActions() {
  return prisma.agentAction.findMany({
    where: { status: "PENDING" },
    include: { tool: true, conversation: true, requestedBy: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function approveAction(actionId: string, staffUserId: string, note?: string) {
  const action = await prisma.agentAction.findUniqueOrThrow({ where: { id: actionId }, include: { tool: true } });
  if (action.status !== "PENDING") throw new ActionNotPendingError();

  const tool = getTool(action.tool.name);
  if (!tool) throw new Error(`أداة غير معروفة: ${action.tool.name}`);

  await prisma.agentAction.update({
    where: { id: actionId },
    data: { status: "APPROVED", decidedById: staffUserId, decidedAt: new Date(), decisionNote: note },
  });

  const input = JSON.parse(action.payloadInput);
  try {
    const result = await tool.handler(input, { conversationId: action.conversationId ?? undefined, staffUserId, actorLabel: "Staff (approved)" });
    const updated = await prisma.agentAction.update({
      where: { id: actionId },
      data: { status: "EXECUTED", executedAt: new Date(), result: JSON.stringify(result), payloadAfter: JSON.stringify(result) },
    });
    await writeAudit({
      actionId,
      actorId: staffUserId,
      actorLabel: "Staff",
      requestText: action.summary,
      toolsUsed: [action.tool.name],
      tier: "ACTION",
      result: "success",
      changes: result,
    });
    return updated;
  } catch (err: any) {
    const message = err?.message ?? String(err);
    const updated = await prisma.agentAction.update({
      where: { id: actionId },
      data: { status: "FAILED", executedAt: new Date(), error: message },
    });
    await writeAudit({
      actionId,
      actorId: staffUserId,
      actorLabel: "Staff",
      requestText: action.summary,
      toolsUsed: [action.tool.name],
      tier: "ACTION",
      result: "failed",
      errorText: message,
    });
    return updated;
  }
}

export async function rejectAction(actionId: string, staffUserId: string, note?: string) {
  const action = await prisma.agentAction.findUniqueOrThrow({ where: { id: actionId }, include: { tool: true } });
  if (action.status !== "PENDING") throw new ActionNotPendingError();

  const updated = await prisma.agentAction.update({
    where: { id: actionId },
    data: { status: "REJECTED", decidedById: staffUserId, decidedAt: new Date(), decisionNote: note },
  });

  await writeAudit({
    actionId,
    actorId: staffUserId,
    actorLabel: "Staff",
    requestText: action.summary,
    toolsUsed: [action.tool.name],
    tier: "ACTION",
    result: "rejected",
  });

  return updated;
}
