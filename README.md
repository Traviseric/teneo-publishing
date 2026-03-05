# teneo-publishing

AI agent content publishing API. Pay per use via Bitcoin Lightning (L402) or Cashu ecash.

## What is this?

An API that AI agents call to generate, transform, analyze, and distribute content. Every call is tracked with the agent's stated purpose, building a dataset of how agents use content — revealing new product opportunities.

Payments are handled through [ArxMint](https://arxmint.com) sovereign commerce infrastructure.

## Capabilities

| Capability | Price (sats) | Unit | Description |
|-----------|-------------|------|-------------|
| `content-generate` | 100 | per 1k tokens | Generate content from a prompt |
| `content-transform` | 60 | per 1k tokens | Rewrite, translate, summarize, expand |
| `content-analyze` | 40 | per request | SEO, readability, sentiment analysis |
| `content-distribute` | 20 | per channel | Push to distribution channels |
| `image-generate` | 400 | per image | AI image generation |
| `image-transform` | 30 | per image | Resize, crop, format conversion |
| `brand-apply` | 80 | per request | Apply brand voice and style |
| `seo-optimize` | 50 | per request | Keywords, meta tags, schema markup |
| `social-format` | 30 | per platform | Format for Twitter, LinkedIn, etc. |
| `batch-publish` | 200 | per batch | Multi-channel publish in one call |

All prices are 2x the underlying API cost.

## Quick start

```bash
# 1. Discover capabilities
curl https://your-deployment.vercel.app/api/capabilities

# 2. Register as an agent
curl -X POST /api/register \
  -H "Content-Type: application/json" \
  -d '{"name": "my-agent", "tier": "free"}'

# 3. Generate content (payment required in production)
curl -X POST /api/publish \
  -H "Content-Type: application/json" \
  -H "x-api-key: tp_your_api_key" \
  -d '{
    "capability": "content-generate",
    "purpose": "blog post for merchant site",
    "content": "Write about Bitcoin payments for small businesses",
    "options": { "format": "markdown", "tone": "professional" }
  }'
```

## Authentication

| Method | Header | For |
|--------|--------|-----|
| L402 Lightning | `Authorization: L402 <macaroon>:<preimage>` | External agents paying via Lightning |
| Cashu NUT-24 | `Authorization: Cashu <token>` | External agents paying via ecash |
| Service key | `x-service-key: te_svc_...` | TE ecosystem internal services (at-cost) |
| API key | `x-api-key: tp_...` | Registered agents with monthly budgets |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/capabilities` | Discover capabilities and pricing |
| `POST` | `/api/publish` | Execute a publishing capability |
| `POST` | `/api/register` | Register an agent, get API key |
| `GET` | `/api/usage` | Usage analytics (admin) |
| `POST` | `/api/ai-invoke/publish` | TE ecosystem AI-to-AI endpoint |

## Self-hosting

```bash
git clone https://github.com/Traviseric/teneo-publishing.git
cd teneo-publishing
cp .env.example .env
# Fill in your ANTHROPIC_API_KEY and other values
npm install
npm run dev
```

## Architecture

- **Pricing**: `lib/pricing.ts` — base costs x2 markup, actual cost tracked per call
- **Usage tracking**: `lib/usage-tracker.ts` — every call logged with purpose, patterns discoverable via `/api/usage?view=patterns`
- **Payments**: `lib/arxmint-client.ts` — verifies L402/Cashu proofs through ArxMint
- **LLM**: `lib/llm-client.ts` — Anthropic Claude API with token cost tracking
- **Images**: `lib/image-client.ts` — delegates to image-engine via AI-to-AI protocol
- **Storage**: Supabase (production) with file fallback (dev)

## License

MIT
