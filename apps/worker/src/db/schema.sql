-- D1 schema for Quorum simulation records

CREATE TABLE IF NOT EXISTS simulations (
  id TEXT PRIMARY KEY,
  algorithm TEXT NOT NULL CHECK (algorithm IN ('raft', 'crdt', 'gossip')),
  node_count INTEGER NOT NULL,
  regions TEXT NOT NULL,         -- JSON array of CF regions
  created_at INTEGER NOT NULL,
  ended_at INTEGER,
  status TEXT NOT NULL DEFAULT 'running'
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  simulation_id TEXT NOT NULL REFERENCES simulations(id),
  node_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,         -- JSON
  from_node TEXT,
  to_node TEXT,
  latency_ms INTEGER,
  timestamp_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_sim_time ON events (simulation_id, timestamp_ms);

CREATE TABLE IF NOT EXISTS partitions (
  id TEXT PRIMARY KEY,
  simulation_id TEXT NOT NULL REFERENCES simulations(id),
  isolated_nodes TEXT NOT NULL,  -- JSON array of node IDs
  created_at INTEGER NOT NULL,
  healed_at INTEGER
);
