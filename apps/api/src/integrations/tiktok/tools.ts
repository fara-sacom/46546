import type { ToolDefinition } from "../../agent/types.js";
import { replyToTikTokComment } from "./client.js";
import { prisma } from "../../db.js";

export const tiktokTools: ToolDefinition[] = [
  {
    name: "tiktok.draftCommentReply",
    integration: "tiktok",
    tier: "DRAFT",
    description: "تجهيز مسودة رد على تعليق تيك توك (أسلوب خفيف مناسب للمنصة) دون نشره",
    inputSchema: {
      type: "object",
      properties: { conversationId: { type: "string" }, language: { type: "string" }, text: { type: "string" } },
      required: ["language", "text"],
    },
    handler: async (input, ctx) => {
      const draft = await prisma.customerReplyDraft.create({
        data: {
          conversationId: input.conversationId ?? ctx.conversationId,
          channel: "TIKTOK",
          language: input.language,
          draftText: input.text,
        },
      });
      return { draftId: draft.id, status: draft.status, text: draft.draftText };
    },
  },
  {
    name: "tiktok.replyToComment",
    integration: "tiktok",
    tier: "ACTION",
    description: "نشر رد فعلي على تعليق تيك توك",
    inputSchema: { type: "object", properties: { commentId: { type: "string" }, text: { type: "string" } }, required: ["commentId", "text"] },
    handler: (input) => replyToTikTokComment(input.commentId, input.text),
    summarize: (input) => `الرد على تعليق تيك توك #${input.commentId}: "${String(input.text).slice(0, 80)}"`,
  },
];
