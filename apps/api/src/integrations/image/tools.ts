import type { ToolDefinition } from "../../agent/types.js";
import { prisma } from "../../db.js";
import { generateImage } from "./huggingface.js";
import { removeBackground } from "./removebg.js";

export const imageTools: ToolDefinition[] = [
  {
    name: "image.generate",
    integration: "huggingface",
    tier: "DRAFT",
    description:
      "توليد صورة جديدة من وصف نصي (لفكرة إعلانية أو خلفية تسويقية) عبر Hugging Face - لا تُنشر أو تُستخدم فعليًا، فقط تُحفظ كمسودة للمراجعة",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "وصف الصورة المطلوبة، يُفضَّل بالإنجليزية لجودة أفضل" },
        conversationId: { type: "string" },
      },
      required: ["prompt"],
    },
    handler: async (input, ctx) => {
      const { base64, mimeType } = await generateImage(input.prompt);
      const asset = await prisma.generatedAsset.create({
        data: {
          conversationId: input.conversationId ?? ctx.conversationId,
          kind: "image_generated",
          provider: "huggingface",
          prompt: input.prompt,
          mimeType,
          dataBase64: base64,
        },
      });
      return { assetId: asset.id, mimeType, note: "صورة مسودة محفوظة للمراجعة - لم تُنشر أو تُستخدم في أي مكان بعد." };
    },
  },
  {
    name: "image.removeBackground",
    integration: "removebg",
    tier: "DRAFT",
    description:
      "إزالة خلفية صورة منتج موجودة (برابط) عبر remove.bg - جودة معاينة (منخفضة الدقة ضمن الخطة المجانية)، تُحفظ كمسودة للمراجعة قبل أي استخدام فعلي",
    inputSchema: {
      type: "object",
      properties: {
        imageUrl: { type: "string", description: "رابط الصورة الأصلية (https)" },
        conversationId: { type: "string" },
      },
      required: ["imageUrl"],
    },
    handler: async (input, ctx) => {
      const { base64, mimeType } = await removeBackground(input.imageUrl);
      const asset = await prisma.generatedAsset.create({
        data: {
          conversationId: input.conversationId ?? ctx.conversationId,
          kind: "image_background_removed",
          provider: "removebg",
          prompt: `source: ${input.imageUrl}`,
          mimeType,
          dataBase64: base64,
        },
      });
      return { assetId: asset.id, mimeType, note: "صورة معاينة (دقة منخفضة ضمن الخطة المجانية) - لم تُستخدم في أي مكان بعد." };
    },
  },
];
