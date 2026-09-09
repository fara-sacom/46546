import type { ToolDefinition } from "../../agent/types.js";
import { sendWhatsAppText } from "./client.js";
import { prisma } from "../../db.js";

export const whatsappTools: ToolDefinition[] = [
  {
    name: "whatsapp.draftReply",
    integration: "whatsapp",
    tier: "DRAFT",
    description:
      "تجهيز مسودة رد على عميلة عبر واتساب (بالأسلوب السعودي الراقي بالعربية، أو الإنجليزية للعملاء الدوليين) دون إرسالها",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: { type: "string" },
        language: { type: "string", enum: ["ar", "en"] },
        text: { type: "string" },
      },
      required: ["language", "text"],
    },
    handler: async (input, ctx) => {
      const draft = await prisma.customerReplyDraft.create({
        data: {
          conversationId: input.conversationId ?? ctx.conversationId,
          channel: "WHATSAPP",
          language: input.language,
          draftText: input.text,
        },
      });
      return { draftId: draft.id, status: draft.status, text: draft.draftText };
    },
  },
  {
    name: "whatsapp.sendMessage",
    integration: "whatsapp",
    tier: "ACTION",
    description: "إرسال رسالة نصية فعلية للعميل عبر واتساب",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "رقم العميل بصيغة دولية" },
        text: { type: "string" },
        draftId: { type: "string", description: "معرّف مسودة سابقة، اختياري" },
      },
      required: ["to", "text"],
    },
    handler: async (input) => {
      const result = await sendWhatsAppText(input.to, input.text);
      if (input.draftId) {
        await prisma.customerReplyDraft.update({ where: { id: input.draftId }, data: { status: "sent" } }).catch(() => undefined);
      }
      return result;
    },
    summarize: (input) => `إرسال رسالة واتساب إلى ${input.to}: "${String(input.text).slice(0, 80)}"`,
  },
];
