/**
 * OpenAI Ads Conversions API transport.
 * Call only from a trusted, verified Salla order lifecycle handler.
 * This module intentionally does NOT expose an HTTP endpoint or emit events by itself.
 */
export type OpenAIConversionEvent = {
  id: string;
  type: "order_created" | "checkout_started" | "items_added" | "contents_viewed" | "lead_created";
  timestamp_ms: number;
  source_url: string;
  action_source: "web";
  oppref?: string;
  user?: { obref?: string; emails_sha256?: string[]; phone_numbers_sha256?: string[] };
  data: {
    type: "contents" | "customer_action";
    amount?: number;
    currency?: string;
    contents?: Array<{ id?: string; quantity?: number; amount?: number; currency?: string }>;
  };
};

export type ConversionSendResult =
  | { status: "disabled" }
  | { status: "validated" | "sent"; httpStatus: number };

const EVENTS_ENDPOINT = "https://bzr.openai.com/v1/events";

export async function sendOpenAIConversion(
  event: OpenAIConversionEvent,
  options: { validateOnly?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<ConversionSendResult> {
  const pixelId = process.env.OPENAI_ADS_PIXEL_ID?.trim();
  const key = process.env.OPENAI_CONVERSIONS_API_KEY?.trim();
  if (!pixelId || !key) return { status: "disabled" };

  if (!event.id || !event.source_url || !Number.isInteger(event.timestamp_ms)) {
    throw new Error("OpenAI Ads: invalid event metadata");
  }
  if (event.timestamp_ms > Date.now() + 600_000 || event.timestamp_ms < Date.now() - 7 * 86400_000) {
    throw new Error("OpenAI Ads: timestamp outside accepted window");
  }
  const source = new URL(event.source_url);
  if (source.protocol !== "https:") throw new Error("OpenAI Ads: HTTPS source_url required");
  if (event.data.amount !== undefined &&
      (!Number.isSafeInteger(event.data.amount) || event.data.amount < 0 ||
       !/^[A-Z]{3}$/.test(event.data.currency ?? ""))) {
    throw new Error("OpenAI Ads: amount must be nonnegative minor units and currency ISO code");
  }

  // Attribution identifiers (oppref / obref) are forwarded as provided;
  // never decode, transform or log them.
  const response = await (options.fetchImpl ?? fetch)(
    `${EVENTS_ENDPOINT}?pid=${encodeURIComponent(pixelId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        validate_only: options.validateOnly ?? false,
        integration_source: "fara_ai_agent",
        events: [event],
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    // Never include response bodies, token values, or raw event data in errors.
    throw new Error(`OpenAI Ads conversion delivery failed (HTTP ${response.status})`);
  }
  return { status: options.validateOnly ? "validated" : "sent", httpStatus: response.status };
}
