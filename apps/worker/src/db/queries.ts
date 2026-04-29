import type { Env, ObserverEvent, Algorithm } from "../types";

export async function insertSimulation(
  db: Env["DB"],
  id: string,
  algorithm: Algorithm,
  nodeCount: number,
  regions: string[],
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO simulations (id, algorithm, node_count, regions, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id, algorithm, nodeCount, JSON.stringify(regions), Date.now())
    .run();
}

export async function markSimulationEnded(db: Env["DB"], id: string): Promise<void> {
  await db
    .prepare("UPDATE simulations SET ended_at = ?, status = 'ended' WHERE id = ?")
    .bind(Date.now(), id)
    .run();
}

export async function insertEvent(
  db: Env["DB"],
  simulationId: string,
  nodeId: string,
  event: ObserverEvent,
): Promise<void> {
  const from = "from" in event ? event.from : null;
  const to = "to" in event ? event.to : null;
  const latency = "latencyMs" in event ? (event.latencyMs ?? null) : null;

  await db
    .prepare(
      `INSERT INTO events
         (simulation_id, node_id, event_type, payload, from_node, to_node, latency_ms, timestamp_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(simulationId, nodeId, event.type, JSON.stringify(event), from, to, latency, event.ts)
    .run();
}

export async function insertPartition(
  db: Env["DB"],
  partitionId: string,
  simulationId: string,
  isolatedNodes: string[],
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO partitions (id, simulation_id, isolated_nodes, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(partitionId, simulationId, JSON.stringify(isolatedNodes), Date.now())
    .run();
}

export async function healPartitionRecord(
  db: Env["DB"],
  simulationId: string,
): Promise<void> {
  await db
    .prepare("UPDATE partitions SET healed_at = ? WHERE simulation_id = ? AND healed_at IS NULL")
    .bind(Date.now(), simulationId)
    .run();
}
