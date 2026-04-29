/**
 * Rumor-Mongering (push-based) Gossip Protocol — Durable Object implementation.
 *
 * Fanout = ceil(log2(N)).  A rumor stops spreading when infectionCount >= log(N)/log(fanout).
 * DO Alarm fires every 1s to re-broadcast partially-propagated rumors.
 */

import type {
  NodeConfig,
  GossipState,
  GossipRumor,
  ObserverEvent,
  Env,
} from "../types";

const ALARM_INTERVAL_MS = 1000;
const RPC_TIMEOUT_MS = 200;

export class GossipNodeDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private config: NodeConfig | null = null;
  private initialized = false;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  private ensureInit(): void {
    if (this.initialized) return;
    this.state.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS rumors (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        version INTEGER NOT NULL,
        origin TEXT NOT NULL,
        infection_count INTEGER NOT NULL DEFAULT 0,
        fully_spread INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS partition_state (
        peer TEXT PRIMARY KEY
      );
    `);
    this.initialized = true;
  }

  private isPartitioned(peer: string): boolean {
    const rows = this.state.storage.sql
      .exec<{ peer: string }>("SELECT peer FROM partition_state WHERE peer = ?", peer)
      .toArray();
    return rows.length > 0;
  }

  private getLocalData(): Record<string, { value: string; version: number }> {
    const rows = this.state.storage.sql
      .exec<{ key: string; value: string; version: number }>(
        "SELECT key, value, version FROM rumors",
      )
      .toArray();
    const result: Record<string, { value: string; version: number }> = {};
    for (const r of rows) result[r.key] = { value: r.value, version: r.version };
    return result;
  }

  private getRumorsToSpread(): Array<{ key: string; value: string; version: number; origin: string; infectionCount: number }> {
    return this.state.storage.sql
      .exec<{ key: string; value: string; version: number; origin: string; infection_count: number }>(
        "SELECT key, value, version, origin, infection_count FROM rumors WHERE fully_spread = 0",
      )
      .toArray()
      .map(r => ({ key: r.key, value: r.value, version: r.version, origin: r.origin, infectionCount: r.infection_count }));
  }

  private fanout(): number {
    const n = this.config?.peers.length ?? 1;
    return Math.max(1, Math.ceil(Math.log2(n)));
  }

  private spreadThreshold(): number {
    const n = this.config?.peers.length ?? 1;
    const f = this.fanout();
    return Math.ceil(Math.log(n + 1) / Math.log(f + 1));
  }

  private async spreadRumor(rumor: GossipRumor, infectionCount: number): Promise<void> {
    if (!this.config) return;

    const threshold = this.spreadThreshold();
    if (infectionCount >= threshold) {
      this.state.storage.sql.exec(
        "UPDATE rumors SET fully_spread = 1 WHERE key = ?",
        rumor.key,
      );
      return;
    }

    const peers = this.config.peers.filter(
      p => p !== this.config!.nodeId && !this.isPartitioned(p),
    );
    const shuffled = [...peers].sort(() => Math.random() - 0.5);
    const targets = shuffled.slice(0, this.fanout());

    await Promise.allSettled(
      targets.map(async peer => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
        const start = Date.now();
        try {
          await fetch(`${this.config!.workerBaseUrl}/nodes/${peer}/gossip/rumor`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rumor),
            signal: controller.signal,
          });
          this.notifyObserver({
            type: "message_sent",
            from: this.config!.nodeId,
            to: peer,
            msgType: "gossip_rumor",
            latencyMs: Date.now() - start,
            ts: Date.now(),
          });
        } catch {
          this.notifyObserver({
            type: "message_dropped",
            from: this.config!.nodeId,
            to: peer,
            reason: "timeout",
            ts: Date.now(),
          });
        } finally {
          clearTimeout(timer);
        }
      }),
    );

    const newCount = infectionCount + targets.length;
    this.state.storage.sql.exec(
      "UPDATE rumors SET infection_count = ?, fully_spread = ? WHERE key = ?",
      newCount,
      newCount >= threshold ? 1 : 0,
      rumor.key,
    );
  }

  private notifyObserver(event: ObserverEvent): void {
    if (!this.config) return;
    fetch(`${this.config.workerBaseUrl}/observer/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Simulation-Id": this.config.simulationId,
      },
      body: JSON.stringify(event),
    }).catch(() => void 0);
  }

  private buildState(): GossipState {
    const rows = this.state.storage.sql
      .exec<{ infection_count: number }>("SELECT SUM(infection_count) as infection_count FROM rumors")
      .toArray();
    const infectionCount = rows[0]?.infection_count ?? 0;
    return {
      nodeId: this.config?.nodeId ?? "",
      localData: this.getLocalData(),
      infectionCount,
      peers: this.config?.peers ?? [],
    };
  }

  async alarm(): Promise<void> {
    this.ensureInit();
    if (!this.config) return;

    const rumors = this.getRumorsToSpread();
    await Promise.allSettled(
      rumors.map(r =>
        this.spreadRumor(
          { key: r.key, value: r.value, version: r.version, origin: r.origin },
          r.infectionCount,
        ),
      ),
    );

    this.notifyObserver({
      type: "node_state_update",
      nodeId: this.config.nodeId,
      algorithm: "gossip",
      state: this.buildState(),
      ts: Date.now(),
    });

    await this.state.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
  }

  async fetch(request: Request): Promise<Response> {
    this.ensureInit();
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/init" && request.method === "POST") {
      this.config = (await request.json()) as NodeConfig;
      const existing = await this.state.storage.getAlarm();
      if (existing === null) {
        await this.state.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
      }
      return new Response("ok");
    }

    if (path === "/gossip/state" && request.method === "GET") {
      return Response.json(this.buildState());
    }

    if (path === "/gossip/rumor" && request.method === "POST") {
      if (!this.config) return new Response("not initialized", { status: 503 });
      const rumor = await request.json() as GossipRumor;

      const existing = this.state.storage.sql
        .exec<{ version: number }>(
          "SELECT version FROM rumors WHERE key = ?",
          rumor.key,
        )
        .toArray()[0];

      const isNew = !existing || rumor.version > existing.version;
      if (isNew) {
        this.state.storage.sql.exec(
          "INSERT OR REPLACE INTO rumors (key, value, version, origin, infection_count, fully_spread) VALUES (?, ?, ?, ?, 0, 0)",
          rumor.key,
          rumor.value,
          rumor.version,
          rumor.origin,
        );
        // Immediately start spreading
        await this.spreadRumor(rumor, 0);
        this.notifyObserver({
          type: "node_state_update",
          nodeId: this.config.nodeId,
          algorithm: "gossip",
          state: this.buildState(),
          ts: Date.now(),
        });
      }
      return new Response("ok");
    }

    if (path === "/gossip/inject" && request.method === "POST") {
      if (!this.config) return new Response("not initialized", { status: 503 });
      const body = await request.json() as { key: string; value: string; version?: number };
      const existing = this.state.storage.sql
        .exec<{ version: number }>(
          "SELECT version FROM rumors WHERE key = ?",
          body.key,
        )
        .toArray()[0];
      const version = body.version ?? (existing ? existing.version + 1 : 1);

      this.state.storage.sql.exec(
        "INSERT OR REPLACE INTO rumors (key, value, version, origin, infection_count, fully_spread) VALUES (?, ?, ?, ?, 0, 0)",
        body.key,
        body.value,
        version,
        this.config.nodeId,
      );

      const rumor: GossipRumor = { key: body.key, value: body.value, version, origin: this.config.nodeId };
      await this.spreadRumor(rumor, 0);
      this.notifyObserver({
        type: "node_state_update",
        nodeId: this.config.nodeId,
        algorithm: "gossip",
        state: this.buildState(),
        ts: Date.now(),
      });
      return Response.json({ key: body.key, version });
    }

    if (path === "/partition/set" && request.method === "POST") {
      const { peers } = await request.json() as { peers: string[] };
      this.state.storage.sql.exec("DELETE FROM partition_state");
      for (const p of peers) {
        this.state.storage.sql.exec("INSERT OR IGNORE INTO partition_state (peer) VALUES (?)", p);
      }
      return new Response("ok");
    }

    if (path === "/partition/clear" && request.method === "POST") {
      this.state.storage.sql.exec("DELETE FROM partition_state");
      return new Response("ok");
    }

    if (path === "/stop" && request.method === "POST") {
      await this.state.storage.deleteAlarm();
      return new Response("ok");
    }

    if (path === "/restart" && request.method === "POST") {
      this.config = await request.json() as NodeConfig;
      this.state.storage.sql.exec("DELETE FROM rumors");
      this.state.storage.sql.exec("DELETE FROM partition_state");
      await this.state.storage.deleteAlarm();
      await this.state.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
      return new Response("ok");
    }

    return new Response("Not Found", { status: 404 });
  }
}
