// ============================================================
// Teneo Publishing — Pricing Engine
// API costs x2 markup. Track everything.
// ============================================================

import type { CapabilityPricing, PublishingCapability } from "./types";

const DEFAULT_MARKUP = 2.0;

/**
 * Base costs in sats — what it actually costs us to run each capability.
 * These get updated as real costs are measured.
 */
const BASE_COSTS: Record<PublishingCapability, { cost: number; unit: string; description: string }> = {
  "content-generate":   { cost: 50,  unit: "per 1k tokens",  description: "Generate content from prompt (LLM call)" },
  "content-transform":  { cost: 30,  unit: "per 1k tokens",  description: "Rewrite, translate, or summarize content" },
  "content-analyze":    { cost: 20,  unit: "per request",     description: "SEO, readability, and sentiment analysis" },
  "content-distribute": { cost: 10,  unit: "per channel",     description: "Push content to a distribution channel" },
  "image-generate":     { cost: 200, unit: "per image",       description: "AI image generation" },
  "image-transform":    { cost: 15,  unit: "per image",       description: "Resize, crop, or format conversion" },
  "brand-apply":        { cost: 40,  unit: "per request",     description: "Apply brand voice and style guidelines" },
  "seo-optimize":       { cost: 25,  unit: "per request",     description: "Keyword research, meta tags, schema markup" },
  "social-format":      { cost: 15,  unit: "per platform",    description: "Format content for a specific social platform" },
  "batch-publish":      { cost: 100, unit: "per batch",       description: "Multi-channel publish in one call" },
};

/** Get pricing for a specific capability */
export function getPrice(capability: PublishingCapability, markup = DEFAULT_MARKUP): CapabilityPricing {
  const base = BASE_COSTS[capability];
  return {
    capability,
    baseCostSats: base.cost,
    markup,
    priceSats: Math.ceil(base.cost * markup),
    unit: base.unit,
    description: base.description,
  };
}

/** Get the full pricing menu */
export function getPricingMenu(markup = DEFAULT_MARKUP): CapabilityPricing[] {
  return (Object.keys(BASE_COSTS) as PublishingCapability[]).map(cap => getPrice(cap, markup));
}

/** Calculate cost for a specific request based on usage */
export function calculateCost(
  capability: PublishingCapability,
  units: number = 1,
  markup = DEFAULT_MARKUP
): { costSats: number; priceSats: number; profitSats: number } {
  const base = BASE_COSTS[capability];
  const costSats = base.cost * units;
  const priceSats = Math.ceil(costSats * markup);
  return {
    costSats,
    priceSats,
    profitSats: priceSats - costSats,
  };
}
