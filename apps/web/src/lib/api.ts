// Re-export types mirroring worker types (keep in sync with apps/worker/src/types.ts)

export type Algorithm = "raft" | "crdt" | "gossip";
export type CFRegion = "wnam" | "enam" | "weur" | "eeur" | "apac" | "sam" | "afr" | "me";
export type RaftRole = "follower" | "candidate" | "leader";

export interface NodeConfig {
  nodeId: string;
  simulationId: string;
  region: CFRegion;
  peers: string[];
  workerBaseUrl: string;
}

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

export interface LWWRegister {
  key: string;
  value: unknown;
  timestamp: number;
  nodeId: string;
}

export interface CrdtState {
  nodeId: string;
  registers: Record<string, LWWRegister>;
  vectorClock: Record<string, number>;
}

export interface GossipState {
  nodeId: string;
  localData: Record<string, { value: string; version: number }>;
  infectionCount: number;
  peers: string[];
}

export type ObserverEvent =
  | { type: "node_state_update"; nodeId: string; algorithm: Algorithm; state: RaftState | CrdtState | GossipState; ts: number }
  | { type: "message_sent"; from: string; to: string; msgType: string; term?: number; latencyMs?: number; ts: number }
  | { type: "message_dropped"; from: string; to: string; reason: "partitioned" | "timeout"; ts: number }
  | { type: "leader_elected"; leaderId: string; term: number; simulationId: string; ts: number }
  | { type: "partition_applied"; isolatedNodes: string[]; ts: number }
  | { type: "partition_healed"; simulationId: string; ts: number }
  | { type: "simulation_started"; simulationId: string; algorithm: Algorithm; nodeCount: number; ts: number };

export interface CreateSimulationResponse {
  simulationId: string;
  algorithm: Algorithm;
  nodes: NodeConfig[];
  observerWsUrl: string;
}

const BASE = "/api";

export const api = {
  async createSimulation(params: {
    algorithm: Algorithm;
    nodeCount: number;
    regions: CFRegion[];
  }): Promise<CreateSimulationResponse> {
    const res = await fetch(`${BASE}/simulations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Failed to create simulation: ${res.status}`);
    return res.json() as Promise<CreateSimulationResponse>;
  },

  async applyPartition(simId: string, isolatedNodeIds: string[]): Promise<void> {
    const res = await fetch(`${BASE}/simulations/${simId}/partition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isolatedNodeIds }),
    });
    if (!res.ok) throw new Error(`Partition failed: ${res.status}`);
  },

  async healPartition(simId: string): Promise<void> {
    const res = await fetch(`${BASE}/simulations/${simId}/heal`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`Heal failed: ${res.status}`);
  },

  async inject(simId: string, nodeId: string, command: string, key?: string, value?: string): Promise<void> {
    const res = await fetch(`${BASE}/simulations/${simId}/inject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId, command, key, value }),
    });
    if (!res.ok) throw new Error(`Inject failed: ${res.status}`);
  },

  async stopNode(simId: string, nodeId: string): Promise<void> {
    const res = await fetch(`${BASE}/simulations/${simId}/stop-node`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId }),
    });
    if (!res.ok) throw new Error(`Stop failed: ${res.status}`);
  },

  async restartNode(simId: string, nodeId: string): Promise<void> {
    const res = await fetch(`${BASE}/simulations/${simId}/restart-node`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId }),
    });
    if (!res.ok) throw new Error(`Restart failed: ${res.status}`);
  },

  async endSimulation(simId: string): Promise<void> {
    await fetch(`${BASE}/simulations/${simId}`, { method: "DELETE" });
  },

  observerWsUrl(simId: string): string {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/api/simulations/${simId}/observer/ws`;
  },
};
