import { beforeAll, describe, expect, it } from "vitest";
import { syncToolRegistry, getTool } from "../src/agent/toolRegistry.js";
import { routeToolCall } from "../src/agent/router.js";
import { isTavilyConfigured, tavilySearch, TavilyNotConfiguredError } from "../src/integrations/search/tavily.js";
import { isHuggingFaceConfigured, generateImage, HuggingFaceNotConfiguredError } from "../src/integrations/image/huggingface.js";
import { isRemoveBgConfigured, removeBackground, RemoveBgNotConfiguredError } from "../src/integrations/image/removebg.js";
import { translateText } from "../src/integrations/translation/mymemory.js";

describe("new AI service integrations are registered with the correct permission tier", () => {
  beforeAll(async () => {
    await syncToolRegistry();
  });

  it("vision.analyzeImage, search.web and translate.text are READ tools", () => {
    expect(getTool("vision.analyzeImage")?.tier).toBe("READ");
    expect(getTool("search.web")?.tier).toBe("READ");
    expect(getTool("translate.text")?.tier).toBe("READ");
  });

  it("image.generate and image.removeBackground are DRAFT tools (never publish anything)", () => {
    expect(getTool("image.generate")?.tier).toBe("DRAFT");
    expect(getTool("image.removeBackground")?.tier).toBe("DRAFT");
  });
});

describe("new integrations fail closed when not configured (never fabricate results)", () => {
  it("Tavily refuses to search without TAVILY_API_KEY", async () => {
    expect(isTavilyConfigured()).toBe(false);
    await expect(tavilySearch("test")).rejects.toBeInstanceOf(TavilyNotConfiguredError);
  });

  it("Hugging Face refuses to generate without HUGGINGFACE_API_TOKEN", async () => {
    expect(isHuggingFaceConfigured()).toBe(false);
    await expect(generateImage("a red dress")).rejects.toBeInstanceOf(HuggingFaceNotConfiguredError);
  });

  it("remove.bg refuses to process without REMOVEBG_API_KEY", async () => {
    expect(isRemoveBgConfigured()).toBe(false);
    await expect(removeBackground("https://example.com/x.jpg")).rejects.toBeInstanceOf(RemoveBgNotConfiguredError);
  });

  it("ACTION-adjacent DRAFT tools (image generation) never touch the network for the router itself", async () => {
    // routeToolCall for a DRAFT tool still calls its handler immediately (unlike ACTION),
    // so this confirms the failure surfaces as a normal "failed" router result, not a crash.
    const result = await routeToolCall("image.generate", { prompt: "a red evening dress" }, { actorLabel: "test" });
    expect(result.status).toBe("failed");
    expect(result.tier).toBe("DRAFT");
  });
});

describe("MyMemory translation input validation", () => {
  it("rejects text longer than the free-tier per-segment limit before calling the network", async () => {
    const longText = "a".repeat(600);
    await expect(translateText(longText, "en", "ar")).rejects.toThrow(/أطول من الحد المسموح/);
  });
});
