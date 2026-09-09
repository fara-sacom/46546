import axios from "axios";
import { env } from "../../env.js";

export class RemoveBgNotConfiguredError extends Error {
  constructor() {
    super("إزالة خلفية الصور غير مُفعّلة: يلزم ضبط REMOVEBG_API_KEY في متغيرات البيئة (مفتاح مجاني من remove.bg).");
    this.name = "RemoveBgNotConfiguredError";
  }
}

export function isRemoveBgConfigured(): boolean {
  return !!env.removebg.apiKey;
}

export async function removeBackground(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  if (!isRemoveBgConfigured()) throw new RemoveBgNotConfiguredError();
  try {
    const res = await axios.post(
      "https://api.remove.bg/v1.0/removebg",
      { image_url: imageUrl, size: "preview" }, // "preview" = free tier (~0.25MP)
      {
        headers: { "X-Api-Key": env.removebg.apiKey! },
        responseType: "arraybuffer",
        timeout: 30_000,
        validateStatus: () => true,
      }
    );

    const contentType = String(res.headers["content-type"] ?? "");
    if (!contentType.startsWith("image/")) {
      const text = Buffer.from(res.data).toString("utf-8");
      let message = text;
      try {
        const parsed = JSON.parse(text);
        message = parsed.errors?.[0]?.title ?? text;
      } catch {
        // keep raw text
      }
      throw new Error(`remove.bg: ${message}`);
    }

    return { base64: Buffer.from(res.data).toString("base64"), mimeType: contentType };
  } catch (err: any) {
    if (err?.message?.startsWith("remove.bg:")) throw err;
    throw new Error(`remove.bg API error: ${err.message}`);
  }
}
