import { Link } from "react-router-dom";

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-6">
      {children}
    </section>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-bold text-white border-b border-slate-700 pb-3">{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold text-blue-300">{children}</h3>;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-blue-950/40 border border-blue-700/50 rounded-lg px-4 py-3 text-sm text-blue-200">
      <span className="shrink-0 text-blue-400 font-bold">ℹ</span>
      <div>{children}</div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-green-950/40 border border-green-700/50 rounded-lg px-4 py-3 text-sm text-green-200">
      <span className="shrink-0 text-green-400 font-bold">✓</span>
      <div>{children}</div>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-orange-950/40 border border-orange-700/50 rounded-lg px-4 py-3 text-sm text-orange-200">
      <span className="shrink-0 text-orange-400 font-bold">⚡</span>
      <div>{children}</div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
          {n}
        </div>
        <div className="w-px flex-1 bg-slate-700 mt-2" />
      </div>
      <div className="pb-8 flex-1">
        <div className="font-semibold text-white mb-2">{title}</div>
        <div className="text-slate-400 text-sm space-y-2">{children}</div>
      </div>
    </div>
  );
}

function UICallout({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 items-start">
      <span
        className="shrink-0 px-2 py-0.5 rounded text-xs font-bold mt-0.5"
        style={{ background: color + "33", color, border: `1px solid ${color}66` }}
      >
        {label}
      </span>
      <span className="text-slate-400 text-sm">{children}</span>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-slate-800 text-green-300 font-mono text-xs px-2 py-0.5 rounded">
      {children}
    </code>
  );
}

