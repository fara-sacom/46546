import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";
import { prisma } from "../db.js";
import { toClaudeToolSpecs } from "./toolRegistry.js";
import { routeToolCall } from "./router.js";
import { FARA_BASE_PERSONA, buildResponseStyleDirective, CUSTOMER_POLICY_MISSING_NOTE } from "./systemPrompt.js";
import { getAssistant } from "./assistants.js";
import { getPlatformSettings } from "./settings.js";
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

  const conversation = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });
  const assistant = getAssistant(conversation.assistantType);
  const settings = await getPlatformSettings();

  const policyBlock = assistant.customerFacing
    ? [
        "# سياسات المتجر المسجَّلة (استخدميها كما هي، لا تخترعي غيرها)",
        `الشحن: ${settings.shippingPolicy?.trim() || CUSTOMER_POLICY_MISSING_NOTE}`,
        `الدفع: ${settings.paymentPolicy?.trim() || CUSTOMER_POLICY_MISSING_NOTE}`,
        `الاستبدال/الاسترجاع: ${settings.exchangePolicy?.trim() || CUSTOMER_POLICY_MISSING_NOTE}`,
      ].join("\n")
    : "";

  const systemPrompt = [
    FARA_BASE_PERSONA,
    buildResponseStyleDirective(settings.responseStyle, assistant.customerFacing),
    assistant.personaAddendum,
    policyBlock,
  ]
    .filter(Boolean)
    .join("\n\n");

  await prisma.message.create({ data: { conversationId, role: "USER", content: userText } });

  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  const messages: Anthropic.MessageParam[] = history
    .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
    .map((m) => ({ role: m.role === "USER" ? "user" : "assistant", content: m.content }));

  const toolContext: ToolContext = { ...ctx, conversationId, allowedTools: assistant.allowedTools };
  const toolCallsLog: AgentTurnResult["toolCalls"] = [];

  let rounds = 0;
  let finalText = "";

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;
    const response = await client.messages.create({
      model: env.agentModel,
      max_tokens: 2048,
      system: systemPrompt,
      tools: toClaudeToolSpecs(assistant.allowedTools) as Anthropic.Tool[],
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
