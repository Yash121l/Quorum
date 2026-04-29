/**
 * Partition manager — applies and heals network partitions across all nodes.
 *
 * Each node stores its own partition_state table listing which peers it cannot reach.
 * Both sides of a partition are cut (symmetric partition).
 */

import type { Env } from "./types";

const NODE_RPC_TIMEOUT_MS = 2000;

type AlgorithmBinding = "RAFT_NODE" | "CRDT_REPLICA" | "GOSSIP_NODE";

function bindingForAlgorithm(algorithm: string): AlgorithmBinding {
  switch (algorithm) {
    case "raft": return "RAFT_NODE";
    case "crdt": return "CRDT_REPLICA";
    case "gossip": return "GOSSIP_NODE";
    default: throw new Error(`Unknown algorithm: ${algorithm}`);
  }
}

async function callNode(
  env: Env,
  binding: AlgorithmBinding,
  nodeId: string,
  path: string,
  body: unknown,
): Promise<void> {
  const ns = env[binding];
  const stub = ns.get(ns.idFromName(nodeId));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NODE_RPC_TIMEOUT_MS);
  try {
    await stub.fetch(`http://internal${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function applyPartition(
  env: Env,
  algorithm: string,
  allNodeIds: string[],
  isolatedNodeIds: string[],
): Promise<void> {
  const binding = bindingForAlgorithm(algorithm);
  const isolatedSet = new Set(isolatedNodeIds);
  const nonIsolated = allNodeIds.filter(id => !isolatedSet.has(id));

  await Promise.allSettled([
    // Isolated nodes cannot reach non-isolated nodes
    ...isolatedNodeIds.map(nodeId =>
      callNode(env, binding, nodeId, "/partition/set", { peers: nonIsolated }),
    ),
    // Non-isolated nodes cannot reach isolated nodes
    ...nonIsolated.map(nodeId =>
      callNode(env, binding, nodeId, "/partition/set", { peers: isolatedNodeIds }),
    ),
  ]);
}

export async function healPartition(
  env: Env,
  algorithm: string,
  allNodeIds: string[],
): Promise<void> {
  const binding = bindingForAlgorithm(algorithm);

  await Promise.allSettled(
    allNodeIds.map(nodeId =>
      callNode(env, binding, nodeId, "/partition/clear", {}),
    ),
  );
}

export async function stopNode(
  env: Env,
  algorithm: string,
  nodeId: string,
): Promise<void> {
  const binding = bindingForAlgorithm(algorithm);
  await callNode(env, binding, nodeId, "/stop", {});
}

export async function restartNode(
  env: Env,
  algorithm: string,
  nodeId: string,
  config: unknown,
): Promise<void> {
  const binding = bindingForAlgorithm(algorithm);
  await callNode(env, binding, nodeId, "/restart", config);
}
