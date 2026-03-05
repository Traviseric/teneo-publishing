// ============================================================
// Teneo Publishing — LLM Client
// Wraps Anthropic API for content generation/transformation.
// Tracks token usage for accurate cost-based pricing.
// ============================================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export interface LLMResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** Token pricing (USD) — Claude Sonnet 4 */
const TOKEN_COSTS = {
  "claude-sonnet-4-20250514": { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
  "claude-haiku-4-5-20251001": { input: 0.80 / 1_000_000, output: 4.0 / 1_000_000 },
};

/** USD to sats (rough conversion — update periodically) */
const USD_TO_SATS = Number(process.env.USD_TO_SATS_RATE) || 1100; // ~$90k/BTC

/** Convert USD cost to sats */
export function usdToSats(usd: number): number {
  return Math.max(1, Math.ceil(usd * USD_TO_SATS));
}

/** Call Anthropic API */
export async function callLLM(params: {
  system?: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}): Promise<LLMResponse> {
  const model = params.model || DEFAULT_MODEL;

  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: params.maxTokens || 2048,
    messages: [{ role: "user", content: params.prompt }],
  };
  if (params.system) {
    body.system = params.system;
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const inputTokens = data.usage?.input_tokens || 0;
  const outputTokens = data.usage?.output_tokens || 0;
  const costs = TOKEN_COSTS[model as keyof typeof TOKEN_COSTS] || TOKEN_COSTS[DEFAULT_MODEL as keyof typeof TOKEN_COSTS];
  const costUsd = (inputTokens * costs.input) + (outputTokens * costs.output);

  const textContent = data.content?.find((c: { type: string }) => c.type === "text");

  return {
    content: textContent?.text || "",
    model,
    inputTokens,
    outputTokens,
    costUsd,
  };
}

/** Estimate cost in sats before making the call */
export function estimateCostSats(promptLength: number, expectedOutputTokens: number = 1000): number {
  const estimatedInputTokens = Math.ceil(promptLength / 4);
  const costs = TOKEN_COSTS[DEFAULT_MODEL as keyof typeof TOKEN_COSTS];
  const costUsd = (estimatedInputTokens * costs.input) + (expectedOutputTokens * costs.output);
  return usdToSats(costUsd);
}
