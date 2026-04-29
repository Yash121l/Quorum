/**
 * SimulationDO — lightweight coordination object.
 * Stores simulation metadata: which nodes exist, which algorithm, which regions.
 */

import type { Env, NodeConfig, Algorithm, CFRegion } from "./types";

interface SimulationRecord {
  simulationId: string;
  algorithm: Algorithm;
  nodes: NodeConfig[];
  workerBaseUrl: string;
}

export class SimulationDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private initialized = false;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  private ensureInit(): void {
    if (this.initialized) return;
    this.state.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS simulation_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    this.initialized = true;
  }

  async fetch(request: Request): Promise<Response> {
    this.ensureInit();
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/init" && request.method === "POST") {
      const body = await request.json() as SimulationRecord;
      this.state.storage.sql.exec(
        "INSERT OR REPLACE INTO simulation_meta (key, value) VALUES ('record', ?)",
        JSON.stringify(body),
      );
      return new Response("ok");
    }

    if (path === "/state" && request.method === "GET") {
      const row = this.state.storage.sql
        .exec<{ value: string }>(
          "SELECT value FROM simulation_meta WHERE key = 'record'",
        )
        .toArray()[0];
      if (!row) return new Response("not found", { status: 404 });
      return new Response(row.value, {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }
}
