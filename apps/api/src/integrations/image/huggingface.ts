import axios from "axios";
import { env } from "../../env.js";

export class HuggingFaceNotConfiguredError extends Error {
  constructor() {
    super("توليد الصور غير مُفعّل: يلزم ضبط HUGGINGFACE_API_TOKEN في متغيرات البيئة (مفتاح مجاني من huggingface.co).");
    this.name = "HuggingFaceNotConfiguredError";
  }
}

export function isHuggingFaceConfigured(): boolean {
  return !!env.huggingface.apiToken;
}

export async function generateImage(prompt: string): Promise<{ base64: string; mimeType: string }> {
  if (!isHuggingFaceConfigured()) throw new HuggingFaceNotConfiguredError();
  const url = `https://api-inference.huggingface.co/models/${env.huggingface.imageModel}`;
  try {
    const res = await axios.post(
      url,
      { inputs: prompt },
      {
        headers: { Authorization: `Bearer ${env.huggingface.apiToken}` },
        responseType: "arraybuffer",
        timeout: 60_000,
        validateStatus: () => true,
      }
    );

    const contentType = String(res.headers["content-type"] ?? "");
    if (!contentType.startsWith("image/")) {
      // Hugging Face returns JSON (not an image) on errors, e.g. the model is still loading.
      const text = Buffer.from(res.data).toString("utf-8");
      let message = text;
      try {
        const parsed = JSON.parse(text);
        message = parsed.error ? `${parsed.error}${parsed.estimated_time ? ` (جاهز خلال ~${Math.ceil(parsed.estimated_time)} ثانية، أعيدي المحاولة)` : ""}` : text;
      } catch {
        // keep raw text
      }
      throw new Error(`Hugging Face: ${message}`);
    }

    return { base64: Buffer.from(res.data).toString("base64"), mimeType: contentType };
  } catch (err: any) {
    if (err?.message?.startsWith("Hugging Face:")) throw err;
    throw new Error(`Hugging Face API error: ${err.message}`);
  }
}
