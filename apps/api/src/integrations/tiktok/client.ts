import axios from "axios";
import { env } from "../../env.js";

export class TikTokCommentsNotConfiguredError extends Error {
  constructor() {
    super("الرد على تعليقات تيك توك غير مُفعّل: يلزم ضبط TIKTOK_ACCESS_TOKEN في متغيرات البيئة (نفس تطبيق تيك توك للأعمال).");
    this.name = "TikTokCommentsNotConfiguredError";
  }
}

export function isTikTokCommentsConfigured(): boolean {
  return !!env.tiktok.accessToken;
}

// TikTok for Business API - official "Reply to a comment" endpoint.
// https://business-api.tiktok.com/portal/docs/reply-to-a-comment/v1.3
// (path below follows TikTok's own v1.3 naming convention; re-verify against
// the live docs before production use, same as every other endpoint here
// whose exact path wasn't hand-confirmed against a working account.)
export async function replyToTikTokComment(commentId: string, text: string) {
  if (!isTikTokCommentsConfigured()) throw new TikTokCommentsNotConfiguredError();
  try {
    const res = await axios.post(
      "https://business-api.tiktok.com/open_api/v1.3/comment/reply/create/",
      {
        advertiser_id: env.tiktok.advertiserId,
        comment_id: commentId,
        text,
      },
      { headers: { "Access-Token": env.tiktok.accessToken! }, timeout: 20_000 }
    );
    return res.data;
  } catch (err: any) {
    const message = err?.response?.data?.message || err.message;
    throw new Error(`TikTok API error: ${message}`);
  }
}
