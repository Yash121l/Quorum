# Quorum

Production-grade interactive distributed systems sandbox.  
Each algorithm node is a **real Cloudflare Durable Object** running in an actual geographic PoP.  
A live browser dashboard visualizes real cross-PoP messages, latency, and partition behavior.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (React + D3)                     │
│   Home page → pick algorithm, regions, node count           │
│   Simulation page → live graph, event log, heatmap          │
└───────────────────┬─────────────────────────────────────────┘
                    │ WebSocket + REST
┌───────────────────▼─────────────────────────────────────────┐
│             Cloudflare Worker (Hono router)                  │
│   POST /api/simulations         → create, init DOs          │
│   POST /api/simulations/:id/partition → apply partition      │
│   POST /api/simulations/:id/heal      → heal partition       │
│   POST /api/simulations/:id/inject    → inject command       │
│   GET  /api/simulations/:id/observer/ws → WebSocket proxy   │
│   ALL  /nodes/:nodeId/:algo/:rpc  → proxy to algorithm DO   │
└──┬───────────────┬────────────────┬──────────────┬──────────┘
   │               │                │              │
   ▼               ▼                ▼              ▼
┌──────┐       ┌──────┐        ┌──────┐       ┌──────────┐
│Raft  │       │CRDT  │        │Gossip│       │Observer  │
│NodeDO│◄─────►│Repli-│        │NodeDO│       │    DO    │
│      │  HTTP │caDO  │        │      │       │(WebSocket│
│wnam  │       │weur  │        │apac  │       │ fan-out) │
└──────┘       └──────┘        └──────┘       └────┬─────┘
                                                   │ async
                                            ┌──────▼──────┐
                                            │  D1 + KV    │
                                            │(event log,  │
                                            │ topology)   │
                                            └─────────────┘
```

Each algorithm node is a **separate Durable Object** with its own:
- SQLite storage (state, log entries, partition table)
- DO Alarm (election timer / gossip timer)
- Location hint → deployed to the chosen Cloudflare PoP

---

## Algorithms

### Raft Consensus (Ongaro & Ousterhout, 2014)
Reference: https://raft.github.io/raft.pdf

| Property | Value |
|----------|-------|
| Consistency | Strong (linearisable) |
| Election timeout | 150–300ms (randomised via crypto.getRandomValues) |
| Heartbeat interval | 50ms |
| Inter-node RPC timeout | 200ms |
| Max nodes | 7 (odd required for majority) |

Key invariants implemented:
- §5.1  — nodes update term and revert to follower on seeing higher term
- §5.2  — vote only once per term; reset timer only on valid AppendEntries
- §5.3  — consistency check (prevLogIndex/prevLogTerm) before appending
- §5.4.1 — log up-to-dateness check before granting vote
- §5.4.2 — leader only commits entries from current term

### LWW-Register CRDT
- Merge rule: higher Lamport timestamp wins; ties broken by nodeId (lexicographic)
- Gossip fanout = 2, interval = 500ms
- CAP: AP system — always available, eventually consistent

### Rumor-Mongering Gossip
- Push-based epidemic protocol
- Fanout = ceil(log₂N), threshold = log(N)/log(fanout)
- Rumor stops spreading once infectionCount ≥ threshold
- O(log N) dissemination with high probability

---

## Local Development

### Prerequisites
- Node.js 18+
- Wrangler CLI: `npm install -g wrangler`
- Cloudflare account (for deployment)

### 1. Install dependencies

```bash
cd apps/worker && npm install
cd ../web && npm install
```

### 2. Create D1 database and KV namespace

```bash
cd apps/worker

# Create D1 database
wrangler d1 create quorum-db
# Copy the database_id from output into wrangler.toml

# Apply schema
wrangler d1 execute quorum-db --local --file=src/db/schema.sql

# Create KV namespace
wrangler kv namespace create TOPOLOGY
# Copy the id from output into wrangler.toml
```

### 3. Run the worker locally

```bash
cd apps/worker
npm run dev          # starts on http://localhost:8787
```

### 4. Run the frontend

```bash
cd apps/web
npm run dev          # starts on http://localhost:5173
```

The Vite dev server proxies `/api`, `/nodes`, and `/observer` to the local worker.

### 5. Use it

1. Open http://localhost:5173
2. Pick **Raft**, 3 nodes, select some regions, click **Launch Simulation**
3. Watch the leader election happen in the graph within ~300ms
4. Use **Partition Selected** to isolate a node — watch the leader re-elect
5. Click **Heal All** to restore connectivity
6. Try **Inject Command** (e.g. `SET counter=42`) and watch log replication

---

## Deployment

```bash
# Deploy worker
cd apps/worker
wrangler deploy

# Build and deploy frontend to Cloudflare Pages
cd apps/web
npm run build
wrangler pages deploy dist --project-name quorum-web
```

---

## Analytics

The frontend sends product analytics to PostHog (`apps/web/src/lib/analytics.ts`). It only runs on production builds served from a real host; set `VITE_POSTHOG_DEV=1` to test locally. The public project key lives in `apps/web/.env.production`.

Events go through a same-origin `/ingest` reverse proxy so ad blockers don't drop them: `apps/web/functions/ingest/[[path]].ts` (Cloudflare Pages Function, deployed automatically by `wrangler pages deploy`), the `/ingest/*` route in the worker, and the Vite dev/preview proxy locally. Session replays mask all inputs.

---

## Reading the Latency Heatmap

The heatmap shows **average round-trip latency** for messages between each pair of nodes over the last 10 seconds.

| Color | Meaning |
|-------|---------|
| Green | < 50ms (same or nearby PoP) |
| Yellow | 50–150ms (cross-region) |
| Red | > 150ms (high latency or congested) |
| ✗ (dark red) | Partitioned — no messages flowing |
| · (grey) | No messages in last 10s |

Cross-PoP messages (e.g. `wnam` → `apac`) will show ~120–200ms — this is real Cloudflare edge-to-edge latency.

---

## Project Structure

```
quorum/
├── apps/
│   ├── worker/            Cloudflare Workers backend
│   │   └── src/
│   │       ├── index.ts            Hono router
│   │       ├── algorithms/
│   │       │   ├── raft.ts         RaftNodeDO
│   │       │   ├── crdt.ts         CrdtReplicaDO
│   │       │   └── gossip.ts       GossipNodeDO
│   │       ├── observer.ts         ObserverDO (WebSocket fan-out)
│   │       ├── simulation.ts       SimulationDO (metadata)
│   │       ├── partition.ts        Partition manager
│   │       ├── types.ts            Shared types + Zod schemas
│   │       └── db/
│   │           ├── schema.sql      D1 schema
│   │           └── queries.ts      D1 helpers
│   └── web/               React + D3 + Tailwind frontend
│       └── src/
│           ├── pages/
│           │   ├── Home.tsx        Algorithm picker
│           │   └── Simulation.tsx  Live visualization
│           ├── components/
│           │   ├── NetworkGraph.tsx     D3 force-directed graph
│           │   ├── EventLog.tsx         Real-time event table
│           │   ├── NodeDetail.tsx       Per-node state inspector
│           │   ├── ControlPanel.tsx     Partition / inject / kill
│           │   ├── LatencyHeatmap.tsx   Node×Node latency grid
│           │   └── AlgorithmExplainer.tsx
│           ├── hooks/
│           │   ├── useSimulation.ts    Zustand store + WS
│           │   └── useD3Network.ts     D3 force simulation
│           └── lib/
│               ├── api.ts          API client + types
│               └── colors.ts       Role → color mapping
└── package.json
```
