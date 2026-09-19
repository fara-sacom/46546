import type { ToolDefinition } from "./types.js";
import { sallaTools } from "../integrations/salla/tools.js";
import { whatsappTools } from "../integrations/whatsapp/tools.js";
import { socialTools } from "../integrations/social/tools.js";
import { memoryTools } from "../integrations/memory/tools.js";
import { prisma } from "../db.js";

/** Single source of truth for every tool FARA AI Agent may call. */
export const allTools: ToolDefinition[] = [...sallaTools, ...whatsappTools, ...socialTools, ...memoryTools];

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

/** Anthropic tool-use format for every enabled tool. */
export function toClaudeToolSpecs() {
  return allTools.map((t) => ({
    name: t.name,
    description: `[${t.tier}] ${t.description}`,
    input_schema: t.inputSchema,
  }));
}
