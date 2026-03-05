// ============================================================
// Teneo Publishing — Capabilities Discovery
// GET /api/capabilities — what agents can do + pricing
// This is the first thing an agent calls to understand the API.
// ============================================================

import { NextResponse } from "next/server";
import { getPricingMenu } from "@/lib/pricing";

export async function GET() {
  const pricing = getPricingMenu();

  return NextResponse.json({
    service: "teneo-publishing",
    version: "0.1.0",
    description: "AI agent content publishing API. Generate, transform, analyze, and distribute content. Pay per use via Lightning L402 or Cashu ecash.",
    capabilities: pricing.map(p => ({
      capability: p.capability,
      description: p.description,
      priceSats: p.priceSats,
      unit: p.unit,
      markup: `${p.markup}x`,
    })),
    authentication: {
      methods: [
        { method: "l402", description: "Lightning L402 payment proof via ArxMint" },
        { method: "cashu", description: "Cashu NUT-24 ecash token" },
        { method: "service-key", description: "TE ecosystem service key (x-service-key header)" },
        { method: "api-key", description: "Registered agent API key (x-api-key header)" },
      ],
    },
    endpoints: {
      publish: {
        method: "POST",
        path: "/api/publish",
        body: {
          capability: "string (required) — one of the capabilities listed above",
          purpose: "string (required) — what you're using this for (tracked for analytics)",
          content: "string (optional) — input content for the capability",
          options: "object (optional) — capability-specific options",
        },
      },
      capabilities: {
        method: "GET",
        path: "/api/capabilities",
        description: "This endpoint — capability discovery and pricing",
      },
      usage: {
        method: "GET",
        path: "/api/usage",
        description: "Usage analytics and pattern discovery (admin only)",
      },
      aiInvoke: {
        method: "POST",
        path: "/api/ai-invoke/publish",
        description: "TE ecosystem AI-to-AI invoke endpoint",
      },
    },
    paymentInfo: {
      arxmintUrl: process.env.ARXMINT_URL || "https://arxmint.com",
      note: "All payments routed through ArxMint sovereign commerce rails",
    },
    timestamp: Date.now(),
  });
}
