import type { Algorithm } from "../lib/api";

const explanations: Record<Algorithm, { title: string; summary: string; bullets: string[] }> = {
  raft: {
    title: "Raft Consensus",
    summary: "Strong consistency via leader-based log replication. Always one leader per term.",
    bullets: [
      "Leader elected via randomised timeouts (150–300ms)",
      "All writes go through the leader, replicated to quorum before commit",
      "Nodes revert to follower on seeing a higher term",
      "§5.4.2: only commits entries from current term",
      "Leader failure triggers a new election in ~300ms",
    ],
  },
  crdt: {
    title: "LWW-Register CRDT",
    summary: "Eventual consistency via gossip. Every write wins by Lamport timestamp.",
    bullets: [
      "Each node holds a map of key → {value, timestamp, nodeId}",
      "Merge rule: higher Lamport timestamp wins; ties broken by nodeId",
      "Gossip fanout = 2, interval = 500ms",
      "Convergence guaranteed even under partition — no coordination needed",
      "CAP trade-off: AP system (Available + Partition-tolerant)",
    ],
  },
  gossip: {
    title: "Rumor-Mongering Gossip",
    summary: "Epidemic dissemination. A rumor spreads to ceil(log₂N) peers each round.",
    bullets: [
      "Push-based: sender chooses random targets",
      "Rumor dies when infectionCount ≥ log(N)/log(fanout)",
      "O(log N) rounds to full dissemination with high probability",
      "Highly fault-tolerant — loses no information with partial partitions",
      "No global coordination — purely local decisions",
    ],
  },
};

interface Props {
  algorithm: Algorithm;
}

export default function AlgorithmExplainer({ algorithm }: Props) {
  const info = explanations[algorithm];
  return (
    <div className="text-xs text-white space-y-2 p-3">
      <div className="font-bold text-sm text-white">{info.title}</div>
      <div className="text-slate-400 italic">{info.summary}</div>
      <ul className="space-y-1">
        {info.bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-slate-500 shrink-0">›</span>
            <span className="text-slate-300">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
