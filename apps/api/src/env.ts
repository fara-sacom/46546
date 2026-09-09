import "dotenv/config";

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

export const env = {
  port: Number(process.env.PORT ?? 8787),
  staffApiKeys: (optional("STAFF_API_KEYS") ?? "").split(",").map((k) => k.trim()).filter(Boolean),

  anthropicApiKey: optional("ANTHROPIC_API_KEY"),
  agentModel: optional("AGENT_MODEL") ?? "claude-sonnet-5",

  salla: {
    accessToken: optional("SALLA_ACCESS_TOKEN"),
    baseUrl: optional("SALLA_API_BASE_URL") ?? "https://api.salla.dev/admin/v2",
    webhookSecret: optional("SALLA_WEBHOOK_SECRET"),
  },

  whatsapp: {
    phoneNumberId: optional("WHATSAPP_PHONE_NUMBER_ID"),
    accessToken: optional("WHATSAPP_ACCESS_TOKEN"),
    verifyToken: optional("WHATSAPP_VERIFY_TOKEN"),
    apiVersion: optional("WHATSAPP_API_VERSION") ?? "v20.0",
  },

  youtube: {
    apiKey: optional("YOUTUBE_API_KEY"),
  },

  meta: {
    appId: optional("META_APP_ID"),
    appSecret: optional("META_APP_SECRET"),
    pageAccessToken: optional("META_PAGE_ACCESS_TOKEN"),
    adAccountId: optional("META_AD_ACCOUNT_ID"),
  },

  tiktok: {
    appId: optional("TIKTOK_APP_ID"),
    appSecret: optional("TIKTOK_APP_SECRET"),
    accessToken: optional("TIKTOK_ACCESS_TOKEN"),
    advertiserId: optional("TIKTOK_ADVERTISER_ID"),
  },

  snapchat: {
    clientId: optional("SNAPCHAT_CLIENT_ID"),
    clientSecret: optional("SNAPCHAT_CLIENT_SECRET"),
    accessToken: optional("SNAPCHAT_ACCESS_TOKEN"),
    adAccountId: optional("SNAPCHAT_AD_ACCOUNT_ID"),
  },
};

export function isConfigured(...values: (string | undefined)[]): boolean {
  return values.every((v) => !!v);
}
