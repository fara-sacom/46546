import axios from "axios";
import { env } from "../../env.js";

export class AdPlatformNotConfiguredError extends Error {
  constructor(platform: string, missing: string[]) {
    super(`تكامل ${platform} غير مُفعّل: يلزم ضبط ${missing.join(", ")} في متغيرات البيئة قبل تشغيل أي حملة.`);
    this.name = "AdPlatformNotConfiguredError";
  }
}

export interface CampaignPayload {
  name: string;
  objective: string;
  dailyBudget: number;
  currency?: string;
  status?: "PAUSED" | "ACTIVE";
  targeting?: Record<string, unknown>;
  creative?: { headline?: string; body?: string; imageUrl?: string; linkUrl?: string };
}

export function isMetaConfigured(): boolean {
  return !!(env.meta.pageAccessToken && env.meta.adAccountId);
}
export async function createMetaCampaign(payload: CampaignPayload) {
  if (!isMetaConfigured()) throw new AdPlatformNotConfiguredError("Meta (Instagram/Facebook)", ["META_PAGE_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"]);
  const url = `https://graph.facebook.com/v20.0/act_${env.meta.adAccountId}/campaigns`;
  const res = await axios.post(
    url,
    {
      name: payload.name,
      objective: payload.objective,
      status: payload.status ?? "PAUSED",
      special_ad_categories: [],
      access_token: env.meta.pageAccessToken,
    },
    { timeout: 20_000 }
  );
  return res.data;
}

export function isTikTokConfigured(): boolean {
  return !!(env.tiktok.accessToken && env.tiktok.advertiserId);
}
export async function createTikTokCampaign(payload: CampaignPayload) {
  if (!isTikTokConfigured()) throw new AdPlatformNotConfiguredError("TikTok for Business", ["TIKTOK_ACCESS_TOKEN", "TIKTOK_ADVERTISER_ID"]);
  const url = "https://business-api.tiktok.com/open_api/v1.3/campaign/create/";
  const res = await axios.post(
    url,
    {
      advertiser_id: env.tiktok.advertiserId,
      campaign_name: payload.name,
      objective_type: payload.objective,
      budget_mode: "BUDGET_MODE_DAY",
      budget: payload.dailyBudget,
      operation_status: payload.status === "ACTIVE" ? "ENABLE" : "DISABLE",
    },
    { headers: { "Access-Token": env.tiktok.accessToken! }, timeout: 20_000 }
  );
  return res.data;
}

export function isSnapchatConfigured(): boolean {
  return !!(env.snapchat.accessToken && env.snapchat.adAccountId);
}
export async function createSnapchatCampaign(payload: CampaignPayload) {
  if (!isSnapchatConfigured()) throw new AdPlatformNotConfiguredError("Snapchat", ["SNAPCHAT_ACCESS_TOKEN", "SNAPCHAT_AD_ACCOUNT_ID"]);
  const url = `https://adsapi.snapchat.com/v1/adaccounts/${env.snapchat.adAccountId}/campaigns`;
  const res = await axios.post(
    url,
    {
      campaigns: [
        {
          name: payload.name,
          status: payload.status ?? "PAUSED",
          daily_budget_micro: Math.round(payload.dailyBudget * 1_000_000),
        },
      ],
    },
    { headers: { Authorization: `Bearer ${env.snapchat.accessToken}` }, timeout: 20_000 }
  );
  return res.data;
}
