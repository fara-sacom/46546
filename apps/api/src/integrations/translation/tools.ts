import type { ToolDefinition } from "../../agent/types.js";
import { translateText } from "./mymemory.js";

export const translationTools: ToolDefinition[] = [
  {
    name: "translate.text",
    integration: "mymemory",
    tier: "READ",
    description: "ترجمة نص قصير (حتى 500 حرف) بين لغتين عبر MyMemory - خدمة ترجمة مجانية بدون مفتاح إجباري",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        sourceLang: { type: "string", description: "رمز اللغة المصدر، مثال ar أو en" },
        targetLang: { type: "string", description: "رمز اللغة الهدف" },
      },
      required: ["text", "sourceLang", "targetLang"],
    },
    handler: (input) => translateText(input.text, input.sourceLang, input.targetLang),
  },
];
