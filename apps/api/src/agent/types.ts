import type { PermissionTier } from "@prisma/client";

export interface ToolContext {
  conversationId?: string;
  staffUserId?: string;
  actorLabel: string;
  /** Tool names the current assistant may use ("all" = no restriction). Enforced by the router as defense in depth. */
  allowedTools?: string[] | "all";
}

export interface ToolDefinition {
  /** unique dotted name, e.g. "salla.products.list" */
  name: string;
  integration: string;
  tier: PermissionTier;
  description: string;
  /** JSON-schema for Claude tool-use `input_schema` */
  inputSchema: Record<string, unknown>;
  /**
   * Executes the tool. For READ/DRAFT tools this runs immediately.
   * For ACTION tools this runs ONLY after explicit human approval -
   * the router never calls an ACTION handler directly from agent output.
   */
  handler: (input: any, ctx: ToolContext) => Promise<unknown>;
  /** For ACTION tools: produce a short human-readable Arabic summary of what will change. */
  summarize?: (input: any) => string;
}
