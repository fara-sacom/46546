import type { ToolDefinition } from "../../agent/types.js";
import { instagram } from "./client.js";
import { prisma } from "../../db.js";

export const instagramTools: ToolDefinition[] = [
  {
    name: "instagram.listConversations",
    integration: "instagram",
    tier: "READ",
    description: "قراءة قائمة محادثات إنستغرام الأخيرة (Direct Messages)",
    inputSchema: { type: "object", properties: { limit: { type: "number" } } },
    handler: (input) => instagram.listConversations(input?.limit),
  },
  {
    name: "instagram.listMessages",
    integration: "instagram",
    tier: "READ",
    description: "قراءة رسائل محادثة إنستغرام محدّدة",
    inputSchema: { type: "object", properties: { conversationId: { type: "string" }, limit: { type: "number" } }, required: ["conversationId"] },
    handler: (input) => instagram.listMessages(input.conversationId, input.limit),
  },
  {
    name: "instagram.draftReply",
    integration: "instagram",
    tier: "DRAFT",
    description: "تجهيز مسودة رد على رسالة/تعليق إنستغرام دون إرسالها",
    inputSchema: {
      type: "object",
      properties: { conversationId: { type: "string" }, language: { type: "string" }, text: { type: "string" } },
      required: ["language", "text"],
    },
    handler: async (input, ctx) => {
      const draft = await prisma.customerReplyDraft.create({
        data: {
          conversationId: input.conversationId ?? ctx.conversationId,
          channel: "INSTAGRAM",
          language: input.language,
          draftText: input.text,
        },
      });
      return { draftId: draft.id, status: draft.status, text: draft.draftText };
    },
  },
  {
    name: "instagram.sendMessage",
    integration: "instagram",
    tier: "ACTION",
    description: "إرسال رسالة مباشرة فعلية لعميل على إنستغرام",
    inputSchema: {
      type: "object",
      properties: { recipientId: { type: "string" }, text: { type: "string" }, draftId: { type: "string" } },
      required: ["recipientId", "text"],
    },
    handler: async (input) => {
      const result = await instagram.sendMessage(input.recipientId, input.text);
      if (input.draftId) {
        await prisma.customerReplyDraft.update({ where: { id: input.draftId }, data: { status: "sent" } }).catch(() => undefined);
      }
      return result;
    },
    summarize: (input) => `إرسال رسالة إنستغرام إلى ${input.recipientId}: "${String(input.text).slice(0, 80)}"`,
  },
  {
    name: "instagram.replyToComment",
    integration: "instagram",
    tier: "ACTION",
    description: "نشر رد فعلي على تعليق إنستغرام",
    inputSchema: { type: "object", properties: { commentId: { type: "string" }, text: { type: "string" } }, required: ["commentId", "text"] },
    handler: (input) => instagram.replyToComment(input.commentId, input.text),
    summarize: (input) => `الرد على تعليق إنستغرام #${input.commentId}: "${String(input.text).slice(0, 80)}"`,
  },
];
