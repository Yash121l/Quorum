import { z } from "zod";

export type Algorithm = "raft" | "crdt" | "gossip";

export type CFRegion =
  | "wnam" | "enam" | "weur" | "eeur" | "apac" | "sam" | "afr" | "me";

export interface NodeConfig {
  nodeId: string;
  simulationId: string;
  region: CFRegion;
  peers: string[];
  workerBaseUrl: string;
}

// ── Raft ──────────────────────────────────────────────────────────────────────

export type RaftRole = "follower" | "candidate" | "leader";

export interface RaftLogEntry {
  index: number;
  term: number;
  command: string;
}

export interface RaftState {
  nodeId: string;
  role: RaftRole;
  currentTerm: number;
  votedFor: string | null;
  log: RaftLogEntry[];
  commitIndex: number;
  lastApplied: number;
  leaderId: string | null;
  votesReceived: string[];
}

export interface RequestVoteArgs {
  term: number;
  candidateId: string;
  lastLogIndex: number;
  lastLogTerm: number;
}

export interface RequestVoteReply {
  term: number;
  voteGranted: boolean;
}

export interface AppendEntriesArgs {
  term: number;
  leaderId: string;
  prevLogIndex: number;
  prevLogTerm: number;
  entries: RaftLogEntry[];
  leaderCommit: number;
}

export interface AppendEntriesReply {
  term: number;
  success: boolean;
  conflictIndex?: number;
  conflictTerm?: number;
}

// ── CRDT ──────────────────────────────────────────────────────────────────────

export interface LWWRegister<T = unknown> {
  key: string;
  value: T;
  timestamp: number;
  nodeId: string;
}

export interface CrdtState {
  nodeId: string;
  registers: Record<string, LWWRegister>;
  vectorClock: Record<string, number>;
}

// ── Gossip ────────────────────────────────────────────────────────────────────

export interface GossipRumor {
  key: string;
  value: string;
  version: number;
  origin: string;
}

export interface GossipState {
  nodeId: string;
  localData: Record<string, { value: string; version: number }>;
  infectionCount: number;
  peers: string[];
}

// ── Observer events ───────────────────────────────────────────────────────────

export type ObserverEvent =
  | { type: "node_state_update"; nodeId: string; algorithm: Algorithm; state: RaftState | CrdtState | GossipState; ts: number }
  | { type: "message_sent"; from: string; to: string; msgType: string; term?: number; latencyMs?: number; ts: number }
  | { type: "message_dropped"; from: string; to: string; reason: "partitioned" | "timeout"; ts: number }
  | { type: "leader_elected"; leaderId: string; term: number; simulationId: string; ts: number }
  | { type: "partition_applied"; isolatedNodes: string[]; ts: number }
  | { type: "partition_healed"; simulationId: string; ts: number }
  | { type: "simulation_started"; simulationId: string; algorithm: Algorithm; nodeCount: number; ts: number };

export function isObserverEvent(v: unknown): v is ObserverEvent {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return typeof obj["type"] === "string" && typeof obj["ts"] === "number";
}

// ── Env binding types ─────────────────────────────────────────────────────────

export interface Env {
  RAFT_NODE: DurableObjectNamespace;
  CRDT_REPLICA: DurableObjectNamespace;
  GOSSIP_NODE: DurableObjectNamespace;
  SIMULATION: DurableObjectNamespace;
  OBSERVER: DurableObjectNamespace;
  DB: D1Database;
  TOPOLOGY: KVNamespace;
}

// ── Zod validation schemas ────────────────────────────────────────────────────

export const CFRegionSchema = z.enum(["wnam", "enam", "weur", "eeur", "apac", "sam", "afr", "me"]);
export const AlgorithmSchema = z.enum(["raft", "crdt", "gossip"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NODE_ID_RE = /^[a-z0-9-]{1,64}$/;

export const CreateSimulationSchema = z.object({
  algorithm: AlgorithmSchema,
  nodeCount: z.number().int().min(3).max(7).refine(n => n % 2 === 1, "nodeCount must be odd"),
  regions: z.array(CFRegionSchema).min(1).max(8),
});

export const PartitionSchema = z.object({
  isolatedNodeIds: z.array(z.string().regex(NODE_ID_RE)).min(1),
});

export const InjectSchema = z.object({
  nodeId: z.string().regex(NODE_ID_RE),
  command: z.string().min(1).max(1024),
  key: z.string().optional(),
  value: z.string().optional(),
});

export const SimIdSchema = z.string().regex(UUID_RE, "invalid simulationId");
