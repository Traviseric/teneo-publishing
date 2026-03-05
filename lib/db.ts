// ============================================================
// Teneo Publishing — Database Layer
// Supabase for production, file fallback for dev.
// Tables: tp_usage_log, tp_agents
// ============================================================

import { getSupabase } from "./supabase";
import type { AgentUsageRecord } from "./types";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), ".data");
const USAGE_FILE = join(DATA_DIR, "usage-log.json");
const AGENTS_FILE = join(DATA_DIR, "agents.json");

// ── Usage Log ──

export async function insertUsage(record: AgentUsageRecord): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    await sb.from("tp_usage_log").insert({
      id: record.id,
      agent_id: record.agentId,
      agent_name: record.agentName || null,
      capability: record.capability,
      purpose: record.purpose,
      cost_sats: record.costSats,
      price_sats: record.priceSats,
      profit_sats: record.profitSats,
      payment_method: record.paymentMethod,
      metadata: record.metadata,
      created_at: record.createdAt.toISOString(),
    });
    return;
  }
  // File fallback
  const log = loadFile<AgentUsageRecord[]>(USAGE_FILE, []);
  log.push(record);
  saveFile(USAGE_FILE, log);
}

export async function queryUsage(filters?: {
  agentId?: string;
  capability?: string;
  since?: Date;
  limit?: number;
}): Promise<AgentUsageRecord[]> {
  const sb = getSupabase();
  if (sb) {
    let query = sb.from("tp_usage_log").select("*").order("created_at", { ascending: false });
    if (filters?.agentId) query = query.eq("agent_id", filters.agentId);
    if (filters?.capability) query = query.eq("capability", filters.capability);
    if (filters?.since) query = query.gte("created_at", filters.since.toISOString());
    if (filters?.limit) query = query.limit(filters.limit);

    const { data } = await query;
    return (data || []).map(mapUsageRow);
  }
  // File fallback
  let records = loadFile<AgentUsageRecord[]>(USAGE_FILE, []).map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  if (filters?.agentId) records = records.filter(r => r.agentId === filters.agentId);
  if (filters?.capability) records = records.filter(r => r.capability === filters.capability);
  if (filters?.since) records = records.filter(r => r.createdAt >= filters.since!);
  records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (filters?.limit) records = records.slice(0, filters.limit);
  return records;
}

export async function getAllUsage(): Promise<AgentUsageRecord[]> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from("tp_usage_log").select("*").order("created_at", { ascending: false });
    return (data || []).map(mapUsageRow);
  }
  return loadFile<AgentUsageRecord[]>(USAGE_FILE, []).map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
}

function mapUsageRow(row: Record<string, unknown>): AgentUsageRecord {
  return {
    id: row.id as string,
    agentId: row.agent_id as string,
    agentName: row.agent_name as string | undefined,
    capability: row.capability as string,
    purpose: row.purpose as string,
    costSats: row.cost_sats as number,
    priceSats: row.price_sats as number,
    profitSats: row.profit_sats as number,
    paymentMethod: row.payment_method as AgentUsageRecord["paymentMethod"],
    metadata: (row.metadata || {}) as Record<string, unknown>,
    createdAt: new Date(row.created_at as string),
  };
}

// ── Agent Registry ──

export interface StoredAgent {
  id: string;
  name: string;
  api_key: string;
  tier: "free" | "standard" | "premium";
  monthly_cap: number;
  used_this_month: number;
  created_at: string;
}

export async function insertAgent(agent: StoredAgent): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    await sb.from("tp_agents").insert(agent);
    return;
  }
  const agents = loadFile<StoredAgent[]>(AGENTS_FILE, []);
  agents.push(agent);
  saveFile(AGENTS_FILE, agents);
}

export async function findAgentByKey(apiKey: string): Promise<StoredAgent | null> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from("tp_agents").select("*").eq("api_key", apiKey).single();
    return data as StoredAgent | null;
  }
  const agents = loadFile<StoredAgent[]>(AGENTS_FILE, []);
  return agents.find(a => a.api_key === apiKey) || null;
}

export async function updateAgentSpend(apiKey: string, addSats: number): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from("tp_agents").select("used_this_month").eq("api_key", apiKey).single();
    if (data) {
      await sb.from("tp_agents").update({ used_this_month: (data.used_this_month || 0) + addSats }).eq("api_key", apiKey);
    }
    return;
  }
  const agents = loadFile<StoredAgent[]>(AGENTS_FILE, []);
  const agent = agents.find(a => a.api_key === apiKey);
  if (agent) {
    agent.used_this_month += addSats;
    saveFile(AGENTS_FILE, agents);
  }
}

// ── File helpers ──

function loadFile<T>(path: string, fallback: T): T {
  try {
    if (existsSync(path)) return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch { /* corrupted */ }
  return fallback;
}

function saveFile(path: string, data: unknown): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(path, JSON.stringify(data, null, 2));
  } catch { /* write failed */ }
}
