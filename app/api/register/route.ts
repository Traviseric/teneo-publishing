// ============================================================
// Teneo Publishing — Agent Registration
// POST /api/register — register a new agent and get an API key
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { registerAgent } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name as string;
  if (!name || typeof name !== "string" || name.length < 2) {
    return NextResponse.json({ error: "name is required (min 2 chars)" }, { status: 400 });
  }

  const tier = (body.tier as "free" | "standard" | "premium") || "free";
  if (!["free", "standard", "premium"].includes(tier)) {
    return NextResponse.json({ error: "tier must be free, standard, or premium" }, { status: 400 });
  }

  const agent = await registerAgent(name, tier);

  return NextResponse.json({
    success: true,
    agent: {
      id: agent.id,
      apiKey: agent.apiKey,
      tier: agent.tier,
      monthlyCap: agent.monthlyCap,
    },
    usage: {
      header: "x-api-key",
      value: agent.apiKey,
      example: `curl -H "x-api-key: ${agent.apiKey}" -X POST /api/publish ...`,
    },
    note: "Store your API key securely. It cannot be recovered.",
  });
}
