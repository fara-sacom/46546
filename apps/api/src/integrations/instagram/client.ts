import axios from "axios";
import { env } from "../../env.js";

export class InstagramNotConfiguredError extends Error {
  constructor() {
    super(
      "تكامل إنستغرام غير مُفعّل: يلزم ضبط META_PAGE_ACCESS_TOKEN و INSTAGRAM_BUSINESS_ACCOUNT_ID في متغيرات البيئة (نفس تطبيق ميتا المستخدم للإعلانات)."
    );
    this.name = "InstagramNotConfiguredError";
  }
}

export function isInstagramConfigured(): boolean {
  return !!(env.meta.pageAccessToken && env.meta.instagramBusinessAccountId);
}

const BASE = "https://graph.facebook.com";

async function request<T>(method: "get" | "post", path: string, params?: Record<string, unknown>, data?: unknown): Promise<T> {
  if (!isInstagramConfigured()) throw new InstagramNotConfiguredError();
  try {
    const res = await axios.request<T>({
      method,
      url: `${BASE}/${env.meta.apiVersion}${path}`,
      params: { access_token: env.meta.pageAccessToken, ...params },
      data,
      timeout: 20_000,
    });
    return res.data;
  } catch (err: any) {
    const message = err?.response?.data?.error?.message || err.message;
    throw new Error(`Instagram Graph API error: ${message}`);
  }
}

// Real official Meta Graph API shape. Sending real DMs at volume additionally
// requires the instagram_business_manage_messages permission to be approved
// via Meta App Review - see docs/fara-agent-architecture.md.
export const instagram = {
  listConversations: (limit = 20) =>
    request<{ data: Array<{ id: string; updated_time?: string; participants?: unknown }> }>(
      "get",
      `/${env.meta.instagramBusinessAccountId}/conversations`,
      { platform: "instagram", limit }
    ),

  listMessages: (conversationId: string, limit = 20) =>
    request<{ messages?: { data: Array<{ id: string; message?: string; from?: unknown; created_time?: string }> } }>(
      "get",
      `/${conversationId}`,
      { fields: `messages.limit(${limit}){message,from,created_time}` }
    ),

  sendMessage: (recipientId: string, text: string) =>
    request(
      "post",
      `/${env.meta.instagramBusinessAccountId}/messages`,
      undefined,
      { recipient: { id: recipientId }, message: { text } }
    ),

  replyToComment: (commentId: string, text: string) =>
    request("post", `/${commentId}/replies`, undefined, { message: text }),
};
