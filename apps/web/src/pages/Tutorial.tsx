import { useState } from "react";
import { Link } from "react-router-dom";

// ── Primitives ─────────────────────────────────────────────────────────────────

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: color + "25", color, border: `1px solid ${color}50` }}
    >
      {children}
    </span>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-green-300">
      {children}
    </code>
  );
}

function Callout({
  kind = "info",
  children,
}: {
  kind?: "info" | "tip" | "warn";
  children: React.ReactNode;
}) {
  const styles = {
    info: { bg: "#1e3a5f", border: "#2563eb", icon: "ℹ", text: "#93c5fd" },
    tip:  { bg: "#14532d30", border: "#16a34a", icon: "✓", text: "#86efac" },
    warn: { bg: "#431407", border: "#c2410c", icon: "⚡", text: "#fdba74" },
  };
  const s = styles[kind];
  return (
    <div
      className="flex gap-3 rounded-xl px-4 py-3 text-sm"
      style={{ background: s.bg + "40", borderLeft: `3px solid ${s.border}` }}
    >
      <span style={{ color: s.border }} className="font-bold shrink-0">{s.icon}</span>
      <div style={{ color: s.text }}>{children}</div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
          {n}
        </div>
        <div className="w-px flex-1 bg-slate-800 mt-2" />
      </div>
      <div className="pb-8 flex-1 min-w-0">
        <p className="font-semibold text-white mb-2">{title}</p>
        <div className="text-slate-400 text-sm space-y-2">{children}</div>
      </div>
    </div>
  );
}

// ── Node mock (matches real graph colours) ────────────────────────────────────

function NodeDot({ role }: { role: "leader" | "candidate" | "follower" | "replica" }) {
  const color = { leader: "#f97316", candidate: "#eab308", follower: "#3b82f6", replica: "#a855f7" }[role];
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold text-white align-middle"
      style={{ background: color }}
    >
      {role[0].toUpperCase()}
    </span>
  );
}

// ── Interactive UI diagram ────────────────────────────────────────────────────

