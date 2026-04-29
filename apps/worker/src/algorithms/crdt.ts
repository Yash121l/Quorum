/**
 * Last-Write-Wins (LWW) Register CRDT — Durable Object implementation.
 *
 * Merge semantics: higher Lamport timestamp wins; on tie, higher nodeId wins (tiebreak).
 * Gossip fanout = 2, alarm every 500ms.
 */

import type {
  NodeConfig,
  CrdtState,
  LWWRegister,
  ObserverEvent,
  Env,
} from "../types";

const GOSSIP_INTERVAL_MS = 500;
const RPC_TIMEOUT_MS = 200;

export class CrdtReplicaDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private config: NodeConfig | null = null;
  private initialized = false;

  // Lamport clock — monotonically increasing, persisted in SQLite
  private lamportClock = 0;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  private ensureInit(): void {
    if (this.initialized) return;
    this.state.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS crdt_registers (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        node_id TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS crdt_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS partition_state (
        peer TEXT PRIMARY KEY
      );
    `);
    const clockRow = this.state.storage.sql
      .exec<{ value: string }>("SELECT value FROM crdt_meta WHERE key = 'lamport_clock'")
      .toArray()[0];
    if (clockRow) this.lamportClock = Number(clockRow.value);
    this.initialized = true;
  }

  private isPartitioned(peer: string): boolean {
    const rows = this.state.storage.sql
      .exec<{ peer: string }>("SELECT peer FROM partition_state WHERE peer = ?", peer)
      .toArray();
    return rows.length > 0;
  }

  private getRegisters(): Record<string, LWWRegister> {
    const rows = this.state.storage.sql
      .exec<{ key: string; value: string; timestamp: number; node_id: string }>(
        "SELECT key, value, timestamp, node_id FROM crdt_registers",
      )
      .toArray();
    const result: Record<string, LWWRegister> = {};
    for (const r of rows) {
      result[r.key] = {
        key: r.key,
        value: r.value,
        timestamp: r.timestamp,
        nodeId: r.node_id,
      };
    }
    return result;
  }

  private setRegister(reg: LWWRegister): void {
    this.state.storage.sql.exec(
      "INSERT OR REPLACE INTO crdt_registers (key, value, timestamp, node_id) VALUES (?, ?, ?, ?)",
      reg.key,
      String(reg.value),
      reg.timestamp,
      reg.nodeId,
    );
  }

  private tickClock(): number {
    this.lamportClock += 1;
    this.state.storage.sql.exec(
      "INSERT OR REPLACE INTO crdt_meta (key, value) VALUES ('lamport_clock', ?)",
      String(this.lamportClock),
    );
    return this.lamportClock;
  }

  private mergeRegister(incoming: LWWRegister): boolean {
    const existing = this.state.storage.sql
      .exec<{ timestamp: number; node_id: string }>(
        "SELECT timestamp, node_id FROM crdt_registers WHERE key = ?",
        incoming.key,
      )
      .toArray()[0];

    if (!existing) {
      this.setRegister(incoming);
      return true;
    }

    if (incoming.timestamp > existing.timestamp) {
      this.setRegister(incoming);
      return true;
    }

    if (incoming.timestamp === existing.timestamp && incoming.nodeId > existing.node_id) {
      this.setRegister(incoming);
      return true;
    }

    return false;
  }

  private buildState(): CrdtState {
    const registers = this.getRegisters();
    const vectorClock: Record<string, number> = {};
    for (const r of Object.values(registers)) {
      vectorClock[r.nodeId] = Math.max(vectorClock[r.nodeId] ?? 0, r.timestamp);
    }
    return {
      nodeId: this.config?.nodeId ?? "",
      registers,
      vectorClock,
    };
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

  private async gossipToRandomPeers(): Promise<void> {
    if (!this.config) return;
    const peers = this.config.peers.filter(p => p !== this.config!.nodeId && !this.isPartitioned(p));
    if (peers.length === 0) return;

    // Shuffle and pick 2
    const shuffled = [...peers].sort(() => Math.random() - 0.5);
    const targets = shuffled.slice(0, 2);
    const state = this.buildState();

    await Promise.allSettled(
      targets.map(async peer => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
        const start = Date.now();
        try {
          await fetch(`${this.config!.workerBaseUrl}/nodes/${peer}/crdt/merge`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(state),
            signal: controller.signal,
          });
          this.notifyObserver({
            type: "message_sent",
            from: this.config!.nodeId,
            to: peer,
            msgType: "crdt_gossip",
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
  }

  async alarm(): Promise<void> {
    this.ensureInit();
    await this.gossipToRandomPeers();
    this.notifyObserver({
      type: "node_state_update",
      nodeId: this.config?.nodeId ?? "",
      algorithm: "crdt",
      state: this.buildState(),
      ts: Date.now(),
    });
    await this.state.storage.setAlarm(Date.now() + GOSSIP_INTERVAL_MS);
  }

  async fetch(request: Request): Promise<Response> {
    this.ensureInit();
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/init" && request.method === "POST") {
      this.config = (await request.json()) as NodeConfig;
      const existing = await this.state.storage.getAlarm();
      if (existing === null) {
        await this.state.storage.setAlarm(Date.now() + GOSSIP_INTERVAL_MS);
      }
      return new Response("ok");
    }

    if (path === "/crdt/get" && request.method === "GET") {
      return Response.json(this.getRegisters());
    }

    if (path === "/crdt/state" && request.method === "GET") {
      return Response.json(this.buildState());
    }

    if (path === "/crdt/set" && request.method === "PUT") {
      if (!this.config) return new Response("not initialized", { status: 503 });
      const body = await request.json() as { key: string; value: unknown };
      const ts = this.tickClock();
      const reg: LWWRegister = {
        key: body.key,
        value: body.value,
        timestamp: ts,
        nodeId: this.config.nodeId,
      };
      this.setRegister(reg);
      this.notifyObserver({
        type: "node_state_update",
        nodeId: this.config.nodeId,
        algorithm: "crdt",
        state: this.buildState(),
        ts: Date.now(),
      });
      return Response.json({ key: body.key, timestamp: ts });
    }

    if (path === "/crdt/merge" && request.method === "POST") {
      const incoming = await request.json() as CrdtState;
      // Advance Lamport clock on receive
      const maxRemoteClock = Math.max(...Object.values(incoming.vectorClock));
      if (maxRemoteClock > this.lamportClock) {
        this.lamportClock = maxRemoteClock;
        this.state.storage.sql.exec(
          "INSERT OR REPLACE INTO crdt_meta (key, value) VALUES ('lamport_clock', ?)",
          String(this.lamportClock),
        );
      }

      let changed = false;
      for (const reg of Object.values(incoming.registers)) {
        if (this.mergeRegister(reg)) changed = true;
      }

      if (changed && this.config) {
        this.notifyObserver({
          type: "node_state_update",
          nodeId: this.config.nodeId,
          algorithm: "crdt",
          state: this.buildState(),
          ts: Date.now(),
        });
      }
      return new Response("ok");
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
      this.lamportClock = 0;
      this.state.storage.sql.exec("DELETE FROM crdt_registers");
      this.state.storage.sql.exec("DELETE FROM crdt_meta");
      this.state.storage.sql.exec("DELETE FROM partition_state");
      await this.state.storage.deleteAlarm();
      await this.state.storage.setAlarm(Date.now() + GOSSIP_INTERVAL_MS);
      return new Response("ok");
    }

    return new Response("Not Found", { status: 404 });
  }
}
