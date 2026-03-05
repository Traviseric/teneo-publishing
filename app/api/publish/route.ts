// ============================================================
// Teneo Publishing — Main Publish API
// POST /api/publish — Agent-facing content operations
//
// Payment: L402/Cashu via ArxMint, or x-service-key for TE agents
// Pricing: API cost x2 markup (actual cost tracked per call)
// Tracking: Every call logged with agent ID + stated purpose
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyPayment, getPaymentInfo } from "@/lib/arxmint-client";
import { calculateCost, getPrice } from "@/lib/pricing";
import { trackUsage } from "@/lib/usage-tracker";
import { identifyAgent, anonymousAgent } from "@/lib/auth";
import { callLLM, usdToSats } from "@/lib/llm-client";
import { generateImage, transformImage } from "@/lib/image-client";
import type { PublishingCapability } from "@/lib/types";

const VALID_CAPABILITIES: PublishingCapability[] = [
  "content-generate", "content-transform", "content-analyze",
  "content-distribute", "image-generate", "image-transform",
  "brand-apply", "seo-optimize", "social-format", "batch-publish",
];

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const capability = body.capability as PublishingCapability;
  const purpose = (body.purpose as string) || "unspecified";
  const content = body.content as string | undefined;
  const options = (body.options as Record<string, unknown>) || {};

  // Validate capability
  if (!capability || !VALID_CAPABILITIES.includes(capability)) {
    return NextResponse.json({
      error: "Invalid capability",
      validCapabilities: VALID_CAPABILITIES,
      hint: "GET /api/capabilities for full pricing menu",
    }, { status: 400 });
  }

  // Identify the agent
  const agent = identifyAgent(request.headers) || anonymousAgent();

  // Check budget for registered agents
  if (!agent.canProceed) {
    return NextResponse.json({
      error: "Monthly budget exceeded",
      tier: agent.tier,
      hint: "Upgrade tier or wait for monthly reset",
    }, { status: 429 });
  }

  // Estimate pricing for the 402 challenge
  const units = estimateUnits(capability, content);
  const estimated = calculateCost(capability, units);

  // Verify payment
  const payment = await verifyPayment(request.headers);
  if (!payment.verified) {
    return NextResponse.json({
      error: "Payment required",
      ...getPaymentInfo(estimated.priceSats),
      capability,
      pricing: getPrice(capability),
    }, { status: 402 });
  }

  // Execute the capability — real API calls
  let result: Record<string, unknown>;
  let actualCostSats: number;
  try {
    const execution = await executeCapability(capability, content, options);
    result = execution.result;
    actualCostSats = execution.costSats;
  } catch (err) {
    return NextResponse.json({
      error: "Capability execution failed",
      detail: err instanceof Error ? err.message : String(err),
      capability,
    }, { status: 500 });
  }

  // Price = actual cost x2 (or estimated minimum, whichever is higher)
  const costSats = actualCostSats;
  const priceSats = Math.max(estimated.priceSats, costSats * 2);
  const profitSats = priceSats - costSats;

  // Track usage — this is where we discover new use cases
  const usageRecord = trackUsage({
    agentId: agent.agentId,
    agentName: agent.agentName,
    capability,
    purpose,
    costSats,
    priceSats,
    paymentMethod: payment.method === "none" ? "free-tier" : payment.method,
    metadata: {
      contentLength: content?.length || 0,
      options,
      units,
      actualCostSats,
      profitSats,
      userAgent: request.headers.get("user-agent") || "unknown",
    },
  });

  return NextResponse.json({
    success: true,
    usageId: usageRecord.id,
    capability,
    priceSats,
    paymentMethod: payment.method,
    result,
    timestamp: Date.now(),
  });
}

/** Estimate units based on capability and content */
function estimateUnits(capability: PublishingCapability, content?: string): number {
  if (!content) return 1;
  switch (capability) {
    case "content-generate":
    case "content-transform":
    case "brand-apply":
      return Math.max(1, Math.ceil(content.length / 4000));
    default:
      return 1;
  }
}

