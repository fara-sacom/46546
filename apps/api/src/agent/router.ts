import { prisma } from "../db.js";
import { getTool } from "./toolRegistry.js";
import type { ToolContext } from "./types.js";

export class UnknownToolError extends Error {
  constructor(name: string) {
    super(`أداة غير معروفة: ${name}`);
    this.name = "UnknownToolError";
  }
}

export interface RouterResult {
  status: "executed" | "pending_approval" | "failed";
  tier: "READ" | "DRAFT" | "ACTION";
  data?: unknown;
  actionId?: string;
  message: string;
}

async function writeAudit(params: {
  actionId?: string;
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

/**
 * The single gate every tool call goes through. This is the enforcement
 * point for the READ / DRAFT / ACTION permission model:
 *  - READ and DRAFT tools execute immediately (DRAFT tools only ever
 *    write local draft records - they never call an external system).
 *  - ACTION tools are NEVER invoked here. A pending AgentAction row is
 *    created instead and surfaced to the dashboard / chat for explicit
 *    human approval. Only approvals/service.ts#approveAction ever calls
 *    an ACTION tool's handler.
 */
export async function routeToolCall(toolName: string, input: unknown, ctx: ToolContext): Promise<RouterResult> {
  const tool = getTool(toolName);
  if (!tool) throw new UnknownToolError(toolName);

  if (tool.tier === "ACTION") {
    const registryEntry = await prisma.toolRegistryEntry.upsert({
      where: { name: tool.name },
      update: {},
      create: { name: tool.name, integration: tool.integration, tier: tool.tier, description: tool.description },
    });

    const summary = tool.summarize?.(input) ?? `تنفيذ ${tool.name}`;
    const action = await prisma.agentAction.create({
      data: {
        conversationId: ctx.conversationId,
        toolId: registryEntry.id,
        tier: "ACTION",
        requestedById: ctx.staffUserId,
        summary,
        payloadInput: JSON.stringify(input ?? {}),
        status: "PENDING",
      },
    });

    await writeAudit({
      actionId: action.id,
      actorId: ctx.staffUserId,
      actorLabel: ctx.actorLabel,
      requestText: summary,
      toolsUsed: [toolName],
      tier: "ACTION",
      result: "pending",
    });

    return {
      status: "pending_approval",
      tier: "ACTION",
      actionId: action.id,
      message: `هذا إجراء حساس ويحتاج موافقتك الصريحة قبل التنفيذ: ${summary}`,
    };
  }

  // READ / DRAFT execute immediately.
  try {
    const data = await tool.handler(input, ctx);
    await writeAudit({
      actorId: ctx.staffUserId,
      actorLabel: ctx.actorLabel,
      requestText: `${tool.name}(${JSON.stringify(input ?? {})})`,
      toolsUsed: [toolName],
      tier: tool.tier,
      result: "success",
    });
    return { status: "executed", tier: tool.tier, data, message: "تم" };
  } catch (err: any) {
    await writeAudit({
      actorId: ctx.staffUserId,
      actorLabel: ctx.actorLabel,
      requestText: `${tool.name}(${JSON.stringify(input ?? {})})`,
      toolsUsed: [toolName],
      tier: tool.tier,
      result: "failed",
      errorText: err?.message ?? String(err),
    });
    return { status: "failed", tier: tool.tier, message: err?.message ?? String(err) };
  }
}
