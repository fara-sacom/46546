import Anthropic from "@anthropic-ai/sdk";
import type { ToolDefinition } from "../../agent/types.js";
import { env } from "../../env.js";

export class ClaudeVisionNotConfiguredError extends Error {
  constructor() {
    super("تحليل الصور غير مُفعّل: يلزم ضبط ANTHROPIC_API_KEY في متغيرات البيئة (نفس مفتاح تشغيل الوكيل).");
    this.name = "ClaudeVisionNotConfiguredError";
  }
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!env.anthropicApiKey) throw new ClaudeVisionNotConfiguredError();
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

export const visionTools: ToolDefinition[] = [
  {
    name: "vision.analyzeImage",
    integration: "claude-vision",
    tier: "READ",
    description:
      "تحليل صورة منتج (رابط صورة من سلة مثلًا) بالذكاء الاصطناعي: وصف المنتج، التحقق من اللون/التفاصيل، تقييم جودة الصورة، أو الإجابة عن سؤال محدد حولها. يستخدم نفس اتصال Claude الحالي بدون مفتاح إضافي",
    inputSchema: {
      type: "object",
      properties: {
        imageUrl: { type: "string", description: "رابط صورة عام (https)" },
        question: { type: "string", description: "ما تريدين معرفته عن الصورة، مثال: صفي هذا الفستان أو تحققي من جودة الصورة" },
      },
      required: ["imageUrl", "question"],
    },
    handler: async (input) => {
      const anthropic = getClient();
      const res = await anthropic.messages.create({
        model: env.agentModel,
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "url", url: input.imageUrl } },
              { type: "text", text: input.question },
            ],
          },
        ],
      });
      const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
      return { analysis: text };
    },
  },
];
