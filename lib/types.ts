// ============================================================
// Teneo Publishing — Core Types
// ============================================================

/** Every agent request gets tracked */
export interface AgentUsageRecord {
  id: string;
  agentId: string;
  agentName?: string;
  capability: string;
  /** What the agent says it's using the content for */
  purpose: string;
  /** Raw cost to us (LLM tokens, image gen, etc.) */
  costSats: number;
  /** What we charge the agent (costSats * markup) */
  priceSats: number;
  /** Profit = priceSats - costSats */
  profitSats: number;
  paymentMethod: "l402" | "cashu" | "service-key" | "free-tier";
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/** Publishing capabilities agents can call */
export type PublishingCapability =
  | "content-generate"     // Generate content from prompt
  | "content-transform"    // Rewrite/translate/summarize existing content
  | "content-analyze"      // SEO analysis, readability scoring, sentiment
  | "content-distribute"   // Push to channels (social, email, CMS)
  | "image-generate"       // AI image generation
  | "image-transform"      // Resize, crop, format conversion
  | "brand-apply"          // Apply brand voice/style to content
  | "seo-optimize"         // Keyword research, meta tags, schema markup
  | "social-format"        // Format content for specific platforms
  | "batch-publish";       // Multi-channel publish in one call

/** Pricing config per capability */
export interface CapabilityPricing {
  capability: PublishingCapability;
  baseCostSats: number;
  markup: number; // multiplier (2.0 = 2x)
  priceSats: number; // baseCostSats * markup
  unit: string; // "per request", "per 1k tokens", etc.
  description: string;
}

/** Agent registration */
export interface RegisteredAgent {
  id: string;
  name: string;
  /** Service key for TE ecosystem agents */
  serviceKey?: string;
  /** API key for external agents */
  apiKey: string;
  tier: "free" | "standard" | "premium";
  /** Monthly usage caps (sats) */
  monthlyCap: number;
  usedThisMonth: number;
  createdAt: Date;
}

/** Usage analytics for discovering new use cases */
export interface UsagePattern {
  purpose: string;
  count: number;
  totalSats: number;
  avgCostSats: number;
  uniqueAgents: number;
  firstSeen: Date;
  lastSeen: Date;
  trend: "growing" | "stable" | "declining";
}
