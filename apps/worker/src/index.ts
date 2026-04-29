/**
 * Quorum Worker — Hono-based request router.
 *
 * Routes:
 *   POST   /api/simulations                    create simulation
 *   POST   /api/simulations/:id/partition      apply partition
 *   POST   /api/simulations/:id/heal           heal partition
 *   POST   /api/simulations/:id/inject         inject command
 *   POST   /api/simulations/:id/stop-node      stop (crash) a node
 *   POST   /api/simulations/:id/restart-node   restart a node
 *   DELETE /api/simulations/:id                end simulation
 *   GET    /api/simulations/:id/observer/ws    WebSocket proxy to ObserverDO
 *
 *   ALL    /nodes/:nodeId/:algo/:rpc           proxy to algorithm DO
 *   POST   /observer/event                     proxy to ObserverDO (from nodes)
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, NodeConfig, Algorithm, CFRegion } from "./types";
import {
  CreateSimulationSchema,
  PartitionSchema,
  InjectSchema,
  SimIdSchema,
  AlgorithmSchema,
} from "./types";
import { insertSimulation, insertPartition, healPartitionRecord, markSimulationEnded } from "./db/queries";
import { applyPartition, healPartition, stopNode, restartNode } from "./partition";
import { RaftNodeDO } from "./algorithms/raft";
import { CrdtReplicaDO } from "./algorithms/crdt";
import { GossipNodeDO } from "./algorithms/gossip";
import { ObserverDO } from "./observer";
import { SimulationDO } from "./simulation";

export { RaftNodeDO, CrdtReplicaDO, GossipNodeDO, ObserverDO, SimulationDO };

type HonoEnv = { Bindings: Env };

const app = new Hono<HonoEnv>();

app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] }));

// ── Utility ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function workerBaseUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function getAlgorithmBinding(env: Env, algorithm: Algorithm) {
  switch (algorithm) {
    case "raft": return env.RAFT_NODE;
    case "crdt": return env.CRDT_REPLICA;
    case "gossip": return env.GOSSIP_NODE;
  }
}

function getNodeStub(
  env: Env,
  algorithm: Algorithm,
  nodeId: string,
  region?: CFRegion,
) {
  const ns = getAlgorithmBinding(env, algorithm);
  const id = ns.idFromName(nodeId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CF types allow locationHint
  return region ? ns.get(id, { locationHint: region } as any) : ns.get(id);
}

async function getSimulationRecord(env: Env, simId: string) {
  const ns = env.SIMULATION;
  const stub = ns.get(ns.idFromName(simId));
  const res = await stub.fetch("http://internal/state");
  if (!res.ok) return null;
  return res.json<{ simulationId: string; algorithm: Algorithm; nodes: NodeConfig[]; workerBaseUrl: string }>();
}

// ── POST /api/simulations — create ──────────────────────────────────────────

app.post("/api/simulations", async (c) => {
  const parsed = CreateSimulationSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { algorithm, nodeCount, regions } = parsed.data;
  const simId = uuid();
  const base = workerBaseUrl(c.req.raw);

  const nodeIds = Array.from({ length: nodeCount }, (_, i) => `${algorithm}-${simId.slice(0, 8)}-${i}`);
  const nodes: NodeConfig[] = nodeIds.map((nodeId, i) => ({
    nodeId,
    simulationId: simId,
    region: regions[i % regions.length] as CFRegion,
    peers: nodeIds,
    workerBaseUrl: base,
  }));

  // Persist simulation in D1
  await insertSimulation(c.env.DB, simId, algorithm, nodeCount, regions);

  // Initialise all algorithm nodes
  await Promise.all(
    nodes.map(async (cfg) => {
      const stub = getNodeStub(c.env, algorithm, cfg.nodeId, cfg.region);
      await stub.fetch("http://internal/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
    }),
  );

  // Initialise ObserverDO
  const observerStub = c.env.OBSERVER.get(c.env.OBSERVER.idFromName(simId));
  await observerStub.fetch("http://internal/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ simulationId: simId }),
  });

  // Initialise SimulationDO metadata store
  const simStub = c.env.SIMULATION.get(c.env.SIMULATION.idFromName(simId));
  await simStub.fetch("http://internal/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ simulationId: simId, algorithm, nodes, workerBaseUrl: base }),
  });

  // Store topology in KV for fast retrieval
  await c.env.TOPOLOGY.put(
    `sim:${simId}`,
    JSON.stringify({ simulationId: simId, algorithm, nodes }),
    { expirationTtl: 86400 },
  );

  // Notify observer of simulation start
  await observerStub.fetch("http://internal/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "simulation_started",
      simulationId: simId,
      algorithm,
      nodeCount,
      ts: Date.now(),
    }),
  });

  return c.json({
    simulationId: simId,
    algorithm,
    nodes,
    observerWsUrl: `${base}/api/simulations/${simId}/observer/ws`,
  });
});

// ── POST /api/simulations/:id/partition ─────────────────────────────────────

app.post("/api/simulations/:id/partition", async (c) => {
  const simId = c.req.param("id");
  const simIdParsed = SimIdSchema.safeParse(simId);
  if (!simIdParsed.success) return c.json({ error: "invalid simulationId" }, 400);

  const parsed = PartitionSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { isolatedNodeIds } = parsed.data;

  const topologyRaw = await c.env.TOPOLOGY.get(`sim:${simId}`);
  if (!topologyRaw) return c.json({ error: "simulation not found" }, 404);
  const topology = JSON.parse(topologyRaw) as { algorithm: Algorithm; nodes: NodeConfig[] };
  const allNodeIds = topology.nodes.map(n => n.nodeId);

  await applyPartition(c.env, topology.algorithm, allNodeIds, isolatedNodeIds);

  const partitionId = uuid();
  await insertPartition(c.env.DB, partitionId, simId, isolatedNodeIds);

  // Notify observer
  const observerStub = c.env.OBSERVER.get(c.env.OBSERVER.idFromName(simId));
  await observerStub.fetch("http://internal/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "partition_applied", isolatedNodes: isolatedNodeIds, ts: Date.now() }),
  });

  return c.json({ ok: true, partitionId, isolatedNodeIds });
});

// ── POST /api/simulations/:id/heal ──────────────────────────────────────────

app.post("/api/simulations/:id/heal", async (c) => {
  const simId = c.req.param("id");
  if (!SimIdSchema.safeParse(simId).success) return c.json({ error: "invalid simulationId" }, 400);

  const topologyRaw = await c.env.TOPOLOGY.get(`sim:${simId}`);
  if (!topologyRaw) return c.json({ error: "simulation not found" }, 404);
  const topology = JSON.parse(topologyRaw) as { algorithm: Algorithm; nodes: NodeConfig[] };

  await healPartition(c.env, topology.algorithm, topology.nodes.map(n => n.nodeId));
  await healPartitionRecord(c.env.DB, simId);

  const observerStub = c.env.OBSERVER.get(c.env.OBSERVER.idFromName(simId));
  await observerStub.fetch("http://internal/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "partition_healed", simulationId: simId, ts: Date.now() }),
  });

  return c.json({ ok: true });
});

// ── POST /api/simulations/:id/inject ────────────────────────────────────────

app.post("/api/simulations/:id/inject", async (c) => {
  const simId = c.req.param("id");
  if (!SimIdSchema.safeParse(simId).success) return c.json({ error: "invalid simulationId" }, 400);

  const parsed = InjectSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { nodeId, command, key, value } = parsed.data;

  const topologyRaw = await c.env.TOPOLOGY.get(`sim:${simId}`);
  if (!topologyRaw) return c.json({ error: "simulation not found" }, 404);
  const topology = JSON.parse(topologyRaw) as { algorithm: Algorithm };

  let path: string;
  let body: unknown;
  let method = "POST";

  switch (topology.algorithm) {
    case "raft":
      path = "/raft/client-command";
      body = { command };
      break;
    case "crdt":
      path = "/crdt/set";
      body = { key: key ?? command, value: value ?? command };
      method = "PUT";
      break;
    case "gossip":
      path = "/gossip/inject";
      body = { key: key ?? command, value: value ?? command };
      break;
  }

  const bodyStr = JSON.stringify(body);

  async function callNode(targetId: string): Promise<Response> {
    const stub = getNodeStub(c.env, topology.algorithm, targetId);
    return stub.fetch(`http://internal${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: bodyStr,
    });
  }

  let res = await callNode(nodeId);

  // Raft: 307 means we hit a follower — retry on the known leader or scan all nodes
  if (res.status === 307) {
    const redirect = await res.json() as { leaderId?: string | null };
    const leaderId = redirect.leaderId;
    if (leaderId) {
      res = await callNode(leaderId);
    } else {
      // No known leader yet (election in progress) — try remaining nodes
      const allNodes = (JSON.parse(
        (await c.env.TOPOLOGY.get(`sim:${simId}`)) ?? "{}",
      ) as { nodes?: NodeConfig[] }).nodes ?? [];

      for (const n of allNodes) {
        if (n.nodeId === nodeId) continue;
        const attempt = await callNode(n.nodeId);
        if (attempt.status !== 307) { res = attempt; break; }
        attempt.body?.cancel().catch(() => void 0);
      }
      // If still 307 after scanning, fall through with the last 307 response
    }
  }

  const result = await res.json().catch(() => ({ error: "empty response" }));
  return c.json(result, res.ok ? 200 : (res.status as 200));
});

// ── POST /api/simulations/:id/stop-node ────────────────────────────────────

app.post("/api/simulations/:id/stop-node", async (c) => {
  const simId = c.req.param("id");
  if (!SimIdSchema.safeParse(simId).success) return c.json({ error: "invalid simulationId" }, 400);

  const { nodeId } = await c.req.json() as { nodeId: string };
  const topologyRaw = await c.env.TOPOLOGY.get(`sim:${simId}`);
  if (!topologyRaw) return c.json({ error: "simulation not found" }, 404);
  const topology = JSON.parse(topologyRaw) as { algorithm: Algorithm };

  await stopNode(c.env, topology.algorithm, nodeId);
  return c.json({ ok: true });
});

// ── POST /api/simulations/:id/restart-node ──────────────────────────────────

app.post("/api/simulations/:id/restart-node", async (c) => {
  const simId = c.req.param("id");
  if (!SimIdSchema.safeParse(simId).success) return c.json({ error: "invalid simulationId" }, 400);

  const { nodeId } = await c.req.json() as { nodeId: string };
  const topologyRaw = await c.env.TOPOLOGY.get(`sim:${simId}`);
  if (!topologyRaw) return c.json({ error: "simulation not found" }, 404);
  const topology = JSON.parse(topologyRaw) as { algorithm: Algorithm; nodes: NodeConfig[] };

  const cfg = topology.nodes.find(n => n.nodeId === nodeId);
  if (!cfg) return c.json({ error: "node not found" }, 404);

  await restartNode(c.env, topology.algorithm, nodeId, cfg);
  return c.json({ ok: true });
});

// ── DELETE /api/simulations/:id ──────────────────────────────────────────────

app.delete("/api/simulations/:id", async (c) => {
  const simId = c.req.param("id");
  if (!SimIdSchema.safeParse(simId).success) return c.json({ error: "invalid simulationId" }, 400);

  await markSimulationEnded(c.env.DB, simId);
  await c.env.TOPOLOGY.delete(`sim:${simId}`);
  return c.json({ ok: true });
});

// ── GET /api/simulations/:id/observer/ws — WebSocket proxy ──────────────────

app.get("/api/simulations/:id/observer/ws", async (c) => {
  const simId = c.req.param("id");
  if (!SimIdSchema.safeParse(simId).success) return c.json({ error: "invalid simulationId" }, 400);

  const observerStub = c.env.OBSERVER.get(c.env.OBSERVER.idFromName(simId));

  // Proxy the WebSocket upgrade directly to the DO
  return observerStub.fetch(
    new Request("http://internal/ws", {
      headers: c.req.raw.headers,
    }),
  );
});

// ── /nodes/:nodeId/:algo/:rpc — proxy to algorithm DO ───────────────────────

app.all("/nodes/:nodeId/:algo/:rpc", async (c) => {
  const { nodeId, algo, rpc } = c.req.param();
  const algoParsed = AlgorithmSchema.safeParse(algo);
  if (!algoParsed.success) return c.json({ error: "unknown algorithm" }, 400);

  const stub = getNodeStub(c.env, algoParsed.data, nodeId);
  return stub.fetch(
    new Request(`http://internal/${algo}/${rpc}`, {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: c.req.raw.body,
    }),
  );
});

// ── POST /observer/event — from algorithm nodes ──────────────────────────────

app.post("/observer/event", async (c) => {
  // Extract simulationId from event payload to route to correct ObserverDO
  const body = await c.req.json() as { simulationId?: string; [k: string]: unknown };

  // Nodes include simulationId in their NodeConfig; event payload may not have it directly.
  // Fall back to a header the worker can set when proxying.
  const simId =
    (body.simulationId as string | undefined) ??
    c.req.header("X-Simulation-Id");

  if (!simId) return new Response("missing simulationId", { status: 400 });

  const observerStub = c.env.OBSERVER.get(c.env.OBSERVER.idFromName(simId));
  return observerStub.fetch("http://internal/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
});

// ── Health ───────────────────────────────────────────────────────────────────

app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

export default app;
