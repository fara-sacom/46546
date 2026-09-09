import axios from "axios";
import { env } from "../../env.js";

export class TavilyNotConfiguredError extends Error {
  constructor() {
    super("البحث في الإنترنت غير مُفعّل: يلزم ضبط TAVILY_API_KEY في متغيرات البيئة (مفتاح مجاني من tavily.com).");
    this.name = "TavilyNotConfiguredError";
  }
}

export function isTavilyConfigured(): boolean {
  return !!env.tavily.apiKey;
}

export async function tavilySearch(query: string, maxResults = 5) {
  if (!isTavilyConfigured()) throw new TavilyNotConfiguredError();
  try {
    const res = await axios.post(
      "https://api.tavily.com/search",
      { api_key: env.tavily.apiKey, query, max_results: maxResults, search_depth: "basic" },
      { timeout: 20_000 }
    );
    return res.data;
  } catch (err: any) {
    const message = err?.response?.data?.error || err.message;
    throw new Error(`Tavily API error: ${message}`);
  }
}
