import axios from "axios";
import { env } from "../../env.js";

export class YouTubeNotConfiguredError extends Error {
  constructor() {
    super("تكامل يوتيوب غير مُفعّل: يلزم ضبط YOUTUBE_API_KEY في متغيرات البيئة.");
    this.name = "YouTubeNotConfiguredError";
  }
}

export function isYouTubeConfigured(): boolean {
  return !!env.youtube.apiKey;
}

const BASE = "https://www.googleapis.com/youtube/v3";

export async function searchVideos(query: string, maxResults = 10) {
  if (!isYouTubeConfigured()) throw new YouTubeNotConfiguredError();
  const res = await axios.get(`${BASE}/search`, {
    params: { part: "snippet", q: query, maxResults, type: "video", key: env.youtube.apiKey },
    timeout: 15_000,
  });
  return res.data;
}

export async function videoStats(videoIds: string[]) {
  if (!isYouTubeConfigured()) throw new YouTubeNotConfiguredError();
  const res = await axios.get(`${BASE}/videos`, {
    params: { part: "statistics,snippet", id: videoIds.join(","), key: env.youtube.apiKey },
    timeout: 15_000,
  });
  return res.data;
}
