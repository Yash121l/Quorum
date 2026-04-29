import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import type { Algorithm, CFRegion } from "../lib/api";
import { useCreateSimulation } from "../hooks/useSimulation";

const ALGORITHMS: { id: Algorithm; label: string; description: string }[] = [
  {
    id: "raft",
    label: "Raft Consensus",
    description: "Leader-based log replication. Strong consistency, linearisable reads.",
  },
  {
    id: "crdt",
    label: "LWW-Register CRDT",
    description: "Last-Write-Wins gossip. Eventual consistency, always available.",
  },
  {
    id: "gossip",
    label: "Gossip Protocol",
    description: "Epidemic rumor-mongering. O(log N) dissemination rounds.",
  },
];

const REGIONS: { id: CFRegion; label: string; flag: string }[] = [
  { id: "wnam", label: "W. North America", flag: "🇺🇸" },
  { id: "enam", label: "E. North America", flag: "🇺🇸" },
  { id: "weur", label: "W. Europe", flag: "🇪🇺" },
  { id: "eeur", label: "E. Europe", flag: "🇪🇺" },
  { id: "apac", label: "Asia Pacific", flag: "🌏" },
  { id: "sam", label: "South America", flag: "🌎" },
  { id: "afr", label: "Africa", flag: "🌍" },
  { id: "me", label: "Middle East", flag: "🌍" },
];

export default function Home() {
  const navigate = useNavigate();
  const createSimulation = useCreateSimulation();

  const [algorithm, setAlgorithm] = useState<Algorithm>("raft");
  const [nodeCount, setNodeCount] = useState(3);
  const [regions, setRegions] = useState<CFRegion[]>(["wnam", "weur", "apac"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRegion(r: CFRegion) {
    setRegions((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  }

  async function handleStart() {
    if (regions.length === 0) return setError("Select at least one region");
    setLoading(true);
    setError(null);
    try {
      const result = await createSimulation(algorithm, nodeCount, regions);
      navigate(`/simulation/${result.simulationId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start simulation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">Quorum</h1>
          <p className="text-slate-400 text-lg">
            Interactive distributed systems sandbox — real Durable Objects, real latency
          </p>
          <Link
            to="/tutorial"
            className="inline-block text-sm text-blue-400 hover:text-blue-300 underline underline-offset-4 transition-colors"
          >
            New here? Read the guide →
          </Link>
        </div>

        {/* Algorithm picker */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Algorithm
          </div>
          <div className="grid grid-cols-3 gap-3">
            {ALGORITHMS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAlgorithm(a.id)}
                className={`rounded-xl p-4 text-left border-2 transition-all ${
                  algorithm === a.id
                    ? "border-blue-500 bg-blue-950/40"
                    : "border-slate-700 bg-slate-900 hover:border-slate-600"
                }`}
              >
                <div className="font-semibold text-sm mb-1">{a.label}</div>
                <div className="text-xs text-slate-400">{a.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Node count */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Node Count {algorithm === "raft" && <span className="text-slate-600">(must be odd)</span>}
          </div>
          <div className="flex gap-3">
            {[3, 5, 7].map((n) => (
              <button
                key={n}
                onClick={() => setNodeCount(n)}
                className={`w-16 h-12 rounded-lg border-2 font-mono font-bold transition-all ${
                  nodeCount === n
                    ? "border-blue-500 bg-blue-950/40 text-white"
                    : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Region picker */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Regions ({regions.length} selected)
          </div>
          <div className="grid grid-cols-4 gap-2">
            {REGIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => toggleRegion(r.id)}
                className={`px-3 py-2 rounded-lg border text-xs text-left transition-all ${
                  regions.includes(r.id)
                    ? "border-blue-500 bg-blue-950/40 text-white"
                    : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
                }`}
              >
                <span className="mr-1">{r.flag}</span>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-2 text-red-300 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Starting simulation..." : "Launch Simulation →"}
        </button>

        <div className="text-center text-xs text-slate-600">
          Each node is a real Cloudflare Durable Object running in the selected regions
        </div>
      </div>
    </div>
  );
}
