/**
 * ObserverDO — single DO per simulation.
 *
 * Accepts events from algorithm nodes, fans them out to all connected dashboard
 * WebSockets via hibernation API, and stores the last 500 events in local SQLite.
 * Also async-writes to D1 for historical replay.
 */

import type { ObserverEvent, Env } from "./types";
import { isObserverEvent } from "./types";

const MAX_REPLAY_EVENTS = 500;

export class ObserverDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private initialized = false;
  private simulationId: string | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  private ensureInit(): void {
    if (this.initialized) return;
    this.state.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS observer_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        simulation_id TEXT NOT NULL,
        event_json TEXT NOT NULL,
        timestamp_ms INTEGER NOT NULL
      );
    `);
    this.initialized = true;
  }

  private storeEvent(simId: string, event: ObserverEvent): void {
    // Keep only the last MAX_REPLAY_EVENTS
    this.state.storage.sql.exec(
      "INSERT INTO observer_events (simulation_id, event_json, timestamp_ms) VALUES (?, ?, ?)",
      simId,
      JSON.stringify(event),
      event.ts,
    );
    this.state.storage.sql.exec(`
      DELETE FROM observer_events
      WHERE id NOT IN (
        SELECT id FROM observer_events ORDER BY id DESC LIMIT ?
      )
    `, MAX_REPLAY_EVENTS);
  }

  private broadcastToSessions(payload: string): void {
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // WebSocket may have closed; hibernation cleans it up automatically
      }
    }
  }

  // ── WebSocket message handler (hibernation API) ─────────────────────────────

  async webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer): Promise<void> {
    // Dashboard only receives; no inbound messages needed
  }

  async webSocketClose(_ws: WebSocket): Promise<void> {
    // Hibernation handles cleanup automatically
  }

  async webSocketError(_ws: WebSocket, _error: unknown): Promise<void> {
    // Swallow — do not crash the DO
  }

  // ── HTTP handlers ───────────────────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    this.ensureInit();

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/init" && request.method === "POST") {
      const body = await request.json() as { simulationId: string };
      this.simulationId = body.simulationId;
      return new Response("ok");
    }

    if (path === "/event" && request.method === "POST") {
      const raw = await request.json();
      if (!isObserverEvent(raw)) {
        return new Response("invalid event", { status: 400 });
      }
      const event = raw as ObserverEvent;
      const simId = this.simulationId ?? "unknown";

      this.storeEvent(simId, event);
      const payload = JSON.stringify(event);
      this.broadcastToSessions(payload);

      // Async D1 write — fire-and-forget
      this.env.DB.prepare(
        `INSERT INTO events
           (simulation_id, node_id, event_type, payload, from_node, to_node, latency_ms, timestamp_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          simId,
          "from" in event ? event.from : "observer",
          event.type,
          payload,
          "from" in event ? event.from : null,
          "to" in event ? event.to : null,
          "latencyMs" in event ? (event.latencyMs ?? null) : null,
          event.ts,
        )
        .run()
        .catch(() => void 0);

      return new Response("ok");
    }

    if (path === "/ws") {
      // WebSocket upgrade — dashboard connects here
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }
      const { 0: client, 1: server } = new WebSocketPair();
      this.state.acceptWebSocket(server);

      // Send recent replay events to new client
      const recent = this.state.storage.sql
        .exec<{ event_json: string }>(
          "SELECT event_json FROM observer_events ORDER BY id DESC LIMIT ?",
          MAX_REPLAY_EVENTS,
        )
        .toArray()
        .reverse();

      for (const row of recent) {
        try {
          server.send(row.event_json);
        } catch {
          // ignore — client might not be ready yet
        }
      }

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    if (path === "/replay" && request.method === "GET") {
      const rows = this.state.storage.sql
        .exec<{ event_json: string }>(
          "SELECT event_json FROM observer_events ORDER BY id DESC LIMIT ?",
          MAX_REPLAY_EVENTS,
        )
        .toArray()
        .reverse()
        .map(r => JSON.parse(r.event_json) as ObserverEvent);
      return Response.json(rows);
    }

    return new Response("Not Found", { status: 404 });
  }
}
