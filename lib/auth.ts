// ============================================================
// Teneo Publishing — Agent Auth
// Identifies agents, manages API keys, enforces rate limits.
// Backed by Supabase (production) or file (dev).
// ============================================================

import { randomBytes } from "crypto";
import { insertAgent, findAgentByKey, updateAgentSpend } from "./db";

const TIER_CAPS = {
  free: 1000,      // 1k sats/month
  standard: 50000, // 50k sats/month
  premium: 500000, // 500k sats/month
};

/** Register a new agent and get an API key */
export async function registerAgent(name: string, tier: "free" | "standard" | "premium" = "free") {
  const id = `agent_${randomBytes(8).toString("hex")}`;
  const apiKey = `tp_${randomBytes(24).toString("hex")}`;

  await insertAgent({
    id,
    name,
    api_key: apiKey,
    tier,
    monthly_cap: TIER_CAPS[tier],
    used_this_month: 0,
    created_at: new Date().toISOString(),
  });

  return { id, apiKey, tier, monthlyCap: TIER_CAPS[tier] };
}

/** Identify an agent from request headers */
export async function identifyAgent(headers: Headers): Promise<{
  agentId: string;
  agentName: string;
  apiKey: string;
  tier: "free" | "standard" | "premium";
  canProceed: boolean;
  remainingBudget: number;
} | null> {
  const apiKey = headers.get("x-api-key") || headers.get("x-agent-key");
  if (!apiKey) return null;

  const agent = await findAgentByKey(apiKey);
  if (!agent) return null;

  return {
    agentId: agent.id,
    agentName: agent.name,
    apiKey: agent.api_key,
    tier: agent.tier,
    canProceed: agent.used_this_month < agent.monthly_cap,
    remainingBudget: agent.monthly_cap - agent.used_this_month,
  };
}

/** Record usage against an agent's monthly budget */
export async function recordSpend(apiKey: string, sats: number): Promise<void> {
  await updateAgentSpend(apiKey, sats);
}

/** Anonymous agent fallback — for agents paying directly via L402/Cashu without registration */
export function anonymousAgent() {
  return {
    agentId: `anon_${Date.now().toString(36)}`,
    agentName: "anonymous",
    apiKey: "",
    tier: "standard" as const,
    canProceed: true as const,
    remainingBudget: Infinity,
  };
}
