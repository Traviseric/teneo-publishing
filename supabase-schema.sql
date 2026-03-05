-- Teneo Publishing — Supabase Schema
-- Run this in your Supabase SQL editor to create the tables.

-- Usage log — every agent API call tracked
CREATE TABLE IF NOT EXISTS tp_usage_log (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  agent_name TEXT,
  capability TEXT NOT NULL,
  purpose TEXT NOT NULL,
  cost_sats INTEGER NOT NULL DEFAULT 0,
  price_sats INTEGER NOT NULL DEFAULT 0,
  profit_sats INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'free-tier',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tp_usage_agent ON tp_usage_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_tp_usage_capability ON tp_usage_log(capability);
CREATE INDEX IF NOT EXISTS idx_tp_usage_created ON tp_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tp_usage_purpose ON tp_usage_log(purpose);

-- Agent registry — registered agents with API keys
CREATE TABLE IF NOT EXISTS tp_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'standard', 'premium')),
  monthly_cap INTEGER NOT NULL DEFAULT 1000,
  used_this_month INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_agents_api_key ON tp_agents(api_key);

-- Enable Row Level Security (service role key bypasses RLS)
ALTER TABLE tp_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tp_agents ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "service_role_all_usage" ON tp_usage_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_agents" ON tp_agents
  FOR ALL USING (auth.role() = 'service_role');
