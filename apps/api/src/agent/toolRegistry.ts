import type { ToolDefinition } from "./types.js";
import { sallaTools } from "../integrations/salla/tools.js";
import { whatsappTools } from "../integrations/whatsapp/tools.js";
import { socialTools } from "../integrations/social/tools.js";
import { visionTools } from "../integrations/vision/tools.js";
import { searchTools } from "../integrations/search/tools.js";
import { translationTools } from "../integrations/translation/tools.js";
import { imageTools } from "../integrations/image/tools.js";
import { instagramTools } from "../integrations/instagram/tools.js";
import { tiktokTools } from "../integrations/tiktok/tools.js";
import { prisma } from "../db.js";

/** Single source of truth for every tool FARA AI Agent may call. */
export const allTools: ToolDefinition[] = [
  ...sallaTools,
  ...whatsappTools,
  ...socialTools,
  ...visionTools,
  ...searchTools,
  ...translationTools,
  ...imageTools,
  ...instagramTools,
  ...tiktokTools,
];

const byName = new Map(allTools.map((t) => [t.name, t]));

export function getTool(name: string): ToolDefinition | undefined {
  return byName.get(name);
}

/** Keeps the DB's ToolRegistryEntry table (used by the dashboard) in sync with code. */
export async function syncToolRegistry() {
  for (const tool of allTools) {
    await prisma.toolRegistryEntry.upsert({
      where: { name: tool.name },
      update: { integration: tool.integration, tier: tool.tier, description: tool.description },
      create: { name: tool.name, integration: tool.integration, tier: tool.tier, description: tool.description },
    });
  }
  return allTools.length;
}

/** Anthropic tool-use format, optionally filtered to a specific assistant's allowed tool names ("all" = no filter). */
export function toClaudeToolSpecs(allowedNames: string[] | "all" = "all") {
  const tools = allowedNames === "all" ? allTools : allTools.filter((t) => allowedNames.includes(t.name));
  return tools.map((t) => ({
    name: t.name,
    description: `[${t.tier}] ${t.description}`,
    input_schema: t.inputSchema,
  }));
}
