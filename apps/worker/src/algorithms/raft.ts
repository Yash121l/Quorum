/**
 * Raft consensus algorithm — Durable Object implementation.
 *
 * References: Ongaro & Ousterhout, "In Search of an Understandable Consensus Algorithm" (2014)
 * https://raft.github.io/raft.pdf
 *
 * Every invariant cite-documents its thesis section.
 */

import type {
  NodeConfig,
  RaftState,
  RaftRole,
  RaftLogEntry,
  RequestVoteArgs,
  RequestVoteReply,
  AppendEntriesArgs,
  AppendEntriesReply,
  ObserverEvent,
  Env,
} from "../types";

const ELECTION_TIMEOUT_MIN = 400;
const ELECTION_TIMEOUT_MAX = 800;
const HEARTBEAT_INTERVAL_MS = 50;
const RPC_TIMEOUT_MS = 200;

function randomElectionTimeout(): number {
  // §5.2: randomised timeouts to split votes rarely
  // Use crypto.getRandomValues for true randomness (not Math.random)
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const range = ELECTION_TIMEOUT_MAX - ELECTION_TIMEOUT_MIN;
  return ELECTION_TIMEOUT_MIN + ((buf[0]! % (range + 1)));
}

export class RaftNodeDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private config: NodeConfig | null = null;

  // In-memory cache to avoid redundant SQLite reads in hot paths
  private role: RaftRole = "follower";
  private currentTerm = 0;
  private votedFor: string | null = null;
  private leaderId: string | null = null;
  private commitIndex = 0;
  private lastApplied = 0;
  private votesReceived: Set<string> = new Set();
  private nextIndex: Map<string, number> = new Map();
  private matchIndex: Map<string, number> = new Map();
  private initialized = false;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  // ── Initialise SQLite tables on first boot ──────────────────────────────────

  private async ensureInit(): Promise<void> {
    if (this.initialized) return;
    this.state.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS raft_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS log_entries (
        idx INTEGER PRIMARY KEY,
        term INTEGER NOT NULL,
        command TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS state_machine (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS partition_state (
        peer TEXT PRIMARY KEY
      );
    `);

    const term = this.meta("current_term");
    const voted = this.meta("voted_for");
    const role = this.meta("role");
    const leader = this.meta("leader_id");
    const commit = this.meta("commit_index");

    if (term !== null) this.currentTerm = Number(term);
    if (voted !== null) this.votedFor = voted === "__null__" ? null : voted;
    if (role !== null) this.role = role as RaftRole;
    if (leader !== null) this.leaderId = leader === "__null__" ? null : leader;
    if (commit !== null) this.commitIndex = Number(commit);

    this.initialized = true;
  }

  private meta(key: string): string | null {
    const rows = this.state.storage.sql
      .exec<{ value: string }>("SELECT value FROM raft_meta WHERE key = ?", key)
      .toArray();
    return rows[0]?.value ?? null;
  }

  private setMeta(key: string, value: string | null): void {
    const v = value === null ? "__null__" : value;
    this.state.storage.sql.exec(
      "INSERT OR REPLACE INTO raft_meta (key, value) VALUES (?, ?)",
      key,
      v,
    );
  }

  // ── Log helpers ─────────────────────────────────────────────────────────────

  private getLog(): RaftLogEntry[] {
    return this.state.storage.sql
      .exec<{ idx: number; term: number; command: string }>(
        "SELECT idx, term, command FROM log_entries ORDER BY idx ASC",
      )
      .toArray()
      .map((r) => ({ index: r.idx, term: r.term, command: r.command }));
  }

  private getLogEntry(index: number): RaftLogEntry | undefined {
    const row = this.state.storage.sql
      .exec<{ idx: number; term: number; command: string }>(
        "SELECT idx, term, command FROM log_entries WHERE idx = ?",
        index,
      )
      .toArray()[0];
    return row ? { index: row.idx, term: row.term, command: row.command } : undefined;
  }

  private lastLogIndexAndTerm(): { index: number; term: number } {
    const row = this.state.storage.sql
      .exec<{ idx: number; term: number }>(
        "SELECT idx, term FROM log_entries ORDER BY idx DESC LIMIT 1",
      )
      .toArray()[0];
    return row ? { index: row.idx, term: row.term } : { index: 0, term: 0 };
  }

  private appendLogEntries(entries: RaftLogEntry[]): void {
    for (const e of entries) {
      this.state.storage.sql.exec(
        "INSERT OR REPLACE INTO log_entries (idx, term, command) VALUES (?, ?, ?)",
        e.index,
        e.term,
        e.command,
      );
    }
  }

  private truncateLogAfter(index: number): void {
    this.state.storage.sql.exec("DELETE FROM log_entries WHERE idx > ?", index);
  }

  // ── Partition helpers ───────────────────────────────────────────────────────

  private isPartitioned(peer: string): boolean {
    const rows = this.state.storage.sql
      .exec<{ peer: string }>("SELECT peer FROM partition_state WHERE peer = ?", peer)
      .toArray();
    return rows.length > 0;
  }

  // ── Term helpers (§5.1: servers update term and revert to follower) ─────────

  private updateTerm(newTerm: number): void {
    if (newTerm > this.currentTerm) {
      this.currentTerm = newTerm;
      this.votedFor = null;
      this.role = "follower";
      this.leaderId = null;
      this.setMeta("current_term", String(newTerm));
      this.setMeta("voted_for", null);
      this.setMeta("role", "follower");
      this.setMeta("leader_id", null);
    }
  }

  // ── Election timer ──────────────────────────────────────────────────────────

  private async scheduleElectionTimeout(): Promise<void> {
    const existing = await this.state.storage.getAlarm();
    if (existing !== null) return; // already scheduled
    await this.state.storage.setAlarm(Date.now() + randomElectionTimeout());
  }

  private async resetElectionTimeout(): Promise<void> {
    await this.state.storage.deleteAlarm();
    await this.state.storage.setAlarm(Date.now() + randomElectionTimeout());
  }

  private async scheduleHeartbeat(): Promise<void> {
    const existing = await this.state.storage.getAlarm();
    if (existing !== null) return;
    await this.state.storage.setAlarm(Date.now() + HEARTBEAT_INTERVAL_MS);
  }

  // ── alarm() — drives election and heartbeat timers ─────────────────────────

  async alarm(): Promise<void> {
    await this.ensureInit();
    if (!this.config) return;

    if (this.role === "leader") {
      // Schedule next heartbeat FIRST so its interval isn't stretched by RPC latency
      await this.state.storage.setAlarm(Date.now() + HEARTBEAT_INTERVAL_MS);
      await this.sendHeartbeats();
    } else {
      // Election timeout fired — start an election
      await this.startElection();
    }
  }

  // ── Election (§5.2) ─────────────────────────────────────────────────────────

  private async startElection(): Promise<void> {
    if (!this.config) return;

    this.currentTerm += 1;
    this.role = "candidate";
    this.votedFor = this.config.nodeId;
    this.votesReceived = new Set([this.config.nodeId]);
    this.setMeta("current_term", String(this.currentTerm));
    this.setMeta("voted_for", this.config.nodeId);
    this.setMeta("role", "candidate");

    await this.notifyObserver({
      type: "message_sent",
      from: this.config.nodeId,
      to: "*",
      msgType: "request_vote",
      term: this.currentTerm,
      ts: Date.now(),
    });

    const { index: lastLogIndex, term: lastLogTerm } = this.lastLogIndexAndTerm();
    const args: RequestVoteArgs = {
      term: this.currentTerm,
      candidateId: this.config.nodeId,
      lastLogIndex,
      lastLogTerm,
    };

    const majority = Math.floor(this.config.peers.length / 2) + 1;

    await Promise.allSettled(
      this.config.peers
        .filter(p => p !== this.config!.nodeId)
        .map(async peer => {
          const reply = await this.sendRPC<RequestVoteReply>(peer, "request-vote", args);
          if (!reply) return;
          // §5.1: if we see a higher term, revert to follower
          if (reply.term > this.currentTerm) {
            this.updateTerm(reply.term);
            await this.resetElectionTimeout();
            return;
          }
          if (this.role !== "candidate" || reply.term !== this.currentTerm) return;
          if (reply.voteGranted) {
            this.votesReceived.add(peer);
            if (this.votesReceived.size >= majority) {
              await this.becomeLeader();
            }
          }
        }),
    );

    // If still candidate (no majority), reschedule timeout
    if (this.role === "candidate") {
      await this.state.storage.setAlarm(Date.now() + randomElectionTimeout());
    }
  }

  // ── Become leader (§5.2) ────────────────────────────────────────────────────

  private async becomeLeader(): Promise<void> {
    if (!this.config || this.role === "leader") return;

    this.role = "leader";
    this.leaderId = this.config.nodeId;
    this.setMeta("role", "leader");
    this.setMeta("leader_id", this.config.nodeId);

    // Reinitialise nextIndex and matchIndex (§5.3)
    const { index: lastLogIndex } = this.lastLogIndexAndTerm();
    for (const peer of this.config.peers) {
      if (peer !== this.config.nodeId) {
        this.nextIndex.set(peer, lastLogIndex + 1);
        this.matchIndex.set(peer, 0);
      }
    }

    await this.notifyObserver({
      type: "leader_elected",
      leaderId: this.config.nodeId,
      term: this.currentTerm,
      simulationId: this.config.simulationId,
      ts: Date.now(),
    });

    // §5.2: immediately send empty AppendEntries to assert authority
    await this.state.storage.deleteAlarm();
    await this.sendHeartbeats();
    await this.state.storage.setAlarm(Date.now() + HEARTBEAT_INTERVAL_MS);
  }

  // ── Heartbeats / log replication ────────────────────────────────────────────

  private async sendHeartbeats(): Promise<void> {
    if (!this.config || this.role !== "leader") return;
    const peers = this.config.peers.filter(p => p !== this.config!.nodeId);
    await Promise.allSettled(peers.map(peer => this.replicateToPeer(peer)));
  }

  private async replicateToPeer(peer: string): Promise<void> {
    if (!this.config) return;

    const ni = this.nextIndex.get(peer) ?? 1;
    const prevIndex = ni - 1;
    const prevEntry = prevIndex > 0 ? this.getLogEntry(prevIndex) : undefined;
    const prevLogTerm = prevEntry?.term ?? 0;

    const allEntries = this.getLog();
    const entries = allEntries.filter(e => e.index >= ni);

    const args: AppendEntriesArgs = {
      term: this.currentTerm,
      leaderId: this.config.nodeId,
      prevLogIndex: prevIndex,
      prevLogTerm,
      entries,
      leaderCommit: this.commitIndex,
    };

    const reply = await this.sendRPC<AppendEntriesReply>(peer, "append-entries", args);
    if (!reply) return;

    if (reply.term > this.currentTerm) {
      this.updateTerm(reply.term);
      await this.resetElectionTimeout();
      return;
    }
    if (this.role !== "leader") return;

    if (reply.success) {
      const newMatch = prevIndex + entries.length;
      this.matchIndex.set(peer, newMatch);
      this.nextIndex.set(peer, newMatch + 1);
      await this.advanceCommitIndex();
    } else {
      // Decrement nextIndex for fast log roll-back (§5.3 optimisation)
      if (reply.conflictIndex !== undefined) {
        this.nextIndex.set(peer, Math.max(1, reply.conflictIndex));
      } else {
        this.nextIndex.set(peer, Math.max(1, ni - 1));
      }
    }
  }

  // ── Commit index advancement (§5.4.2) ──────────────────────────────────────

  private async advanceCommitIndex(): Promise<void> {
    if (!this.config || this.role !== "leader") return;

    const { index: lastLogIndex } = this.lastLogIndexAndTerm();
    const majority = Math.floor(this.config.peers.length / 2) + 1;

    for (let n = lastLogIndex; n > this.commitIndex; n--) {
      const entry = this.getLogEntry(n);
      // §5.4.2: only commit entries from the CURRENT term
      if (!entry || entry.term !== this.currentTerm) continue;

      let replicatedCount = 1; // leader itself
      for (const peer of this.config.peers) {
        if (peer !== this.config.nodeId && (this.matchIndex.get(peer) ?? 0) >= n) {
          replicatedCount++;
        }
      }

      if (replicatedCount >= majority) {
        this.commitIndex = n;
        this.setMeta("commit_index", String(n));
        await this.applyCommittedEntries();
        break;
      }
    }
  }

  private async applyCommittedEntries(): Promise<void> {
    while (this.lastApplied < this.commitIndex) {
      this.lastApplied++;
      const entry = this.getLogEntry(this.lastApplied);
      if (entry) {
        this.applyToStateMachine(entry.command);
      }
    }
    this.setMeta("last_applied", String(this.lastApplied));
  }

  private applyToStateMachine(command: string): void {
    // Simple KV state machine: "SET key=value"
    const m = command.match(/^SET\s+(\S+)\s*=\s*(.*)$/i);
    if (m && m[1] && m[2] !== undefined) {
      this.state.storage.sql.exec(
        "INSERT OR REPLACE INTO state_machine (key, value) VALUES (?, ?)",
        m[1],
        m[2],
      );
    }
  }

  // ── RPC transport ───────────────────────────────────────────────────────────

  private async sendRPC<T>(peer: string, rpc: string, payload: unknown): Promise<T | null> {
    if (!this.config) return null;
    if (this.isPartitioned(peer)) {
      await this.notifyObserver({
        type: "message_dropped",
        from: this.config.nodeId,
        to: peer,
        reason: "partitioned",
        ts: Date.now(),
      });
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
    const start = Date.now();

    try {
      const res = await fetch(
        `${this.config.workerBaseUrl}/nodes/${peer}/raft/${rpc}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );
      const latencyMs = Date.now() - start;
      await this.notifyObserver({
        type: "message_sent",
        from: this.config.nodeId,
        to: peer,
        msgType: `raft_${rpc.replace("-", "_")}`,
        term: this.currentTerm,
        latencyMs,
        ts: Date.now(),
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      await this.notifyObserver({
        type: "message_dropped",
        from: this.config.nodeId,
        to: peer,
        reason: "timeout",
        ts: Date.now(),
      });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Observer notification (fire-and-forget) ─────────────────────────────────

  private notifyObserver(event: ObserverEvent): Promise<void> {
    if (!this.config) return Promise.resolve();
    // Fire-and-forget — never block algorithm progress on observer
    fetch(`${this.config.workerBaseUrl}/observer/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Simulation-Id": this.config.simulationId,
      },
      body: JSON.stringify(event),
    }).catch(() => void 0);
    return Promise.resolve();
  }

  // ── HTTP handlers ───────────────────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    await this.ensureInit();

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/init" && request.method === "POST") {
      this.config = (await request.json()) as NodeConfig;
      this.setMeta("node_id", this.config.nodeId);
      this.setMeta("simulation_id", this.config.simulationId);
      await this.scheduleElectionTimeout();
      await this.notifyObserver({
        type: "node_state_update",
        nodeId: this.config.nodeId,
        algorithm: "raft",
        state: this.buildState(),
        ts: Date.now(),
      });
      return new Response("ok");
    }

    if (path === "/raft/state" && request.method === "GET") {
      return Response.json(this.buildState());
    }

    if (path === "/raft/request-vote" && request.method === "POST") {
      return this.handleRequestVote(await request.json() as RequestVoteArgs);
    }

    if (path === "/raft/append-entries" && request.method === "POST") {
      return this.handleAppendEntries(await request.json() as AppendEntriesArgs);
    }

    if (path === "/raft/client-command" && request.method === "POST") {
      return this.handleClientCommand(await request.json() as { command: string });
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
      const cfg = await request.json() as NodeConfig;
      this.config = cfg;
      this.role = "follower";
      this.currentTerm = 0;
      this.votedFor = null;
      this.leaderId = null;
      this.commitIndex = 0;
      this.lastApplied = 0;
      this.votesReceived = new Set();
      this.state.storage.sql.exec("DELETE FROM raft_meta");
      this.state.storage.sql.exec("DELETE FROM log_entries");
      this.state.storage.sql.exec("DELETE FROM partition_state");
      await this.state.storage.deleteAlarm();
      await this.scheduleElectionTimeout();
      return new Response("ok");
    }

    return new Response("Not Found", { status: 404 });
  }

  // ── RequestVote RPC (§5.2, §5.4) ───────────────────────────────────────────

  private async handleRequestVote(args: RequestVoteArgs): Promise<Response> {
    await this.ensureInit();

    if (args.term > this.currentTerm) this.updateTerm(args.term);

    // §5.2: stale term
    if (args.term < this.currentTerm) {
      return Response.json({ term: this.currentTerm, voteGranted: false } satisfies RequestVoteReply);
    }

    // §5.2: vote only once per term
    const alreadyVotedForAnother =
      this.votedFor !== null &&
      this.votedFor !== args.candidateId;
    if (alreadyVotedForAnother) {
      return Response.json({ term: this.currentTerm, voteGranted: false } satisfies RequestVoteReply);
    }

    // §5.4.1: log up-to-dateness check
    const { index: myLastIndex, term: myLastTerm } = this.lastLogIndexAndTerm();
    const candidateLogOk =
      args.lastLogTerm > myLastTerm ||
      (args.lastLogTerm === myLastTerm && args.lastLogIndex >= myLastIndex);

    if (!candidateLogOk) {
      return Response.json({ term: this.currentTerm, voteGranted: false } satisfies RequestVoteReply);
    }

    this.votedFor = args.candidateId;
    this.setMeta("voted_for", args.candidateId);
    // §5.2: reset election timer when granting vote
    await this.resetElectionTimeout();

    return Response.json({ term: this.currentTerm, voteGranted: true } satisfies RequestVoteReply);
  }

  // ── AppendEntries RPC (§5.3) ────────────────────────────────────────────────

  private async handleAppendEntries(args: AppendEntriesArgs): Promise<Response> {
    await this.ensureInit();

    if (args.term > this.currentTerm) this.updateTerm(args.term);

    // §5.1: stale leader
    if (args.term < this.currentTerm) {
      return Response.json({ term: this.currentTerm, success: false } satisfies AppendEntriesReply);
    }

    // §5.2: reset timer ONLY on valid AppendEntries from current leader
    this.leaderId = args.leaderId;
    this.setMeta("leader_id", args.leaderId);
    await this.resetElectionTimeout();

    // §5.3: consistency check
    if (args.prevLogIndex > 0) {
      const prevEntry = this.getLogEntry(args.prevLogIndex);
      if (!prevEntry) {
        return Response.json({
          term: this.currentTerm,
          success: false,
          conflictIndex: this.lastLogIndexAndTerm().index + 1,
        } satisfies AppendEntriesReply);
      }
      if (prevEntry.term !== args.prevLogTerm) {
        // Find first index of the conflicting term for fast rollback
        const conflictingTerm = prevEntry.term;
        const rows = this.state.storage.sql
          .exec<{ idx: number }>(
            "SELECT MIN(idx) as idx FROM log_entries WHERE term = ?",
            conflictingTerm,
          )
          .toArray();
        const conflictIndex = rows[0]?.idx ?? args.prevLogIndex;
        this.truncateLogAfter(args.prevLogIndex - 1);
        return Response.json({
          term: this.currentTerm,
          success: false,
          conflictIndex,
          conflictTerm: conflictingTerm,
        } satisfies AppendEntriesReply);
      }
    }

    // §5.3: append new entries, removing conflicts
    for (const entry of args.entries) {
      const existing = this.getLogEntry(entry.index);
      if (existing && existing.term !== entry.term) {
        this.truncateLogAfter(entry.index - 1);
      }
      if (!existing || existing.term !== entry.term) {
        this.appendLogEntries([entry]);
      }
    }

    // §5.3: advance commitIndex
    if (args.leaderCommit > this.commitIndex) {
      const { index: lastNewIndex } =
        args.entries.length > 0
          ? { index: args.entries[args.entries.length - 1]!.index }
          : this.lastLogIndexAndTerm();
      this.commitIndex = Math.min(args.leaderCommit, lastNewIndex);
      this.setMeta("commit_index", String(this.commitIndex));
      await this.applyCommittedEntries();
    }

    if (this.config) {
      await this.notifyObserver({
        type: "node_state_update",
        nodeId: this.config.nodeId,
        algorithm: "raft",
        state: this.buildState(),
        ts: Date.now(),
      });
    }

    return Response.json({ term: this.currentTerm, success: true } satisfies AppendEntriesReply);
  }

  // ── Client command (leader append) ──────────────────────────────────────────

  private async handleClientCommand(body: { command: string }): Promise<Response> {
    if (!this.config) return new Response("not initialized", { status: 503 });

    if (this.role !== "leader") {
      return Response.json(
        { error: "not_leader", leaderId: this.leaderId },
        { status: 307 },
      );
    }

    const { index: lastIndex } = this.lastLogIndexAndTerm();
    const entry: RaftLogEntry = {
      index: lastIndex + 1,
      term: this.currentTerm,
      command: body.command,
    };
    this.appendLogEntries([entry]);

    // Immediately try to replicate to quorum
    await this.sendHeartbeats();

    return Response.json({ index: entry.index, term: entry.term });
  }

  private buildState(): RaftState {
    return {
      nodeId: this.config?.nodeId ?? "",
      role: this.role,
      currentTerm: this.currentTerm,
      votedFor: this.votedFor,
      log: this.getLog(),
      commitIndex: this.commitIndex,
      lastApplied: this.lastApplied,
      leaderId: this.leaderId,
      votesReceived: Array.from(this.votesReceived),
    };
  }
}