function UIDiagram() {
  const [hover, setHover] = useState<string | null>(null);

  const zones = [
    {
      id: "controls",
      label: "① Controls",
      color: "#3b82f6",
      pos: "top-0 left-0 w-[30%] h-full",
      desc: "Partition nodes, heal partitions, inject commands, kill/restart nodes.",
    },
    {
      id: "graph",
      label: "② Network Graph",
      color: "#a855f7",
      pos: "top-0 left-[30%] w-[42%] h-[70%]",
      desc: "Live D3 force graph. Nodes coloured by role. Animated dots = messages in flight. Click a node to inspect it.",
    },
    {
      id: "heatmap",
      label: "③ Latency Heatmap",
      color: "#22c55e",
      pos: "top-[70%] left-[30%] w-[42%] h-[30%]",
      desc: "Average RTT between each node pair over the last 10s. Green<50ms · Yellow 50–150ms · Red >150ms · ✗ = partitioned.",
    },
    {
      id: "detail",
      label: "④ Node Detail",
      color: "#f97316",
      pos: "top-0 right-0 w-[28%] h-[45%]",
      desc: "Click any node to see its internal state — Raft log, CRDT registers, Gossip rumors, current role and term.",
    },
    {
      id: "log",
      label: "⑤ Event Log",
      color: "#eab308",
      pos: "top-[45%] right-0 w-[28%] h-[55%]",
      desc: "Live stream of the last 200 events. Colour-coded: red=dropped, orange=election, green=commit, blue=replicated.",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900" style={{ height: 260 }}>
        {/* Topbar mock */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-slate-800 border-b border-slate-700 flex items-center px-3 gap-3 z-10">
          <span className="text-slate-500 text-xs">← Back</span>
          <span className="text-slate-600 text-xs font-mono">raft-abc… · 3 nodes</span>
          <span className="ml-auto text-xs text-green-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Live
          </span>
        </div>

        {/* Zones */}
        {zones.map((z) => (
          <div
            key={z.id}
            className={`absolute ${z.pos} border-2 rounded transition-all cursor-pointer`}
            style={{
              top: `calc(${z.pos.includes("top-[70%]") ? "70%" : z.pos.includes("top-[45%]") ? "45%" : "0%"} + 32px)`,
              height: z.pos.includes("h-full") ? "calc(100% - 32px)" : z.pos.includes("h-[30%]") ? "30%" : z.pos.includes("h-[70%]") ? "calc(70% - 32px + 32px - 32px)" : z.pos.includes("h-[45%]") ? "45%" : "55%",
              left: z.pos.includes("left-0") ? 0 : z.pos.includes("left-[30%]") ? "30%" : "auto",
              right: z.pos.includes("right-0") ? 0 : "auto",
              width: z.pos.includes("w-[30%]") ? "30%" : z.pos.includes("w-[42%]") ? "42%" : "28%",
              borderColor: hover === z.id ? z.color : z.color + "50",
              background: hover === z.id ? z.color + "15" : "transparent",
            }}
            onMouseEnter={() => setHover(z.id)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className="absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: z.color + "30", color: z.color }}
            >
              {z.label}
            </span>
          </div>
        ))}
      </div>

      {/* Description of hovered zone */}
      <div className="min-h-[2.5rem] px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-400 transition-all">
        {hover
          ? zones.find((z) => z.id === hover)?.desc
          : "Hover a zone above to learn what it does."}
      </div>
    </div>
  );
}

// ── Accordion FAQ ─────────────────────────────────────────────────────────────

function FAQ({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-white hover:bg-slate-800 transition-colors"
      >
        {q}
        <span className={`text-slate-500 text-lg leading-none ml-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      </button>
      {open && (
        <div className="px-5 pb-4 pt-1 text-sm text-slate-400 border-t border-slate-800">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Section shell ─────────────────────────────────────────────────────────────

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-24">{children}</section>;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const NAV = [
  { id: "what-is-it", label: "What is Quorum?" },
  { id: "ui",         label: "Understanding the UI" },
  { id: "raft",       label: "Raft walkthrough" },
  { id: "crdt",       label: "CRDT walkthrough" },
  { id: "gossip",     label: "Gossip walkthrough" },
  { id: "partitions", label: "Partition experiments" },
  { id: "compare",    label: "Algorithm comparison" },
  { id: "faq",        label: "FAQ" },
];

export default function Tutorial() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── Sticky topbar ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link to="/" className="text-slate-500 hover:text-white text-sm transition-colors shrink-0">
            ← Quorum
          </Link>
          <span className="text-slate-700">|</span>
          <span className="font-semibold text-sm">Tutorial & Guide</span>
          <nav className="hidden md:flex gap-5 text-xs text-slate-500 ml-6 overflow-x-auto">
            {NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`} className="hover:text-white whitespace-nowrap transition-colors">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex-1" />
          <Link
            to="/"
            className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
          >
            Launch Simulation
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-16 flex gap-12">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className="hidden xl:block w-48 shrink-0">
          <div className="sticky top-24 space-y-1 text-sm">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="block py-1.5 pl-3 text-slate-500 hover:text-white border-l-2 border-transparent hover:border-blue-500 transition-colors"
              >
                {n.label}
              </a>
            ))}
            <div className="pt-6">
              <Link
                to="/"
                className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors"
              >
                Launch Simulation →
              </Link>
            </div>
          </div>
        </aside>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 space-y-24">

          {/* ─── HERO ─────────────────────────────────────────────────────── */}
          <div className="space-y-6">
            <Tag color="#3b82f6">Interactive Sandbox</Tag>
            <h1 className="text-4xl font-black leading-tight">
              Build intuition for<br />distributed systems.
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-xl">
              Quorum runs real distributed algorithms — Raft, CRDT, Gossip — as live
              Cloudflare Durable Objects. You can partition the network, inject commands,
              crash nodes, and watch everything happen in real time.
            </p>

            {/* Quick-start cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: "⚡", title: "Watch elections", desc: "A Raft leader appears within 800ms of starting" },
                { icon: "✂", title: "Cut the network", desc: "One click to partition. Watch split-brain prevention" },
                { icon: "✍", title: "Inject data", desc: "Write to the cluster and see replication live" },
              ].map((c) => (
                <div key={c.title} className="rounded-xl bg-slate-900 border border-slate-800 p-4 hover:border-slate-600 transition-colors">
                  <div className="text-xl mb-2">{c.icon}</div>
                  <div className="font-semibold text-sm text-white mb-1">{c.title}</div>
                  <div className="text-xs text-slate-500">{c.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── WHAT IS IT ───────────────────────────────────────────────── */}
          <Section id="what-is-it">
            <h2 className="text-2xl font-bold mb-6 pb-3 border-b border-slate-800">What is Quorum?</h2>
            <div className="space-y-4 text-slate-400">
              <p>
                Most distributed systems demos run everything in a single process pretending to be multiple nodes.
                Quorum is different: <strong className="text-white">each algorithm node is a separate Cloudflare Durable Object</strong>,
                a real isolated runtime with its own storage, running in an actual geographic region (US West, EU, Asia-Pacific, etc.).
              </p>
              <p>
                Messages between nodes are real HTTP calls crossing real networks. When you select "wnam" and "apac"
                as regions in production, your Raft heartbeats travel from a US data centre to one in Singapore.
                Latency is real. Failures are real. The 50ms heartbeat has to beat a 400–800ms election timeout.
              </p>

              {/* Algorithm matrix */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                {[
                  { name: "Raft", cap: "CP", capColor: "#f97316", model: "Strong consistency", when: "Databases, config stores, distributed locks" },
                  { name: "CRDT", cap: "AP", capColor: "#a855f7", model: "Eventual consistency", when: "Collaborative editing, counters, shopping carts" },
                  { name: "Gossip", cap: "AP", capColor: "#22c55e", model: "Epidemic spread", when: "Service discovery, health checking, cluster membership" },
                ].map((a) => (
                  <div key={a.name} className="rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{a.name}</span>
                      <Tag color={a.capColor}>{a.cap}</Tag>
                    </div>
                    <div className="text-xs text-slate-400">{a.model}</div>
                    <div className="text-xs text-slate-600 border-t border-slate-800 pt-2 mt-2">{a.when}</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* ─── UI GUIDE ─────────────────────────────────────────────────── */}
          <Section id="ui">
            <h2 className="text-2xl font-bold mb-6 pb-3 border-b border-slate-800">Understanding the UI</h2>

            <div className="space-y-8">
              <UIDiagram />

              {/* Panel explanations */}
              <div className="space-y-6">
                {[
                  {
                    num: "①", label: "Controls (left sidebar)", color: "#3b82f6",
                    items: [
                      ["Node checkboxes 0 1 2", "Toggle which nodes to isolate before clicking Partition Selected"],
                      ["Partition Selected", "Cuts the network symmetrically — both sides cannot reach each other. Edges turn dashed red."],
                      ["Heal All", "Restores full connectivity between all nodes."],
                      ["Inject command", "Raft: type SET key=value. CRDT/Gossip: type a key and value. The worker auto-redirects to the leader."],
                      ["✗ / ↺", "Kill (stops alarm = crash) and Restart a specific node."],
                    ],
                  },
                  {
                    num: "②", label: "Network Graph (centre)", color: "#a855f7",
                    items: [
                      ["Node colours", "Orange = Leader, Yellow = Candidate, Blue = Follower, Purple = Replica (CRDT/Gossip)"],
                      ["Moving dots", "Green dot = message sent (speed reflects latency). Red dot = message dropped (timeout or partition)."],
                      ["Dashed red edges", "Active partition between those two nodes."],
                      ["Click a node", "Opens the Node Detail panel in the right sidebar."],
                      ["Drag / scroll", "Drag nodes to rearrange. Scroll to zoom. Nodes remember their dragged position."],
                    ],
                  },
                  {
                    num: "③", label: "Latency Heatmap (below graph)", color: "#22c55e",
                    items: [
                      ["Rows = from, Cols = to", "Each cell is the average round-trip for messages between that node pair in the last 10s."],
                      ["Green < 50ms", "Same or nearby PoP. In local dev everything is green since all nodes are on localhost."],
                      ["Yellow 50–150ms", "Cross-region in production."],
                      ["Red > 150ms", "High latency — distant regions or congestion."],
                      ["✗ (dark red)", "Partitioned — no messages are flowing at all."],
                    ],
                  },
                  {
                    num: "④", label: "Node Detail (right, top)", color: "#f97316",
                    items: [
                      ["Raft node", "Role, term, votedFor, commitIndex, full log with green checkmarks for committed entries."],
                      ["CRDT replica", "Register table: key, value, Lamport timestamp, origin node. Vector clock summary."],
                      ["Gossip node", "Local data, version numbers, infectionCount, peer list."],
                    ],
                  },
                  {
                    num: "⑤", label: "Event Log (right, bottom)", color: "#eab308",
                    items: [
                      ["Red events", "Dropped messages (partition or timeout)."],
                      ["Orange events", "Election events (election started, leader elected)."],
                      ["Green events", "Committed log entries."],
                      ["Blue events", "Replicated messages (AppendEntries, gossip push)."],
                    ],
                  },
                ].map((panel) => (
                  <div key={panel.num} className="flex gap-4">
                    <span
                      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: panel.color + "20", color: panel.color, border: `1px solid ${panel.color}40` }}
                    >
                      {panel.num}
                    </span>
                    <div className="flex-1">
                      <div className="font-semibold text-white text-sm mb-2">{panel.label}</div>
                      <div className="space-y-1.5">
                        {panel.items.map(([key, val]) => (
                          <div key={key} className="flex gap-2 text-xs">
                            <span className="shrink-0 font-medium text-slate-300 min-w-[120px]">{key}</span>
                            <span className="text-slate-500">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* ─── RAFT ─────────────────────────────────────────────────────── */}
          <Section id="raft">
            <h2 className="text-2xl font-bold mb-2 pb-3 border-b border-slate-800">Raft Consensus — walkthrough</h2>
            <p className="text-slate-500 text-sm mb-8">
              Strong consistency. One leader per term. All writes go through the leader and are committed only after a majority of nodes replicate them.
            </p>

            <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 mb-8 flex gap-6 text-xs">
              {[
                ["Election timeout", "400–800ms (randomised)"],
                ["Heartbeat interval", "50ms"],
                ["Majority needed", "⌊N/2⌋ + 1 nodes"],
                ["Consistency", "Linearisable"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-slate-500 mb-0.5">{k}</div>
                  <div className="text-white font-semibold">{v}</div>
                </div>
              ))}
            </div>

            <div className="space-y-0">
              <Step n={1} title="Start a Raft simulation">
                <p>Home page → <strong className="text-white">Raft Consensus</strong> → <strong className="text-white">3 nodes</strong> → pick any regions → <strong className="text-white">Launch Simulation</strong>.</p>
                <Callout kind="tip">Start with 3 nodes. Majority = 2, so the maths is easy to reason about.</Callout>
              </Step>
              <Step n={2} title="Watch the election happen">
                <p>Within <strong className="text-white">400–800ms</strong> one node turns <NodeDot role="leader" /> <span className="text-orange-400">orange (Leader)</span>. The other two turn <NodeDot role="follower" /> <span className="text-blue-400">blue (Follower)</span>.</p>
                <p>Check the Event Log for a <Code>leader_elected</Code> row. A toast also appears: <em className="text-slate-300">"Node X elected leader (term 1)"</em>.</p>
              </Step>
              <Step n={3} title="Inspect the leader">
                <p>Click the orange node. The Node Detail panel shows:</p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li><strong className="text-white">role = LEADER</strong></li>
                  <li><strong className="text-white">term = 1</strong></li>
                  <li><strong className="text-white">commitIndex = 0</strong> (nothing committed yet)</li>
                </ul>
                <p>Now click a follower — it shows <strong className="text-white">leaderId</strong> pointing to the leader's ID.</p>
              </Step>
              <Step n={4} title="Inject a command">
                <p>In Controls → select any node from the dropdown (follower is fine, it auto-redirects) → type <Code>SET counter=1</Code> → click <strong className="text-white">Inject</strong>.</p>
                <p>Watch green dots animate along edges as the entry replicates. After ~50ms, all three nodes show <strong className="text-green-400">commitIndex = 1</strong> and the log entry marked ✓.</p>
              </Step>
              <Step n={5} title="Inject more commands and inspect the log">
                <p>Inject <Code>SET counter=2</Code>, then <Code>SET name=quorum</Code>. Click each node — all should have the same log with 3 committed entries. This is Raft's guarantee: <em className="text-slate-300">if committed, it's on every surviving node.</em></p>
              </Step>
              <Step n={6} title="Kill the leader">
                <p>In <strong className="text-white">Crash / restart node</strong>, click <strong className="text-white">✗</strong> next to the orange node. Within ~800ms a new leader emerges.</p>
                <p>The cluster is still available! 2 of 3 nodes = majority. Inject another command — it works.</p>
                <Callout kind="warn">If you kill 2 of 3 nodes, no majority exists and the cluster stalls. No writes will be committed. This is intentional — Raft prefers safety over availability.</Callout>
              </Step>
              <Step n={7} title="Restart the dead node">
                <p>Click <strong className="text-white">↺</strong> next to the crashed node. It restarts as a follower, learns who the leader is via heartbeats, and syncs any log entries it missed. Click it — its log now matches everyone else.</p>
              </Step>
              <Step n={8} title="Partition experiment">
                <p>Select <strong className="text-white">node 0</strong> only → click <strong className="text-white">Partition Selected</strong>. The edge to node 0 turns dashed red.</p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li>Inject a command. The 2 remaining nodes commit it (majority).</li>
                  <li>Node 0 cannot commit — it has no majority alone.</li>
                  <li>Click <strong className="text-white">Heal All</strong> — node 0 rejoins and its log is overwritten by the leader's authoritative log.</li>
                </ul>
                <Callout kind="tip">This is split-brain prevention in action. Raft never allows two leaders to commit simultaneously. Node 0 simply stalls until connectivity is restored.</Callout>
              </Step>
            </div>
          </Section>

          {/* ─── CRDT ─────────────────────────────────────────────────────── */}
          <Section id="crdt">
            <h2 className="text-2xl font-bold mb-2 pb-3 border-b border-slate-800">CRDT — walkthrough</h2>
            <p className="text-slate-500 text-sm mb-8">
              No leader, no coordination. Every write is accepted immediately by any node. State is merged via gossip using Last-Write-Wins: <strong className="text-white">higher Lamport timestamp wins</strong>. On tie, higher nodeId breaks the tie.
            </p>

            <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 mb-8 flex gap-6 text-xs">
              {[
                ["Gossip interval", "500ms"],
                ["Fanout", "2 random peers"],
                ["Merge rule", "higher timestamp wins"],
                ["Consistency", "Eventual (AP)"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-slate-500 mb-0.5">{k}</div>
                  <div className="text-white font-semibold">{v}</div>
                </div>
              ))}
            </div>

            <div className="space-y-0">
              <Step n={1} title="Start a CRDT simulation">
                <p>Pick <strong className="text-white">LWW-Register CRDT</strong> → 3 nodes → Launch.</p>
                <p>All nodes are <NodeDot role="replica" /> <span className="text-purple-400">purple (Replica)</span> — no election, no leader.</p>
              </Step>
              <Step n={2} title="Write to any node">
                <p>Key = <Code>color</Code>, value = <Code>red</Code>, inject to node 0.</p>
                <p>Within ~500ms (one gossip round), all nodes show <Code>color = red</Code> with the same Lamport timestamp.</p>
              </Step>
              <Step n={3} title="Create a partition and write conflicting values">
                <p>Partition node 0. Now:</p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li>Write <Code>color=blue</Code> to node 0 (isolated side)</li>
                  <li>Write <Code>color=green</Code> to node 1 (majority side)</li>
                </ul>
                <p>Click each node — they have different values and <em>different Lamport timestamps</em>.</p>
              </Step>
              <Step n={4} title="Heal and watch automatic merge">
                <p>Click <strong className="text-white">Heal All</strong>. Within ~500ms the conflicting values gossip across the restored link. The LWW rule applies: <strong className="text-white">whichever write happened later (higher clock) wins everywhere.</strong></p>
                <Callout kind="tip">This is convergence. No coordinator, no rollback, no error — the system resolves the conflict deterministically and automatically.</Callout>
              </Step>
              <Step n={5} title="Write to multiple independent keys">
                <p>Inject <Code>name=alice</Code> to node 0 and <Code>score=100</Code> to node 2 simultaneously. Both propagate independently and converge — CRDT supports many keys, each merging on its own clock.</p>
              </Step>
            </div>
          </Section>

          {/* ─── GOSSIP ───────────────────────────────────────────────────── */}
          <Section id="gossip">
            <h2 className="text-2xl font-bold mb-2 pb-3 border-b border-slate-800">Gossip — walkthrough</h2>
            <p className="text-slate-500 text-sm mb-8">
              Epidemic dissemination. A node that learns a new rumor tells <Code>ceil(log₂N)</Code> random peers every second. The rumor spreads exponentially and dies naturally when it has infected enough nodes.
            </p>

            <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 mb-8 flex gap-6 text-xs">
              {[
                ["Gossip interval", "1 second"],
                ["Fanout (3 nodes)", "2 peers"],
                ["Fanout (7 nodes)", "3 peers"],
                ["Consistency", "Eventual (AP)"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-slate-500 mb-0.5">{k}</div>
                  <div className="text-white font-semibold">{v}</div>
                </div>
              ))}
            </div>

            <div className="space-y-0">
              <Step n={1} title="Start with 5 nodes">
                <p>Pick <strong className="text-white">Gossip Protocol</strong> → <strong className="text-white">5 nodes</strong> → Launch. More nodes make fanout and infection count more interesting.</p>
              </Step>
              <Step n={2} title="Inject a rumor">
                <p>Key = <Code>status</Code>, value = <Code>deployed</Code>, on any node.</p>
                <p>Watch the Event Log — <Code>gossip_rumor</Code> messages fan out from the origin. Dots animate across multiple edges per second.</p>
              </Step>
              <Step n={3} title="Watch infectionCount climb">
                <p>Click the node where you injected. The <strong className="text-white">infectionCount</strong> starts at 0 and increases each round. When it hits the threshold (≈<Code>log(N)/log(fanout)</Code>), the node stops re-broadcasting — the rumor "dies."</p>
                <p>Full propagation to 5 nodes takes about 2–3 seconds (2–3 rounds × 1s interval).</p>
              </Step>
              <Step n={4} title="Partition mid-propagation">
                <p>Inject a rumor, then immediately partition 2 nodes. The rumor will reach the reachable nodes but not the isolated ones. Heal — those nodes won't automatically receive it (the rumor already died). Inject version+1 to re-propagate.</p>
                <Callout kind="info">This illustrates gossip's weakness: it's probabilistic. Under heavy partition it may not guarantee delivery. Use Raft if you need guaranteed delivery.</Callout>
              </Step>
            </div>
          </Section>

          {/* ─── PARTITIONS ───────────────────────────────────────────────── */}
          <Section id="partitions">
            <h2 className="text-2xl font-bold mb-6 pb-3 border-b border-slate-800">Partition experiments</h2>

            <div className="space-y-4">
              {[
                {
                  n: "①", color: "#ef4444",
                  title: "Raft: minority partition (safe availability)",
                  setup: "3 nodes. Partition node 0 alone.",
                  what: "Nodes 1+2 still have majority → they keep committing. Node 0 is stuck but makes no incorrect decisions.",
                  lesson: "Raft is available as long as ≥ majority survives. Minority nodes safely refuse to act.",
                },
                {
                  n: "②", color: "#f97316",
                  title: "Raft: majority partition (cluster stalls)",
                  setup: "5 nodes. Partition 3 nodes away from the other 2.",
                  what: "Neither partition has a majority (3 vs 2). No writes commit anywhere. Both sides elect candidates but neither wins.",
                  lesson: "CAP theorem in action — Raft picks consistency over availability. It stalls rather than risk committing conflicting data.",
                },
                {
                  n: "③", color: "#a855f7",
                  title: "CRDT: diverge then converge",
                  setup: "Partition cluster in half. Write different values to each side. Heal.",
                  what: "Both sides accept writes immediately. After healing, LWW merges them — the write with the higher Lamport clock wins everywhere.",
                  lesson: "AP systems are always writable. Conflict is resolved deterministically after reconnection, not prevented.",
                },
                {
                  n: "④", color: "#22c55e",
                  title: "Gossip: stale rumor problem",
                  setup: "5 nodes. Inject a rumor, wait for partial propagation, then partition 2 nodes.",
                  what: "The rumor reaches the majority side and dies there. The 2 isolated nodes never see it. After healing, they still don't — gossip doesn't re-propagate dead rumors.",
                  lesson: "Gossip guarantees delivery only with high probability. For critical data, combine with anti-entropy (periodic state sync) or use Raft instead.",
                },
              ].map((exp) => (
                <div key={exp.n} className="rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: exp.color + "20", color: exp.color }}
                    >
                      {exp.n}
                    </span>
                    <h3 className="font-semibold text-white">{exp.title}</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <div className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">Setup</div>
                      <div className="text-slate-300">{exp.setup}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">What you see</div>
                      <div className="text-slate-300">{exp.what}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">Key insight</div>
                      <div className="text-slate-300">{exp.lesson}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ─── COMPARE ──────────────────────────────────────────────────── */}
          <Section id="compare">
            <h2 className="text-2xl font-bold mb-6 pb-3 border-b border-slate-800">Algorithm comparison</h2>

            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-800">
                    <th className="text-left px-4 py-3 text-slate-400 font-semibold border-b border-r border-slate-700">Property</th>
                    <th className="text-left px-4 py-3 text-orange-400 font-semibold border-b border-r border-slate-700">Raft</th>
                    <th className="text-left px-4 py-3 text-purple-400 font-semibold border-b border-r border-slate-700">CRDT</th>
                    <th className="text-left px-4 py-3 text-green-400 font-semibold border-b border-slate-700">Gossip</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["CAP guarantee", "CP", "AP", "AP"],
                    ["Consistency model", "Linearisable", "Eventual (LWW)", "Eventual"],
                    ["Writes during partition", "Majority side only", "Any node, always", "Any node, always"],
                    ["Leader required", "Yes (one per term)", "No", "No"],
                    ["Conflict resolution", "Prevented by design", "Lamport timestamp wins", "Version number wins"],
                    ["Recovery after partition", "Instant log sync", "Auto LWW merge", "Re-broadcast needed"],
                    ["Message complexity", "O(N) per round", "O(1) gossip pairs", "O(log N) rounds total"],
                    ["Real-world use", "etcd, TiKV, CockroachDB", "Redis CRDT, Riak", "Cassandra, Consul, Kubernetes"],
                  ].map(([prop, raft, crdt, gossip], i) => (
                    <tr key={prop} className={i % 2 === 0 ? "bg-slate-950" : "bg-slate-900"}>
                      <td className="px-4 py-2.5 text-slate-400 font-medium border-r border-slate-700 text-xs">{prop}</td>
                      <td className="px-4 py-2.5 text-slate-300 border-r border-slate-700 text-xs">{raft}</td>
                      <td className="px-4 py-2.5 text-slate-300 border-r border-slate-700 text-xs">{crdt}</td>
                      <td className="px-4 py-2.5 text-slate-300 text-xs">{gossip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Callout kind="info">
              <strong>CAP Theorem:</strong> any distributed system can only guarantee 2 of 3 — Consistency, Availability, Partition tolerance. Since partition tolerance is non-negotiable in a real network, you always pick C or A. Raft picks C (safe but may stall); CRDT and Gossip pick A (always writable, eventually consistent).
            </Callout>
          </Section>

          {/* ─── FAQ ──────────────────────────────────────────────────────── */}
          <Section id="faq">
            <h2 className="text-2xl font-bold mb-6 pb-3 border-b border-slate-800">FAQ</h2>
            <div className="space-y-3">
              <FAQ q="Why do I see 'Reconnecting...' in red?">
                The WebSocket to the ObserverDO is not yet established. Give it 1–2 seconds after the simulation starts — it turns green once connected. If it keeps reconnecting, make sure the worker is running (<Code>npm run dev</Code> in <Code>apps/worker</Code>).
              </FAQ>
              <FAQ q="All my nodes are purple — no orange leader. What's wrong?">
                Purple means no state has arrived yet (WebSocket not connected, or the simulation just started). Once the WebSocket turns green ("Live"), node colours update immediately. The first Raft election takes 400–800ms.
              </FAQ>
              <FAQ q="I injected a command but got an error.">
                If the cluster is mid-election (yellow candidate nodes visible), no writes are accepted — wait ~1s for a leader to appear. The inject auto-redirects to the current leader, but if no leader exists yet, it can't commit.
              </FAQ>
              <FAQ q="Why does the leader keep changing in Raft?">
                In local dev, all nodes run on localhost with sub-millisecond latency. The randomised election timeouts (400–800ms) overlap more than they would in production where real network latency naturally staggers responses. In production with cross-region DOs the cluster is far more stable.
              </FAQ>
              <FAQ q="The latency heatmap is empty.">
                It shows a rolling 10-second average. Wait 10s after starting, or inject a few commands to generate traffic. In local dev all cells show green (&lt;10ms) since messages are on localhost.
              </FAQ>
              <FAQ q="How does inject auto-redirect work?">
                In Raft, if you target a follower the node returns HTTP 307 with the current leader's ID. The worker retries the request on the correct leader transparently — you never need to know who the leader is. For CRDT and Gossip every node accepts writes directly.
              </FAQ>
              <FAQ q="Do the regions actually mean anything?">
                In <strong>local dev</strong> (wrangler dev), all DOs are on localhost and regions are ignored. In <strong>production</strong> (after deploying to Cloudflare), DOs are placed in real geographic PoPs and cross-region messages have real latency. The heatmap becomes much more interesting in production.
              </FAQ>
              <FAQ q="What does killing a node actually do?">
                It stops the DO Alarm. For a leader this means no more heartbeats — followers will time out and elect a new leader. For a follower it freezes the election timer. The node still responds to state queries but is "frozen" in time. Restart re-activates the alarm and the node rejoins.
              </FAQ>
            </div>

            {/* CTA */}
            <div className="mt-12 rounded-2xl border border-blue-700/40 bg-blue-950/20 p-8 text-center space-y-4">
              <h3 className="text-xl font-bold">Ready to experiment?</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                The best way to build intuition is to break things. Start a Raft cluster, wait for a leader, partition it, and watch what happens.
              </p>
              <Link
                to="/"
                className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-sm transition-colors"
              >
                Launch your first simulation →
              </Link>
            </div>
          </Section>

        </main>
      </div>
    </div>
  );
}
