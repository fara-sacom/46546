import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";
import { prisma } from "../db.js";
import { toClaudeToolSpecs } from "./toolRegistry.js";
import { routeToolCall } from "./router.js";
import { FARA_SYSTEM_PROMPT } from "./systemPrompt.js";
import type { ToolContext } from "./types.js";

export class AgentNotConfiguredError extends Error {
  constructor() {
    super("الوكيل غير مُفعّل: يلزم ضبط ANTHROPIC_API_KEY في متغيرات البيئة قبل بدء أي محادثة.");
    this.name = "AgentNotConfiguredError";
  }
}

let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!env.anthropicApiKey) throw new AgentNotConfiguredError();
  if (!anthropic) anthropic = new Anthropic({ apiKey: env.anthropicApiKey });
  return anthropic;
}

const MAX_TOOL_ROUNDS = 8;

export interface AgentTurnResult {
  reply: string;
  toolCalls: Array<{ name: string; input: unknown; status: string; actionId?: string }>;
}

export async function runAgentTurn(conversationId: string, userText: string, ctx: Omit<ToolContext, "conversationId">): Promise<AgentTurnResult> {
  const client = getAnthropic();

  await prisma.message.create({ data: { conversationId, role: "USER", content: userText } });

  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  const messages: Anthropic.MessageParam[] = history
    .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
    .map((m) => ({ role: m.role === "USER" ? "user" : "assistant", content: m.content }));

  // Cross-conversation memory: if this customer talked to FARA before in a
  // now-closed conversation, her last known intent/product/order still
  // carries over instead of starting blank. Always for-reference only -
  // the agent must still verify via Salla tools before confirming anything.
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  let memoryNote = "";
  if (conversation?.customerRef) {
    const memory = await prisma.customerContext.findUnique({ where: { whatsappNumber: conversation.customerRef } });
    if (memory && (memory.currentIntent || memory.lastProduct || memory.lastOrder || memory.cartContext)) {
      memoryNote =
        "\n\n# سياق سابق لهذه العميلة (من محادثة سابقة - للاستئناس فقط، تحققي دائمًا من سلة قبل أي تأكيد)\n" +
        (memory.currentIntent ? `- آخر نية معروفة: ${memory.currentIntent}\n` : "") +
        (memory.lastProduct ? `- آخر منتج تم التطرق له: ${memory.lastProduct}\n` : "") +
        (memory.lastOrder ? `- آخر طلب تم التطرق له: ${memory.lastOrder}\n` : "") +
        (memory.cartContext ? `- سلة الاهتمام الحالية: ${memory.cartContext}\n` : "");
    }
  }

  const toolContext: ToolContext = { ...ctx, conversationId };
  const toolCallsLog: AgentTurnResult["toolCalls"] = [];

  let rounds = 0;
  let finalText = "";

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;
    const response = await client.messages.create({
      model: env.agentModel,
      max_tokens: 2048,
      system: FARA_SYSTEM_PROMPT + memoryNote,
      tools: toClaudeToolSpecs() as Anthropic.Tool[],
      messages,
    });

    const textParts = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text);
    finalText = textParts.join("\n").trim();

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const result = await routeToolCall(use.name, use.input, toolContext);
      toolCallsLog.push({ name: use.name, input: use.input, status: result.status, actionId: result.actionId });
      toolResults.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: JSON.stringify(result.status === "executed" ? result.data ?? result.message : result.message),
        is_error: result.status === "failed",
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  await prisma.message.create({
    data: {
      conversationId,
      role: "ASSISTANT",
      content: finalText || "تم تنفيذ طلبك.",
      toolCallsJson: JSON.stringify(toolCallsLog),
    },
  });

  return { reply: finalText, toolCalls: toolCallsLog };
}