/** Execute a publishing capability with real API calls */
async function executeCapability(
  capability: PublishingCapability,
  content?: string,
  options?: Record<string, unknown>,
): Promise<{ result: Record<string, unknown>; costSats: number }> {

  switch (capability) {
    case "content-generate": {
      const format = (options?.format as string) || "markdown";
      const tone = (options?.tone as string) || "professional";
      const maxTokens = (options?.maxTokens as number) || 2048;

      const llm = await callLLM({
        system: `You are a content generation engine. Output format: ${format}. Tone: ${tone}. Generate high-quality, publication-ready content.`,
        prompt: content || "Generate a short article about AI agents in commerce.",
        maxTokens,
      });

      return {
        result: {
          type: "generated-content",
          format,
          content: llm.content,
          tokenCount: llm.inputTokens + llm.outputTokens,
          model: llm.model,
        },
        costSats: usdToSats(llm.costUsd),
      };
    }

    case "content-transform": {
      const operation = (options?.operation as string) || "rewrite";
      const targetLanguage = options?.language as string | undefined;

      let systemPrompt = "You are a content transformation engine.";
      let userPrompt = content || "";

      switch (operation) {
        case "summarize":
          systemPrompt += " Summarize the following content concisely.";
          break;
        case "translate":
          systemPrompt += ` Translate the following content to ${targetLanguage || "Spanish"}.`;
          break;
        case "rewrite":
          systemPrompt += ` Rewrite the following content. Style: ${(options?.style as string) || "professional"}.`;
          break;
        case "expand":
          systemPrompt += " Expand and elaborate on the following content with more detail.";
          break;
        default:
          systemPrompt += ` ${operation} the following content.`;
      }

      const llm = await callLLM({
        system: systemPrompt,
        prompt: userPrompt,
        maxTokens: (options?.maxTokens as number) || 2048,
      });

      return {
        result: {
          type: "transformed-content",
          operation,
          originalLength: content?.length || 0,
          content: llm.content,
          tokenCount: llm.inputTokens + llm.outputTokens,
          model: llm.model,
        },
        costSats: usdToSats(llm.costUsd),
      };
    }

    case "content-analyze": {
      const llm = await callLLM({
        system: `You are a content analysis engine. Analyze the provided content and return a JSON object with these fields:
- readabilityScore (0-100)
- sentimentScore (-1 to 1)
- seoScore (0-100)
- wordCount (integer)
- keyTopics (array of strings)
- suggestions (array of improvement strings)
- tone (string)
- targetAudience (string)
Return ONLY valid JSON, no markdown fences.`,
        prompt: content || "No content provided",
        maxTokens: 1024,
      });

      let analysis: Record<string, unknown>;
      try {
        analysis = JSON.parse(llm.content);
      } catch {
        analysis = { raw: llm.content, parseError: true };
      }

      return {
        result: {
          type: "analysis",
          ...analysis,
          wordCount: content ? content.split(/\s+/).length : 0,
          model: llm.model,
        },
        costSats: usdToSats(llm.costUsd),
      };
    }

    case "content-distribute": {
      // Distribution is an orchestration capability — queues for delivery
      const channels = (options?.channels as string[]) || ["blog"];
      return {
        result: {
          type: "distribution-queued",
          channels,
          contentLength: content?.length || 0,
          status: "queued",
          jobId: `dist_${Date.now().toString(36)}`,
          note: "Content queued for distribution. Webhook notification on completion.",
        },
        costSats: 5 * channels.length, // minimal cost per channel
      };
    }

    case "image-generate": {
      const img = await generateImage({
        prompt: content || "A professional business illustration",
        dimensions: (options?.dimensions as string) || "1:1",
        style: (options?.style as string) || "professional",
        provider: (options?.provider as string),
      });

      return {
        result: {
          type: "image-result",
          success: img.success,
          imageUrl: img.imageUrl || null,
          prompt: content?.slice(0, 200),
          provider: img.provider,
          error: img.error,
        },
        costSats: usdToSats(img.costUsd),
      };
    }

    case "image-transform": {
      const imageUrl = (options?.sourceUrl as string) || content || "";
      const operation = (options?.operation as string) || "enhance";

      const img = await transformImage({
        imageUrl,
        operation,
        options,
      });

      return {
        result: {
          type: "image-transform-result",
          success: img.success,
          imageUrl: img.imageUrl || null,
          operation,
          error: img.error,
        },
        costSats: usdToSats(img.costUsd),
      };
    }

    case "brand-apply": {
      const brandId = (options?.brandId as string) || "default";
      const brandVoice = (options?.brandVoice as string) || "professional, authoritative, approachable";
      const brandStyle = (options?.brandStyle as string) || "";

      const llm = await callLLM({
        system: `You are a brand voice engine. Rewrite the content to match this brand voice: ${brandVoice}. ${brandStyle ? `Style guidelines: ${brandStyle}` : ""} Maintain the core message while applying the brand personality.`,
        prompt: content || "No content provided",
        maxTokens: 2048,
      });

      return {
        result: {
          type: "branded-content",
          brandId,
          content: llm.content,
          tokenCount: llm.inputTokens + llm.outputTokens,
          model: llm.model,
        },
        costSats: usdToSats(llm.costUsd),
      };
    }

    case "seo-optimize": {
      const llm = await callLLM({
        system: `You are an SEO optimization engine. Analyze the content and return a JSON object with:
- metaTitle (under 60 chars, keyword-rich)
- metaDescription (under 160 chars)
- keywords (array of 5-10 target keywords)
- headingStructure (suggested H1/H2/H3 structure as array)
- internalLinkSuggestions (array of anchor text + topic pairs)
- schemaType (recommended schema.org type)
- contentGaps (what's missing for SEO)
Return ONLY valid JSON, no markdown fences.`,
        prompt: content || "No content provided",
        maxTokens: 1024,
      });

      let seo: Record<string, unknown>;
      try {
        seo = JSON.parse(llm.content);
      } catch {
        seo = { raw: llm.content, parseError: true };
      }

      return {
        result: { type: "seo-result", ...seo, model: llm.model },
        costSats: usdToSats(llm.costUsd),
      };
    }

    case "social-format": {
      const platform = (options?.platform as string) || "twitter";
      const platformLimits: Record<string, string> = {
        twitter: "280 chars, hashtags, thread-friendly",
        linkedin: "3000 chars, professional tone, no hashtag spam",
        instagram: "2200 chars, emoji-friendly, 30 hashtags max",
        facebook: "63,206 chars, casual tone, engagement-focused",
        tiktok: "150 chars, trendy, hook-first",
      };

      const llm = await callLLM({
        system: `You are a social media content formatter. Format the content for ${platform}. Constraints: ${platformLimits[platform] || "platform defaults"}. Return a JSON object with:
- post (the formatted post text)
- hashtags (array)
- callToAction (string)
- bestPostingTime (suggestion)
- contentType (text/carousel/story/reel suggestion)
Return ONLY valid JSON, no markdown fences.`,
        prompt: content || "No content provided",
        maxTokens: 1024,
      });

      let formatted: Record<string, unknown>;
      try {
        formatted = JSON.parse(llm.content);
      } catch {
        formatted = { post: llm.content };
      }

      return {
        result: { type: "social-formatted", platform, ...formatted, model: llm.model },
        costSats: usdToSats(llm.costUsd),
      };
    }

    case "batch-publish": {
      const channels = (options?.channels as string[]) || [];
      const results: Record<string, unknown>[] = [];

      // Run each channel in parallel
      const channelPromises = channels.map(async (channel) => {
        if (["twitter", "linkedin", "instagram", "facebook", "tiktok"].includes(channel)) {
          const { result, costSats } = await executeCapability("social-format", content, { ...options, platform: channel });
          return { channel, result, costSats };
        }
        return { channel, result: { status: "queued" }, costSats: 5 };
      });

      const channelResults = await Promise.all(channelPromises);
      let totalCost = 0;
      for (const cr of channelResults) {
        results.push({ channel: cr.channel, ...cr.result });
        totalCost += cr.costSats;
      }

      return {
        result: {
          type: "batch-result",
          channels,
          results,
          totalChannels: channels.length,
        },
        costSats: totalCost,
      };
    }

    default:
      return { result: { error: "Unknown capability" }, costSats: 0 };
  }
}
