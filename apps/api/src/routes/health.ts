import { Router } from "express";
import { env } from "../env.js";
import { isSallaConfigured } from "../integrations/salla/client.js";
import { isWhatsAppConfigured } from "../integrations/whatsapp/client.js";
import { socialConfigStatus } from "../integrations/social/tools.js";
import { isTavilyConfigured } from "../integrations/search/tavily.js";
import { isHuggingFaceConfigured } from "../integrations/image/huggingface.js";
import { isRemoveBgConfigured } from "../integrations/image/removebg.js";
import { isInstagramConfigured } from "../integrations/instagram/client.js";
import { isTikTokCommentsConfigured } from "../integrations/tiktok/client.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    agentConfigured: !!env.anthropicApiKey,
    integrations: {
      salla: isSallaConfigured(),
      whatsapp: isWhatsAppConfigured(),
      instagram: isInstagramConfigured(),
      tiktokComments: isTikTokCommentsConfigured(),
      ...socialConfigStatus(),
      tavily: isTavilyConfigured(),
      huggingface: isHuggingFaceConfigured(),
      removebg: isRemoveBgConfigured(),
    },
  });
});
