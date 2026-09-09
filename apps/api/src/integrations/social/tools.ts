import type { ToolDefinition } from "../../agent/types.js";
import { prisma } from "../../db.js";
import { searchVideos, videoStats } from "./youtube.js";
import { createMetaCampaign, createTikTokCampaign, createSnapchatCampaign, isMetaConfigured, isTikTokConfigured, isSnapchatConfigured } from "./adPlatforms.js";
import { analytics } from "../salla/api.js";

export const socialTools: ToolDefinition[] = [
  // ---------------- READ ----------------
  {
    name: "social.youtube.searchTrending",
    integration: "youtube",
    tier: "READ",
    description: "البحث عن فيديوهات رائجة على يوتيوب متعلقة بكلمة مفتاحية (لتحليل اتجاهات المحتوى)",
    inputSchema: { type: "object", properties: { query: { type: "string" }, maxResults: { type: "number" } }, required: ["query"] },
    handler: (input) => searchVideos(input.query, input.maxResults),
  },
  {
    name: "social.youtube.videoStats",
    integration: "youtube",
    tier: "READ",
    description: "قراءة إحصائيات فيديوهات يوتيوب (مشاهدات/إعجابات/تعليقات) لتحليل الأداء",
    inputSchema: { type: "object", properties: { videoIds: { type: "array", items: { type: "string" } } }, required: ["videoIds"] },
    handler: (input) => videoStats(input.videoIds),
  },
  {
    name: "marketing.suggestAdCandidates",
    integration: "system",
    tier: "READ",
    description: "تحليل بيانات المبيعات الفعلية من سلة لاقتراح أفضل المنتجات المناسبة للإعلان عنها",
    inputSchema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } } },
    handler: async (input) => {
      const summary = await analytics.salesSummary(input);
      return {
        recommendedForAds: summary.topProductsByQuantity,
        rationale: "الأعلى مبيعًا خلال العيّنة المحلَّلة - مرشّحون طبيعيون لتضخيم الوصول إعلانيًا",
        note: summary.note,
      };
    },
  },

  // ---------------- DRAFT (no publish/spend) ----------------
  {
    name: "marketing.prepareCampaignBrief",
    integration: "system",
    tier: "DRAFT",
    description: "تجهيز فكرة ونص حملة إعلانية كاملة (عنوان، نص، ميزانية مقترحة) لمنتج معيّن دون نشرها أو تشغيلها",
    inputSchema: {
      type: "object",
      properties: {
        productRef: { type: "string" },
        channel: { type: "string", enum: ["INSTAGRAM", "TIKTOK", "SNAPCHAT", "YOUTUBE"] },
        title: { type: "string" },
        copyText: { type: "string" },
        budgetProposed: { type: "number" },
        currency: { type: "string" },
      },
      required: ["channel", "title", "copyText"],
    },
    handler: async (input) => {
      const draft = await prisma.campaignDraft.create({
        data: {
          productRef: input.productRef,
          channel: input.channel,
          title: input.title,
          copyText: input.copyText,
          budgetProposed: input.budgetProposed,
          currency: input.currency ?? "SAR",
        },
      });
      return { draftId: draft.id, status: draft.status, ...draft };
    },
  },

  // ---------------- ACTION (spends money / goes live - never auto-run) ----------------
  {
    name: "marketing.launchCampaign",
    integration: "system",
    tier: "ACTION",
    description: "تشغيل حملة إعلانية فعليًا على إنستغرام/ميتا أو تيك توك أو سناب شات",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", enum: ["INSTAGRAM", "META", "TIKTOK", "SNAPCHAT"] },
        campaignDraftId: { type: "string" },
        name: { type: "string" },
        objective: { type: "string" },
        dailyBudget: { type: "number" },
        status: { type: "string", enum: ["PAUSED", "ACTIVE"], description: "افتراضيًا PAUSED للأمان" },
      },
      required: ["channel", "name", "objective", "dailyBudget"],
    },
    handler: async (input) => {
      const payload = { name: input.name, objective: input.objective, dailyBudget: input.dailyBudget, status: input.status ?? "PAUSED" };
      let result;
      if (input.channel === "TIKTOK") result = await createTikTokCampaign(payload);
      else if (input.channel === "SNAPCHAT") result = await createSnapchatCampaign(payload);
      else result = await createMetaCampaign(payload); // INSTAGRAM and META both route through Meta Marketing API

      if (input.campaignDraftId) {
        await prisma.campaignDraft.update({ where: { id: input.campaignDraftId }, data: { status: "launched" } }).catch(() => undefined);
      }
      return result;
    },
    summarize: (input) => `تشغيل حملة "${input.name}" على ${input.channel} بميزانية يومية ${input.dailyBudget} (${input.status ?? "PAUSED"})`,
  },
];

export function socialConfigStatus() {
  return {
    youtube: !!process.env.YOUTUBE_API_KEY,
    meta: isMetaConfigured(),
    tiktok: isTikTokConfigured(),
    snapchat: isSnapchatConfigured(),
  };
}
