// ============================================================
// Teneo Publishing — AI-to-AI Invoke Endpoint
// POST /api/ai-invoke/publish
// Standard TE ecosystem cross-system integration.
// Other TE services call this with x-service-key header.
// Internal services get at-cost pricing (no 2x markup).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { trackUsage } from "@/lib/usage-tracker";
import { callLLM, usdToSats } from "@/lib/llm-client";
import { generateImage } from "@/lib/image-client";
import type { PublishingCapability } from "@/lib/types";

const VALID_CAPABILITIES: PublishingCapability[] = [
  "content-generate", "content-transform", "content-analyze",
  "content-distribute", "image-generate", "image-transform",
  "brand-apply", "seo-optimize", "social-format", "batch-publish",
];

export async function POST(request: NextRequest) {
  // Verify TE ecosystem service key
  const serviceKey = request.headers.get("x-service-key");
  const validKeys = process.env.TENEO_SERVICE_KEYS?.split(",") || [];

  if (!serviceKey || !validKeys.includes(serviceKey)) {
    return NextResponse.json(
      { error: "Invalid service key", hint: "x-service-key header required for AI-to-AI invocation" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const capability = body.capability as PublishingCapability;
  const callerService = (body.callerService as string) || "unknown-te-service";
  const purpose = (body.purpose as string) || `ai-invoke from ${callerService}`;
  const content = body.content as string | undefined;
  const options = (body.options as Record<string, unknown>) || {};

  if (!capability || !VALID_CAPABILITIES.includes(capability)) {
    return NextResponse.json({
      error: "Invalid capability",
      validCapabilities: VALID_CAPABILITIES,
    }, { status: 400 });
  }

  // Execute capability — same real APIs, but at-cost for internal
  let result: Record<string, unknown>;
  let costSats: number;

  try {
    const execution = await executeInternalCapability(capability, content, options);
    result = execution.result;
    costSats = execution.costSats;
  } catch (err) {
    return NextResponse.json({
      error: "Capability execution failed",
      detail: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }

  // Track internal usage — at cost, no markup
  trackUsage({
    agentId: `te_${callerService}`,
    agentName: callerService,
    capability,
    purpose,
    costSats,
    priceSats: costSats, // At cost for internal TE services
    paymentMethod: "service-key",
    metadata: { callerService, internal: true },
  });

  return NextResponse.json({
    success: true,
    capability,
    costSats,
    pricing: "at-cost (internal TE service)",
    result,
    timestamp: Date.now(),
  });
}

/** Simplified execution for internal services — same LLM calls */
async function executeInternalCapability(
  capability: PublishingCapability,
  content?: string,
  options?: Record<string, unknown>,
): Promise<{ result: Record<string, unknown>; costSats: number }> {

  // Content capabilities — call LLM
  const llmCapabilities = [
    "content-generate", "content-transform", "content-analyze",
    "brand-apply", "seo-optimize", "social-format",
  ];

  if (llmCapabilities.includes(capability)) {
    const systemPrompts: Record<string, string> = {
      "content-generate": `Generate ${(options?.format as string) || "markdown"} content. Tone: ${(options?.tone as string) || "professional"}.`,
      "content-transform": `${(options?.operation as string) || "Rewrite"} the following content.`,
      "content-analyze": "Analyze the content. Return JSON with readabilityScore, sentimentScore, seoScore, wordCount, keyTopics, suggestions.",
      "brand-apply": `Rewrite in brand voice: ${(options?.brandVoice as string) || "professional"}.`,
      "seo-optimize": "Optimize for SEO. Return JSON with metaTitle, metaDescription, keywords, headingStructure.",
      "social-format": `Format for ${(options?.platform as string) || "twitter"}. Return JSON with post, hashtags, callToAction.`,
    };

    const llm = await callLLM({
      system: systemPrompts[capability] || "Process the content.",
      prompt: content || "No content provided",
      maxTokens: (options?.maxTokens as number) || 2048,
    });

    let parsed: Record<string, unknown> = { content: llm.content };
    if (["content-analyze", "seo-optimize", "social-format"].includes(capability)) {
      try { parsed = JSON.parse(llm.content); } catch { /* use raw */ }
    }

    return {
      result: { type: capability, ...parsed, model: llm.model, tokenCount: llm.inputTokens + llm.outputTokens },
      costSats: usdToSats(llm.costUsd),
    };
  }

  // Image capabilities
  if (capability === "image-generate") {
    const img = await generateImage({
      prompt: content || "Professional illustration",
      dimensions: (options?.dimensions as string) || "1:1",
      style: (options?.style as string),
    });
    return {
      result: { type: "image-result", success: img.success, imageUrl: img.imageUrl, provider: img.provider, error: img.error },
      costSats: usdToSats(img.costUsd),
    };
  }

  // Distribution — minimal cost
  if (capability === "content-distribute" || capability === "batch-publish") {
    const channels = (options?.channels as string[]) || [];
    return {
      result: { type: "distribution-queued", channels, status: "queued", jobId: `dist_${Date.now().toString(36)}` },
      costSats: 5 * Math.max(1, channels.length),
    };
  }

  return { result: { type: capability, status: "unsupported" }, costSats: 0 };
}
