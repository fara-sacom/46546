import { describe, expect, it } from "vitest";
import { isSallaConfigured, salla, SallaNotConfiguredError } from "../src/integrations/salla/client.js";
import { isWhatsAppConfigured, sendWhatsAppText, WhatsAppNotConfiguredError } from "../src/integrations/whatsapp/client.js";

describe("integration clients fail closed when not configured (never fabricate data)", () => {
  it("Salla client refuses to call the API without SALLA_ACCESS_TOKEN", async () => {
    expect(isSallaConfigured()).toBe(false);
    await expect(salla.get("/products")).rejects.toBeInstanceOf(SallaNotConfiguredError);
  });

  it("WhatsApp client refuses to send without credentials", async () => {
    expect(isWhatsAppConfigured()).toBe(false);
    await expect(sendWhatsAppText("+966500000000", "hi")).rejects.toBeInstanceOf(WhatsAppNotConfiguredError);
  });
});