function AlgoCard({
  title,
  badge,
  color,
  cap,
  children,
}: {
  title: string;
  badge: string;
  color: string;
  cap: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white">{title}</h3>
        <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: color + "22", color }}>
          {badge}
        </span>
      </div>
      <div className="text-xs text-slate-500 font-mono">{cap}</div>
      <div className="text-sm text-slate-400 space-y-1">{children}</div>
    </div>
  );
}

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "ui-guide", label: "UI Guide" },
  { id: "raft", label: "Raft Walkthrough" },
  { id: "crdt", label: "CRDT Walkthrough" },
  { id: "gossip", label: "Gossip Walkthrough" },
  { id: "partitions", label: "Partition Experiments" },
  { id: "compare", label: "Algorithm Comparison" },
  { id: "tips", label: "Tips & FAQ" },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Tutorial() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-6">
          <Link to="/" className="text-slate-400 hover:text-white text-sm transition-colors">
            ← Back to Quorum
          </Link>
          <span className="text-slate-600">|</span>
          <span className="font-bold text-white">Tutorial & Guide</span>
          <div className="flex-1" />
          <nav className="hidden lg:flex gap-5 text-xs text-slate-400">
            {NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`} className="hover:text-white transition-colors">
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16 flex gap-12">
        {/* Sidebar nav (desktop) */}
        <aside className="hidden xl:block w-52 shrink-0">
          <div className="sticky top-24 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Contents
            </div>
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="block text-sm text-slate-400 hover:text-white py-1 transition-colors border-l-2 border-transparent hover:border-blue-500 pl-3"
              >
                {n.label}
              </a>
            ))}
            <div className="pt-6">
              <Link
                to="/"
                className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                Launch Simulation →
              </Link>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 max-w-3xl space-y-20">

          {/* ── OVERVIEW ───────────────────────────────────────────────────── */}
          <Section id="overview">
            <div className="space-y-4">
              <div className="inline-block px-3 py-1 rounded-full bg-blue-900/50 text-blue-300 text-xs font-semibold border border-blue-700/50">
                Interactive Sandbox
              </div>
              <h1 className="text-4xl font-bold leading-tight">
                How to use Quorum
              </h1>
              <p className="text-slate-400 text-lg leading-relaxed">
                Quorum is a real-time distributed systems sandbox. Each "node" you see is an actual
                Cloudflare Durable Object running in a geographic region. Messages fly between real
                data centers. Partitions cut real network paths.
              </p>
            </div>

            <H2>What you can do</H2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: "⚡",
                  title: "Watch elections happen",
                  desc: "See a Raft leader get elected in real time — 400–800ms after cluster starts.",
                },
                {
                  icon: "✂",
                  title: "Partition the network",
                  desc: "Isolate nodes with one click. Watch split-brain prevention, convergence, re-election.",
                },
                {
                  icon: "💬",
                  title: "Inject commands",
                  desc: "Write to the cluster. See log replication, CRDT merges, gossip spreading live.",
                },
              ].map((c) => (
                <div key={c.title} className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                  <div className="text-2xl mb-2">{c.icon}</div>
                  <div className="font-semibold text-sm mb-1">{c.title}</div>
                  <div className="text-slate-400 text-xs">{c.desc}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { algo: "Raft", model: "CP", color: "#f97316", desc: "Strong consistency" },
                { algo: "CRDT", model: "AP", color: "#a855f7", desc: "Eventual consistency" },
                { algo: "Gossip", model: "AP", color: "#22c55e", desc: "Epidemic spread" },
              ].map((a) => (
                <div key={a.algo} className="rounded-xl border border-slate-700 p-4 bg-slate-900">
                  <div className="text-2xl font-black" style={{ color: a.color }}>{a.model}</div>
                  <div className="font-bold text-sm mt-1">{a.algo}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{a.desc}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── UI GUIDE ───────────────────────────────────────────────────── */}
          <Section id="ui-guide">
            <H2>UI Guide — every panel explained</H2>

            <div className="rounded-xl border-2 border-slate-700 bg-slate-900 overflow-hidden">
              {/* Mock topbar */}
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 border-b border-slate-700">
                <span className="text-slate-500 text-sm">← Back</span>
                <span className="font-mono text-xs text-slate-500">raft-3a7b…  </span>
                <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded font-semibold">RAFT · 3 nodes</span>
                <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Live
                </span>
              </div>
              {/* Mock layout */}
              <div className="grid grid-cols-[10rem_1fr_12rem] min-h-[200px] text-xs">
                <div className="border-r border-slate-700 p-3 text-slate-500">
                  <div className="text-blue-400 font-semibold mb-2">① Left Sidebar</div>
                  Controls + Algorithm Explainer
                </div>
                <div className="p-3 text-center flex flex-col items-center justify-center gap-2 text-slate-500">
                  <div className="text-purple-400 font-semibold">② Center Graph</div>
                  <div className="text-xs">D3 force graph<br />of live nodes</div>
                  <div className="text-slate-600 text-xs mt-2">↓ Latency Heatmap</div>
                </div>
                <div className="border-l border-slate-700 p-3 text-slate-500">
                  <div className="text-orange-400 font-semibold mb-2">③ Right Sidebar</div>
                  Node Detail + Event Log
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <H3>① Left sidebar — Controls</H3>
              <div className="space-y-3">
                <UICallout label="Node selector" color="#3b82f6">
                  Checkboxes <Code>0 1 2</Code> — toggle which nodes to isolate before clicking
                  <strong className="text-white"> Partition Selected</strong>.
                </UICallout>
                <UICallout label="Partition Selected" color="#ef4444">
                  Cuts the network between selected nodes and the rest. Both sides of the cut are
                  blocked — symmetric partition. The edges turn <span className="text-red-400">dashed red</span> in the graph.
                </UICallout>
                <UICallout label="Heal All" color="#22c55e">
                  Restores full connectivity. Every node can reach every other node again.
                </UICallout>
                <UICallout label="Inject command" color="#3b82f6">
                  <strong className="text-white">Raft:</strong> type a command like <Code>SET counter=42</Code>.
                  The worker auto-redirects to the current leader even if you pick a follower.
                  <br />
                  <strong className="text-white">CRDT:</strong> enter a key + value pair.
                  <br />
                  <strong className="text-white">Gossip:</strong> enter a key + value — becomes a rumor that spreads.
                </UICallout>
                <UICallout label="✗ / ↺ buttons" color="#94a3b8">
                  Kill (stop DO alarm — simulates a crash) and Restart a specific node.
                </UICallout>
              </div>

              <H3>② Center — Network Graph</H3>
              <div className="space-y-3">
                <UICallout label="Node circles" color="#a855f7">
                  Colour = role. <span className="text-orange-400 font-semibold">Orange = Leader</span>,{" "}
                  <span className="text-yellow-400 font-semibold">Yellow = Candidate</span>,{" "}
                  <span className="text-blue-400 font-semibold">Blue = Follower</span>,{" "}
                  <span className="text-purple-400 font-semibold">Purple = Replica/CRDT/Gossip</span>.
                  Click any node to open the Node Detail panel.
                </UICallout>
                <UICallout label="Moving dots" color="#22c55e">
                  A <span className="text-green-400">green dot</span> moves along an edge each time a message is sent — speed reflects the actual latency.
                  A <span className="text-red-400">red dot</span> means the message was dropped (partition or timeout).
                </UICallout>
                <UICallout label="Dashed red edges" color="#ef4444">
                  Appear when a partition is active between those two nodes. No messages flow across them.
                </UICallout>
                <UICallout label="Drag & zoom" color="#64748b">
                  Drag nodes to rearrange. Scroll to zoom. Pinch on trackpad.
                </UICallout>
              </div>

              <H3>③ Right sidebar — Node Detail + Event Log</H3>
              <div className="space-y-3">
                <UICallout label="Node Detail" color="#f97316">
                  Click any node in the graph to open this panel.
                  <br />
                  <strong className="text-white">Raft:</strong> shows term, role, commit index, full log with committed entries highlighted green.
                  <br />
                  <strong className="text-white">CRDT:</strong> shows register table (key, value, Lamport timestamp, origin node) and vector clock.
                  <br />
                  <strong className="text-white">Gossip:</strong> shows local data, version numbers, infection count.
                </UICallout>
                <UICallout label="Event Log" color="#3b82f6">
                  Live scrolling table of the last 200 events — sorted newest-first.
                  <span className="text-red-400"> Red</span> = dropped/partition,
                  <span className="text-orange-400"> orange</span> = election,
                  <span className="text-green-400"> green</span> = committed,
                  <span className="text-blue-400"> blue</span> = replicated.
                </UICallout>
              </div>

              <H3>Latency Heatmap (below graph)</H3>
              <UICallout label="Grid cells" color="#94a3b8">
                Each cell = average round-trip latency in the last 10s between that node pair.
                <span className="text-green-400"> Green &lt; 50ms</span>,
                <span className="text-yellow-400"> yellow 50–150ms</span>,
                <span className="text-red-400"> red &gt; 150ms</span>,
                <span className="text-red-600"> ✗ = partitioned</span>.
                In production, cross-PoP cells (e.g. wnam→apac) show ~120–200ms real latency.
              </UICallout>
            </div>
          </Section>

          {/* ── RAFT ───────────────────────────────────────────────────────── */}
          <Section id="raft">
            <H2>Raft Consensus — Step-by-step walkthrough</H2>

            <AlgoCard title="Raft" badge="CP System" color="#f97316" cap="CAP: Consistent + Partition-tolerant">
              <p>Strong consistency: all reads and writes go through a single leader. Log entries are committed only after a majority of nodes acknowledge them. If the leader dies, a new election happens within ~800ms.</p>
              <p className="text-slate-500 mt-1">Reference: Ongaro & Ousterhout, "In Search of an Understandable Consensus Algorithm" (2014)</p>
            </AlgoCard>

            <Note>
              Start with <strong>3 nodes</strong> so the majority quorum is 2. Every write
              needs 2 of 3 nodes to acknowledge before it is committed.
            </Note>

            <div className="space-y-0">
              <Step n={1} title="Start the simulation">
                <p>On the home page, pick <strong>Raft Consensus</strong>, choose <strong>3 nodes</strong>, select at least 2 regions (e.g. <Code>wnam</Code> + <Code>weur</Code>), and click <strong>Launch Simulation</strong>.</p>
              </Step>
              <Step n={2} title="Watch the leader election">
                <p>Within about <strong>400–800ms</strong> one node turns <span className="text-orange-400 font-semibold">orange</span> — that's the elected leader. The other two turn <span className="text-blue-400 font-semibold">blue</span> (followers).</p>
                <p>Check the <strong>Event Log</strong> for a <Code>leader_elected</Code> event. A toast notification also pops up: <em>"Node X elected leader (term 1)"</em>.</p>
                <Tip>Click the orange node to open Node Detail. You'll see <strong>role=LEADER</strong>, <strong>term=1</strong>, and <strong>commitIndex=0</strong>.</Tip>
              </Step>
              <Step n={3} title="Inject a command">
                <p>In the Control Panel, select any node (even a follower) from the dropdown, type <Code>SET counter=1</Code> in the command box, and click <strong>Inject</strong>.</p>
                <p>The worker automatically redirects to the leader if you pick a follower — you'll see a green dot animate along edges as the log entry replicates to both followers.</p>
              </Step>
              <Step n={4} title="Verify replication in Node Detail">
                <p>Click each node in the graph. All three should show:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong className="text-green-300">commitIndex = 1</strong></li>
                  <li><strong className="text-green-300">log[0] = "SET counter=1" ✓</strong> (green = committed)</li>
                </ul>
                <p>Inject <Code>SET counter=2</Code> then <Code>SET counter=3</Code>. Each commit increments all nodes' log simultaneously.</p>
              </Step>
              <Step n={5} title="Kill the leader (crash simulation)">
                <p>In the <strong>Crash / restart node</strong> section, click the <strong>✗</strong> button next to whichever node is currently the leader.</p>
                <p>Watch the two remaining nodes — within ~800ms one of them turns orange. A new election has completed. The cluster is still serving writes with just 2 of 3 nodes.</p>
                <Warning>The dead leader's alarms are stopped. It won't vote or respond. This is exactly what happens in production when a server crashes.</Warning>
              </Step>
              <Step n={6} title="Restart the dead node">
                <p>Click the <strong>↺</strong> button for the crashed node. It restarts as a <span className="text-blue-400">follower</span>, learns the current leader via heartbeats, and catches up with the log it missed.</p>
                <p>Click it in the graph — its log should now match the other nodes' <strong>commitIndex</strong>.</p>
              </Step>
              <Step n={7} title="Create a partition and observe split-brain prevention">
                <p>With 3 nodes, select <strong>node 0</strong> in the partition selector and click <strong>Partition Selected</strong>. Now node 0 is isolated.</p>
                <p>Inject <Code>SET x=isolated</Code>. Because the remaining 2 nodes form a majority, they <em>can</em> commit it. Node 0 cannot commit anything — it can't reach a majority.</p>
                <p>Click <strong>Heal All</strong> — node 0 rejoins and its log is overwritten with the leader's authoritative log. <strong>No split-brain ever happens.</strong></p>
              </Step>
            </div>
          </Section>

          {/* ── CRDT ───────────────────────────────────────────────────────── */}
          <Section id="crdt">
            <H2>LWW-Register CRDT — Step-by-step walkthrough</H2>

            <AlgoCard title="CRDT (Last-Write-Wins Register)" badge="AP System" color="#a855f7" cap="CAP: Available + Partition-tolerant">
              <p>No leader, no coordination. Each node accepts writes at any time. State is merged via gossip every 500ms using a simple rule: <strong>higher Lamport timestamp wins</strong>. On tie: higher nodeId wins.</p>
              <p className="text-slate-500 mt-1">Convergence is mathematically guaranteed — all nodes eventually agree even if partitioned for hours.</p>
            </AlgoCard>

            <div className="space-y-0">
              <Step n={1} title="Start a CRDT simulation">
                <p>Pick <strong>LWW-Register CRDT</strong>, <strong>3 nodes</strong>, select regions. The nodes start gossipping immediately — no election needed.</p>
              </Step>
              <Step n={2} title="Write to a node">
                <p>Select any node, enter key <Code>color</Code> and value <Code>red</Code>, click <strong>Inject</strong>.</p>
                <p>Within 500ms (one gossip round) all nodes have <Code>color=red</Code>. Click each node to see the register table with the same timestamp.</p>
              </Step>
              <Step n={3} title="Demonstrate convergence under partition">
                <p>Partition node 0. Now write <Code>color=blue</Code> to node 0, and <Code>color=green</Code> to node 1.</p>
                <p>While partitioned, nodes 0, 1, 2 have <em>different</em> values for <Code>color</Code>. Click each to confirm — the Lamport timestamps will differ.</p>
              </Step>
              <Step n={4} title="Heal and observe automatic merge">
                <p>Click <strong>Heal All</strong>. Within 500–1000ms, gossip propagates the conflicting values. The LWW rule resolves automatically: <strong>the write with the highest timestamp wins across all nodes</strong>.</p>
                <Tip>Compare timestamps in the register table. Whichever write happened <em>last</em> (highest Lamport clock) wins — regardless of which node it came from.</Tip>
              </Step>
              <Step n={5} title="Write to multiple keys">
                <p>Inject different keys: <Code>name=alice</Code> on node 0, <Code>score=100</Code> on node 1. Each key is independent — they all converge simultaneously.</p>
              </Step>
            </div>

            <Note>
              Unlike Raft, CRDT writes are <strong>always accepted</strong> — even during partition. The trade-off is <em>eventual</em> rather than <em>immediate</em> consistency. Last writer wins, so concurrent conflicting writes are resolved deterministically.
            </Note>
          </Section>

          {/* ── GOSSIP ─────────────────────────────────────────────────────── */}
          <Section id="gossip">
            <H2>Gossip Protocol — Step-by-step walkthrough</H2>

            <AlgoCard title="Rumor-Mongering Gossip" badge="AP System" color="#22c55e" cap="O(log N) dissemination rounds">
              <p>Like an epidemic. Each node that has a new rumor tells <Code>ceil(log₂N)</Code> random neighbors every second. A rumor naturally "dies" once it has spread enough — tracked by <strong>infectionCount</strong>.</p>
              <p className="text-slate-500 mt-1">With 3 nodes: fanout=2, threshold≈2. With 7 nodes: fanout=3, threshold≈2.8.</p>
            </AlgoCard>

            <div className="space-y-0">
              <Step n={1} title="Start a Gossip simulation">
                <p>Pick <strong>Gossip Protocol</strong>, <strong>5 nodes</strong> (more interesting with higher N), select regions.</p>
              </Step>
              <Step n={2} title="Inject a rumor">
                <p>Select any node, enter key <Code>alert</Code> and value <Code>deploy-complete</Code>. Click <strong>Inject</strong>.</p>
                <p>Watch the Event Log — you'll see <Code>gossip_rumor</Code> messages fanning out. Green dots animate along edges as the rumor spreads from node to node.</p>
              </Step>
              <Step n={3} title="Watch infectionCount">
                <p>Click the node where you injected. Its <strong>infectionCount</strong> starts at 0 and climbs with each round. When it hits the threshold (~log(N)/log(fanout)), the rumor stops being re-broadcast.</p>
              </Step>
              <Step n={4} title="Observe O(log N) spread">
                <p>Inject a new rumor and watch the Event Log timestamps. With 5 nodes, full propagation takes about <strong>2–3 seconds</strong> (2–3 gossip rounds × 1s interval). With 7 nodes it's still only 3–4 rounds — this is the power of epidemic algorithms.</p>
              </Step>
              <Step n={5} title="Partition during propagation">
                <p>Inject a rumor, then immediately partition node 4. The rumor reaches the non-partitioned side. Nodes 0–3 see it; node 4 doesn't.</p>
                <p>Heal the partition — node 4 doesn't automatically re-gossip old rumors (the rumor is "dead"). To re-propagate, inject a new version of the rumor with a higher version number.</p>
              </Step>
            </div>
          </Section>

          {/* ── PARTITION EXPERIMENTS ─────────────────────────────────────── */}
          <Section id="partitions">
            <H2>Partition Experiments</H2>
            <p className="text-slate-400">
              Network partitions are the most interesting thing to test. Here are specific scenarios to try — each teaches something different about distributed systems.
            </p>

            <div className="space-y-6">
              <div className="bg-slate-900 rounded-xl border border-slate-700 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-red-400 font-bold text-lg">①</span>
                  <H3>Raft minority partition (safe)</H3>
                </div>
                <p className="text-sm text-slate-400">With 3 nodes, isolate <strong>1 node</strong>. The other 2 still form a majority and can commit. The isolated node can't commit anything — it's "safe" by refusing to act without quorum.</p>
                <div className="bg-slate-800 rounded p-3 text-xs font-mono text-slate-300">
                  Partition: [node-0]<br />
                  → node-0: can't commit (only 1 of 3 = minority)<br />
                  → node-1 + node-2: still commit (2 of 3 = majority) ✓
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl border border-slate-700 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-red-400 font-bold text-lg">②</span>
                  <H3>Raft majority partition (cluster stalls)</H3>
                </div>
                <p className="text-sm text-slate-400">With 5 nodes, isolate <strong>3 nodes</strong>. Now neither partition has a majority (3 vs 2). The entire cluster stalls — no writes can be committed by either side. This is CAP theorem in action: Raft chooses <strong>consistency over availability</strong>.</p>
                <Warning>
                  Try injecting a command during this partition. You'll see every node either reject it or fail to replicate. The event log goes quiet on commit events.
                </Warning>
              </div>

              <div className="bg-slate-900 rounded-xl border border-slate-700 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-red-400 font-bold text-lg">③</span>
                  <H3>CRDT partition — diverge then converge</H3>
                </div>
                <p className="text-sm text-slate-400">This is where CRDT shines. Partition the cluster in half. Write different values to each partition. Both sides accept writes immediately. Heal — watch all nodes converge to the same state via the LWW rule.</p>
                <div className="bg-slate-800 rounded p-3 text-xs font-mono text-slate-300 space-y-0.5">
                  <div>Partition: [0,1] | [2,3,4]</div>
                  <div>Write color=red to node-0  (ts=5)</div>
                  <div>Write color=blue to node-2 (ts=7)</div>
                  <div>Heal → all nodes: color=blue (ts=7 wins) ✓</div>
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl border border-slate-700 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-red-400 font-bold text-lg">④</span>
                  <H3>Gossip partition — stale rumor problem</H3>
                </div>
                <p className="text-sm text-slate-400">Inject a high-version rumor, let it propagate to 3 of 5 nodes, then immediately partition those 3. The 2 isolated nodes never see the rumor (it died before reaching them). After healing, inject version+1 to force re-spread.</p>
              </div>
            </div>
          </Section>

          {/* ── COMPARE ────────────────────────────────────────────────────── */}
          <Section id="compare">
            <H2>Algorithm Comparison</H2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-800">
                    <th className="text-left px-4 py-3 text-slate-400 font-semibold border border-slate-700">Property</th>
                    <th className="text-left px-4 py-3 text-orange-400 font-semibold border border-slate-700">Raft</th>
                    <th className="text-left px-4 py-3 text-purple-400 font-semibold border border-slate-700">CRDT</th>
                    <th className="text-left px-4 py-3 text-green-400 font-semibold border border-slate-700">Gossip</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {[
                    ["CAP trade-off", "CP (strong)", "AP (eventual)", "AP (eventual)"],
                    ["Consistency model", "Linearisable", "Eventual (LWW)", "Eventual"],
                    ["Writes during partition", "Only majority side", "Always accepted", "Always accepted"],
                    ["Needs a leader", "Yes", "No", "No"],
                    ["Coordination overhead", "High", "Low", "Very low"],
                    ["Conflict resolution", "Prevented by design", "LWW (timestamp)", "Version number"],
                    ["Recovery after partition", "Instant (log sync)", "Auto-merge", "Re-broadcast"],
                    ["Scales to N nodes", "O(N) RPCs/round", "O(1) gossip pairs", "O(log N) rounds"],
                    ["Best for", "Databases, config", "Counters, registers", "Service discovery"],
                  ].map(([prop, raft, crdt, gossip], i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-slate-900" : "bg-slate-950"}>
                      <td className="px-4 py-2.5 font-medium text-slate-400 border border-slate-700">{prop}</td>
                      <td className="px-4 py-2.5 border border-slate-700">{raft}</td>
                      <td className="px-4 py-2.5 border border-slate-700">{crdt}</td>
                      <td className="px-4 py-2.5 border border-slate-700">{gossip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Note>
              <strong>CAP Theorem</strong> says a distributed system can only guarantee 2 of 3: <em>Consistency</em>, <em>Availability</em>, <em>Partition tolerance</em>. Since partition tolerance is non-negotiable in a real network, you always choose between C and A. Raft picks C; CRDT and Gossip pick A.
            </Note>
          </Section>

          {/* ── TIPS ───────────────────────────────────────────────────────── */}
          <Section id="tips">
            <H2>Tips & FAQ</H2>

            <div className="space-y-5">
              {[
                {
                  q: "Why are all nodes purple when I first open the simulation?",
                  a: "The WebSocket is still connecting. The status indicator in the top bar shows 'Reconnecting...' in red while connecting. Once it turns green ('Live'), node colours update immediately as state events flow in.",
                },
                {
                  q: "I injected a command but got an error. What happened?",
                  a: "If the cluster is in the middle of an election (yellow candidate nodes visible), no node can accept writes. Wait ~1s for a leader to be elected (orange node), then try again. The inject will auto-redirect to the leader once one exists.",
                },
                {
                  q: "Why does Raft elect a new leader even without a partition?",
                  a: "Election timeouts are randomised (400–800ms). If the leader's heartbeats arrive slightly late (local network blip, CPU load), a follower may start an election. This is intentional — Raft prefers correctness over stability, and will re-elect rather than risk stale leadership.",
                },
                {
                  q: "Why is the latency heatmap empty?",
                  a: "It shows averages over the last 10 seconds. Wait ~10s after starting, or inject a few commands to generate message traffic. In local dev all latencies show <10ms since all nodes are on localhost.",
                },
                {
                  q: "Can I run more than 7 nodes?",
                  a: "No — 7 is the maximum per simulation. This is a safety limit to avoid creating too many Durable Object instances per simulation. You can run multiple simulations simultaneously though.",
                },
                {
                  q: "What does 'Kill Node' actually do?",
                  a: "It stops the DO Alarm — the node will no longer send heartbeats (if leader) or trigger election timeouts (if follower). The node still responds to HTTP requests but is 'frozen'. Clicking restart re-initialises the alarm and the node rejoins the cluster.",
                },
                {
                  q: "How does the inject auto-redirect work?",
                  a: "If you target a follower in Raft, it returns a 307 response with the current leader's node ID. The worker retries the request on the correct leader transparently. For CRDT and Gossip, all nodes accept writes directly — no redirect needed.",
                },
                {
                  q: "Do regions actually matter in local dev?",
                  a: "In local dev (wrangler dev), all DOs are on localhost — region hints are ignored. In production deployment to Cloudflare's network, DOs are placed in the specified PoP and cross-region messages have real latency (30–200ms depending on pair).",
                },
              ].map(({ q, a }, i) => (
                <details key={i} className="group bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer text-sm font-medium text-white hover:bg-slate-800 transition-colors list-none">
                    {q}
                    <span className="text-slate-400 group-open:rotate-180 transition-transform text-lg leading-none ml-3 shrink-0">›</span>
                  </summary>
                  <div className="px-5 pb-4 text-sm text-slate-400 border-t border-slate-800 pt-3">
                    {a}
                  </div>
                </details>
              ))}
            </div>

            <div className="rounded-xl bg-blue-950/30 border border-blue-700/50 p-6 space-y-3 text-center mt-8">
              <div className="text-xl font-bold">Ready to experiment?</div>
              <p className="text-slate-400 text-sm">
                Start with Raft + 3 nodes. Watch the election. Inject a command. Partition the leader.
                That one experiment teaches more than most distributed systems courses.
              </p>
              <Link
                to="/"
                className="inline-block mt-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-colors"
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
