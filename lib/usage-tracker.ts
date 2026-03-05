// ============================================================
// Teneo Publishing — Usage Tracker
// Track what agents use, what they use it for, discover patterns.
// Backed by Supabase (production) or file (dev).
// ============================================================

import type { AgentUsageRecord, PublishingCapability, UsagePattern } from "./types";
import { randomBytes } from "crypto";
import { insertUsage, queryUsage, getAllUsage } from "./db";

/** Log an agent's API usage */
export function trackUsage(params: {
  agentId: string;
  agentName?: string;
  capability: PublishingCapability;
  purpose: string;
  costSats: number;
  priceSats: number;
  paymentMethod: AgentUsageRecord["paymentMethod"];
  metadata?: Record<string, unknown>;
}): AgentUsageRecord {
  const record: AgentUsageRecord = {
    id: randomBytes(16).toString("hex"),
    agentId: params.agentId,
    agentName: params.agentName,
    capability: params.capability,
    purpose: params.purpose,
    costSats: params.costSats,
    priceSats: params.priceSats,
    profitSats: params.priceSats - params.costSats,
    paymentMethod: params.paymentMethod,
    metadata: params.metadata ?? {},
    createdAt: new Date(),
  };

  // Fire and forget — don't block the response
  void insertUsage(record).catch(() => {});
  return record;
}

/** Get usage records with filters */
export async function getUsageLog(filters?: {
  agentId?: string;
  capability?: string;
  since?: Date;
  limit?: number;
}): Promise<AgentUsageRecord[]> {
  return queryUsage(filters);
}

/** Discover usage patterns — what are agents using this for? */
export async function discoverPatterns(): Promise<UsagePattern[]> {
  const usageLog = await getAllUsage();
  const purposeMap = new Map<string, {
    count: number;
    totalSats: number;
    agents: Set<string>;
    firstSeen: Date;
    lastSeen: Date;
    recentCount: number;
    olderCount: number;
  }>();

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  for (const record of usageLog) {
    const key = record.purpose.toLowerCase().trim();
    const existing = purposeMap.get(key);
    if (existing) {
      existing.count++;
      existing.totalSats += record.priceSats;
      existing.agents.add(record.agentId);
      if (record.createdAt < existing.firstSeen) existing.firstSeen = record.createdAt;
      if (record.createdAt > existing.lastSeen) existing.lastSeen = record.createdAt;
      if (record.createdAt.getTime() > dayAgo) existing.recentCount++;
      else existing.olderCount++;
    } else {
      purposeMap.set(key, {
        count: 1,
        totalSats: record.priceSats,
        agents: new Set([record.agentId]),
        firstSeen: record.createdAt,
        lastSeen: record.createdAt,
        recentCount: record.createdAt.getTime() > dayAgo ? 1 : 0,
        olderCount: record.createdAt.getTime() <= dayAgo ? 1 : 0,
      });
    }
  }

  return Array.from(purposeMap.entries())
    .map(([purpose, data]) => ({
      purpose,
      count: data.count,
      totalSats: data.totalSats,
      avgCostSats: Math.round(data.totalSats / data.count),
      uniqueAgents: data.agents.size,
      firstSeen: data.firstSeen,
      lastSeen: data.lastSeen,
      trend: data.recentCount > data.olderCount ? "growing" as const
        : data.recentCount < data.olderCount ? "declining" as const
        : "stable" as const,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Revenue summary */
export async function getRevenueSummary(since?: Date) {
  const usageLog = await getAllUsage();
  const records = since ? usageLog.filter(r => r.createdAt >= since) : usageLog;

  const agents = new Set<string>();
  const byCapability: Record<string, { revenue: number; cost: number; count: number }> = {};
  let totalRevenue = 0;
  let totalCost = 0;

  for (const r of records) {
    totalRevenue += r.priceSats;
    totalCost += r.costSats;
    agents.add(r.agentId);
    if (!byCapability[r.capability]) byCapability[r.capability] = { revenue: 0, cost: 0, count: 0 };
    byCapability[r.capability].revenue += r.priceSats;
    byCapability[r.capability].cost += r.costSats;
    byCapability[r.capability].count++;
  }

  return {
    totalRevenue,
    totalCost,
    totalProfit: totalRevenue - totalCost,
    requestCount: records.length,
    uniqueAgents: agents.size,
    byCapability,
  };
}
