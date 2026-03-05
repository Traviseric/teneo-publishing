// ============================================================
// Teneo Publishing — Usage Analytics API
// GET /api/usage — discover what agents are using content for
// This is the business intelligence endpoint.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getUsageLog, discoverPatterns, getRevenueSummary } from "@/lib/usage-tracker";

export async function GET(request: NextRequest) {
  // Admin auth — service key or env-based admin key
  const authKey = request.headers.get("x-admin-key") || request.headers.get("x-service-key");
  const adminKey = process.env.ADMIN_KEY || process.env.TENEO_SERVICE_KEYS?.split(",")[0];

  if (adminKey && authKey !== adminKey) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "summary";

  switch (view) {
    case "patterns": {
      // The gold mine — what are agents actually using this for?
      const patterns = discoverPatterns();
      return NextResponse.json({
        view: "patterns",
        description: "Agent usage patterns — sorted by frequency. Growing patterns = new product opportunities.",
        patterns,
        totalPatterns: patterns.length,
        growingPatterns: patterns.filter(p => p.trend === "growing").length,
        timestamp: Date.now(),
      });
    }

    case "revenue": {
      const since = searchParams.get("since")
        ? new Date(searchParams.get("since")!)
        : undefined;
      const revenue = getRevenueSummary(since);
      return NextResponse.json({
        view: "revenue",
        ...revenue,
        marginPercent: revenue.totalRevenue > 0
          ? Math.round((revenue.totalProfit / revenue.totalRevenue) * 100)
          : 0,
        timestamp: Date.now(),
      });
    }

    case "log": {
      const limit = Number(searchParams.get("limit")) || 50;
      const agentId = searchParams.get("agentId") || undefined;
      const capability = searchParams.get("capability") || undefined;
      const log = getUsageLog({ limit, agentId, capability });
      return NextResponse.json({
        view: "log",
        count: log.length,
        records: log,
        timestamp: Date.now(),
      });
    }

    default: {
      // Summary view — high-level dashboard data
      const revenue = getRevenueSummary();
      const patterns = discoverPatterns();
      return NextResponse.json({
        view: "summary",
        revenue: {
          totalSats: revenue.totalRevenue,
          profitSats: revenue.totalProfit,
          requests: revenue.requestCount,
          uniqueAgents: revenue.uniqueAgents,
        },
        topPatterns: patterns.slice(0, 5),
        growingUseCases: patterns.filter(p => p.trend === "growing").slice(0, 3),
        hint: "Use ?view=patterns for full pattern analysis, ?view=revenue for financials, ?view=log for raw records",
        timestamp: Date.now(),
      });
    }
  }
}
