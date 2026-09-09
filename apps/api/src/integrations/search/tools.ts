import type { ToolDefinition } from "../../agent/types.js";
import { tavilySearch } from "./tavily.js";

export const searchTools: ToolDefinition[] = [
  {
    name: "search.web",
    integration: "tavily",
    tier: "READ",
    description:
      "البحث في الإنترنت وجمع معلومات حديثة (اتجاهات موضة، أسعار منافسين، أخبار، مراجعات) عبر Tavily - محرك بحث مخصص لوكلاء الذكاء الاصطناعي",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        maxResults: { type: "number", description: "افتراضيًا 5" },
      },
      required: ["query"],
    },
    handler: (input) => tavilySearch(input.query, input.maxResults),
  },
];
