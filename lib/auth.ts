// ============================================================
// Teneo Publishing — Agent Auth
// Identifies agents, manages API keys, enforces rate limits.
// ============================================================

import { randomBytes } from "crypto";

/** In-memory agent registry — swap for DB in production */
const agents = new Map<string, {
  id: string;
  name: string;
  apiKey: string;
  tier: "free" | "standard" | "premium";
  monthlyCap: number;
  usedThisMonth: number;
  createdAt: Date;
}>();

const TIER_CAPS = {
  free: 1000,      // 1k sats/month
  standard: 50000, // 50k sats/month
  premium: 500000, // 500k sats/month
};

/** Register a new agent and get an API key */
export function registerAgent(name: string, tier: "free" | "standard" | "premium" = "free") {
  const id = `agent_${randomBytes(8).toString("hex")}`;
  const apiKey = `tp_${randomBytes(24).toString("hex")}`;
  const agent = {
    id,
    name,
    apiKey,
    tier,
    monthlyCap: TIER_CAPS[tier],
    usedThisMonth: 0,
    createdAt: new Date(),
  };
  agents.set(apiKey, agent);
  return { id, apiKey, tier, monthlyCap: agent.monthlyCap };
}

/** Identify an agent from request headers */
export function identifyAgent(headers: Headers): {
  agentId: string;
  agentName: string;
  tier: "free" | "standard" | "premium";
  canProceed: boolean;
  remainingBudget: number;
} | null {
  const apiKey = headers.get("x-api-key") || headers.get("x-agent-key");
  if (!apiKey) return null;

  const agent = agents.get(apiKey);
  if (!agent) return null;

  return {
    agentId: agent.id,
    agentName: agent.name,
    tier: agent.tier,
    canProceed: agent.usedThisMonth < agent.monthlyCap,
    remainingBudget: agent.monthlyCap - agent.usedThisMonth,
  };
}

/** Record usage against an agent's monthly budget */
export function recordSpend(apiKey: string, sats: number): boolean {
  const agent = agents.get(apiKey);
  if (!agent) return false;
  agent.usedThisMonth += sats;
  return true;
}

/** Anonymous agent fallback — for agents paying directly via L402/Cashu without registration */
export function anonymousAgent() {
  return {
    agentId: `anon_${Date.now().toString(36)}`,
    agentName: "anonymous",
    tier: "standard" as const,
    canProceed: true as const,
    remainingBudget: Infinity,
  };
}
