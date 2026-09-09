import axios from "axios";
import { env } from "../../env.js";

// MyMemory (translated.net) needs no API key for its free tier: 5,000
// chars/day anonymously, ~10,000 words/day when a contact email is passed.
const MAX_SEGMENT_CHARS = 500; // MyMemory's documented per-segment limit

export async function translateText(text: string, sourceLang: string, targetLang: string) {
  if (text.length > MAX_SEGMENT_CHARS) {
    throw new Error(`النص أطول من الحد المسموح لكل طلب (${MAX_SEGMENT_CHARS} حرف) في الخطة المجانية من MyMemory.`);
  }
  try {
    const res = await axios.get("https://api.mymemory.translated.net/get", {
      params: {
        q: text,
        langpair: `${sourceLang}|${targetLang}`,
        de: env.mymemory.contactEmail,
      },
      timeout: 15_000,
    });
    const data = res.data;
    if (data?.responseStatus && Number(data.responseStatus) >= 400) {
      throw new Error(data.responseDetails || "MyMemory translation failed");
    }
    return {
      translatedText: data?.responseData?.translatedText as string,
      match: data?.responseData?.match as number | undefined,
    };
  } catch (err: any) {
    const message = err?.response?.data?.responseDetails || err.message;
    throw new Error(`MyMemory API error: ${message}`);
  }
}
