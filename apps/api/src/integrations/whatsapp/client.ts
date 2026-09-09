import axios from "axios";
import { env } from "../../env.js";

export class WhatsAppNotConfiguredError extends Error {
  constructor() {
    super(
      "تكامل واتساب غير مُفعّل: يلزم ضبط WHATSAPP_PHONE_NUMBER_ID و WHATSAPP_ACCESS_TOKEN في متغيرات البيئة قبل إرسال أي رسالة."
    );
    this.name = "WhatsAppNotConfiguredError";
  }
}

export function isWhatsAppConfigured(): boolean {
  return !!(env.whatsapp.phoneNumberId && env.whatsapp.accessToken);
}

export async function sendWhatsAppText(to: string, body: string) {
  if (!isWhatsAppConfigured()) throw new WhatsAppNotConfiguredError();
  const url = `https://graph.facebook.com/${env.whatsapp.apiVersion}/${env.whatsapp.phoneNumberId}/messages`;
  try {
    const res = await axios.post(
      url,
      { messaging_product: "whatsapp", to, type: "text", text: { body } },
      { headers: { Authorization: `Bearer ${env.whatsapp.accessToken}` }, timeout: 15_000 }
    );
    return res.data;
  } catch (err: any) {
    const message = err?.response?.data?.error?.message || err.message;
    throw new Error(`WhatsApp API error: ${message}`);
  }
}
