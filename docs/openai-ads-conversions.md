# OpenAI Ads conversion tracking — FARA AI Agent

## Status
The repository contains an internal agent dashboard, **not** the Salla storefront. The new
`apps/api/src/integrations/openaiAds/conversions.ts` module is an opt-in server-side transport,
not an active purchase integration. **No conversion events are sent until an authenticated
order source is wired to it and keys are configured.** Do not add a Pixel to the internal dashboard:
staff browsing is not storefront customer activity.

## Provisioning
1. In OpenAI Ads Manager, create/reuse a web data source and copy the **Pixel ID**.
2. Create a Conversions API key for the same ad account, then store it only in a
   server-side secret manager as `OPENAI_CONVERSIONS_API_KEY`.
3. Set `OPENAI_ADS_PIXEL_ID` in the API server environment. Never use `VITE_` for the key.
4. Create a conversion event setting for `order_created`, choose the corresponding
   source ID (not the Pixel ID) and attach it to the intended campaign.
5. Confirm actual measurement eligibility and consent requirements before collecting data.

## Connect to Salla (remaining work)
Integrate only after implementing and verifying **authenticated Salla order webhook delivery**
(or a trusted verified order sync). Do NOT expose an unauthenticated endpoint allowing arbitrary
events. Map a newly created verified order to `order_created` and send it once at the
chosen business milestone; don't send on dashboard page load or general order reads.

- Use deterministic `id` derived from the stable order identifier, e.g. `salla_order_<id>`;
  use exactly the same ID in any browser Pixel event for the same purchase.
- Use the original order timestamp in milliseconds, within the API's 7-day age limit.
- Map actual paid order amount to **integer minor currency units** (SAR 550.00 → 55000)
  and set `currency: "SAR"`. Do not guess whether Salla's amount is major or minor units.
- Use the real storefront confirmation-page HTTPS URL as `source_url`, not an internal dashboard URL.
- Persist a sent-event ledger keyed by stable event ID, with explicit status/retry handling,
  to prevent repeat deliveries across webhook retries. A request timeout is ambiguous:
  retry with exactly the same event ID. Do not regenerate IDs.
- Capture and pass `oppref` and optional `obref` only when available through a consent-compliant
  storefront-to-order flow; never invent, parse or log attribution values.
- Do not send raw email addresses, phone numbers or other personal identifiers.
  If necessary and permitted, hash supported identifiers according to OpenAI's normalization rules.
- When ready, call `sendOpenAIConversion(event, { validateOnly: true })` with a
  trusted **test** order first. This validates but does not record the event.
  Verify real accepted events through the OpenAI Ads event stream/Ads Manager.
  Never treat a successful HTTP request as proof of an attributed conversion.

## Official references
- https://developers.openai.com/ads/conversions-api
- https://developers.openai.com/ads/conversion-tracking
- https://developers.openai.com/ads/api-reference/conversion-setup
