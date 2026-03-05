# Teneo Publishing — Agent Onboarding

## What This Project Is

AI agent content publishing API. Agents pay to generate, transform, analyze, and distribute content. Payments via ArxMint (L402 Lightning + Cashu ecash). All API costs marked up 2x. Every agent call tracked with stated purpose to discover new use cases.

**Status:** Live on localhost:3400. Real LLM calls (Anthropic Claude Sonnet 4), image generation via image-engine, file-based usage persistence. 93%+ margins on content calls. Ready for deployment.

## Lookup Table

| Concept | File(s) | Search Term |
|---------|---------|-------------|
| Publish API | `app/api/publish/route.ts` | `executeCapability POST` |
| Capabilities discovery | `app/api/capabilities/route.ts` | `getPricingMenu` |
| Usage analytics | `app/api/usage/route.ts` | `discoverPatterns getRevenueSummary` |
| AI-to-AI invoke | `app/api/ai-invoke/publish/route.ts` | `x-service-key callerService` |
| Agent registration | `app/api/register/route.ts` | `registerAgent apiKey` |
| Pricing engine | `lib/pricing.ts` | `getPrice calculateCost BASE_COSTS markup` |
| Usage tracker | `lib/usage-tracker.ts` | `trackUsage discoverPatterns UsagePattern` |
| LLM client | `lib/llm-client.ts` | `callLLM usdToSats estimateCostSats` |
| Image client | `lib/image-client.ts` | `generateImage transformImage` |
| ArxMint payment client | `lib/arxmint-client.ts` | `verifyPayment getPaymentInfo` |
| Agent auth | `lib/auth.ts` | `identifyAgent registerAgent anonymousAgent` |
| Types | `lib/types.ts` | `AgentUsageRecord PublishingCapability` |

## Tech Stack

Next.js 15 App Router, React 19, TypeScript. Anthropic API (Claude Sonnet 4) for content. Image-engine for images. ArxMint for payments (L402 + Cashu).

## Key Architecture Rules

1. **All pricing is cost x2.** `lib/pricing.ts` BASE_COSTS = floor. Real cost tracked per call via `usdToSats(llm.costUsd)`. Price = max(floor * 2, actualCost * 2).
2. **Every call tracked.** `trackUsage()` logs agent ID, capability, stated purpose, and cost breakdown to `.data/usage-log.json`. Usage data is the product intelligence.
3. **ArxMint handles payments.** This service verifies payment proofs via ArxMint's `verify-payment` service. Dev bypass via `SKIP_PAYMENT_VERIFY=true`.
4. **TE ecosystem agents at cost.** Internal services using `x-service-key` via `/api/ai-invoke/publish` get capabilities at 1x (no markup).
5. **Purpose field required.** Agents must state what they're using content for. `GET /api/usage?view=patterns` surfaces growing use cases.
6. **Anonymous agents OK.** Agents can pay directly via L402/Cashu without registering. Registration gives monthly budgets and tracking.

## Running

```bash
npm install
npm run dev  # http://localhost:3400
```

## Env Vars

```
ANTHROPIC_API_KEY=               # Required for content capabilities
ARXMINT_URL=https://arxmint.com  # Payment verification
ARXMINT_SERVICE_KEY=             # Service key for ArxMint
IMAGE_ENGINE_URL=                # Image generation service
IMAGE_ENGINE_SERVICE_KEY=        # Service key for image-engine
TENEO_SERVICE_KEYS=              # Comma-separated keys for callers
ADMIN_KEY=                       # Admin access for /api/usage
USD_TO_SATS_RATE=1100
SKIP_PAYMENT_VERIFY=true         # dev only, never production
```
