import { useState } from "react";
import type { Algorithm, NodeConfig } from "../lib/api";
import { api } from "../lib/api";
import { track } from "../lib/analytics";

interface Props {
  simulationId: string;
  algorithm: Algorithm;
  nodes: NodeConfig[];
}

export default function ControlPanel({ simulationId, algorithm, nodes }: Props) {
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [command, setCommand] = useState("");
  const [injectKey, setInjectKey] = useState("");
  const [injectValue, setInjectValue] = useState("");
  const [targetNodeId, setTargetNodeId] = useState(nodes[0]?.nodeId ?? "");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleNode(nodeId: string) {
    setSelectedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  async function run(
    label: string,
    fn: () => Promise<void>,
    event?: { name: string; properties?: Record<string, unknown> },
  ) {
    setLoading(label);
    setError(null);
    const base = { algorithm, node_count: nodes.length, ...event?.properties };
    try {
      await fn();
      if (event) track(event.name, { ...base, success: true });
    } catch (e) {
      if (event) track(event.name, { ...base, success: false, error: e instanceof Error ? e.message : String(e) });
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  }

  const btn = "px-3 py-1.5 rounded text-xs font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="flex flex-col gap-4 p-3 text-sm text-white">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Controls</div>

      {/* Node selection for partition */}
      <div>
        <div className="text-xs text-slate-400 mb-1">Select nodes to isolate:</div>
        <div className="flex flex-wrap gap-1">
          {nodes.map((n) => (
            <button
              key={n.nodeId}
              onClick={() => toggleNode(n.nodeId)}
              className={`text-xs px-2 py-0.5 rounded font-mono border transition-colors ${
                selectedNodes.has(n.nodeId)
                  ? "bg-red-600 border-red-500 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              {n.nodeId.split("-").pop()}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <button
            disabled={selectedNodes.size === 0 || loading !== null}
            onClick={() =>
              run("partition", () => api.applyPartition(simulationId, Array.from(selectedNodes)), {
                name: "partition_applied",
                properties: { isolated_count: selectedNodes.size },
              })
            }
            className={`${btn} bg-red-700 hover:bg-red-600 text-white`}
          >
            {loading === "partition" ? "Applying..." : "Partition Selected"}
          </button>
          <button
            disabled={loading !== null}
            onClick={() => run("heal", () => api.healPartition(simulationId), { name: "partition_healed" })}
            className={`${btn} bg-green-700 hover:bg-green-600 text-white`}
          >
            {loading === "heal" ? "Healing..." : "Heal All"}
          </button>
        </div>
      </div>

      <hr className="border-slate-700" />

      {/* Inject command */}
      <div>
        <div className="text-xs text-slate-400 mb-1">Inject command:</div>
        <select
          value={targetNodeId}
          onChange={(e) => setTargetNodeId(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs mb-1 text-white"
        >
          {nodes.map((n) => (
            <option key={n.nodeId} value={n.nodeId}>
              {n.nodeId.split("-").pop()} ({n.region})
            </option>
          ))}
        </select>

        {algorithm === "raft" && (
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder='e.g. SET x=42'
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs mb-1 text-white placeholder-slate-600"
          />
        )}
        {(algorithm === "crdt" || algorithm === "gossip") && (
          <div className="flex gap-1 mb-1">
            <input
              value={injectKey}
              onChange={(e) => setInjectKey(e.target.value)}
              placeholder="key"
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-600"
            />
            <input
              value={injectValue}
              onChange={(e) => setInjectValue(e.target.value)}
              placeholder="value"
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-600"
            />
          </div>
        )}
        <button
          disabled={loading !== null}
          onClick={() =>
            run("inject", () =>
              api.inject(
                simulationId,
                targetNodeId,
                algorithm === "raft" ? command : injectKey,
                algorithm !== "raft" ? injectKey : undefined,
                algorithm !== "raft" ? injectValue : undefined,
              ),
              { name: "command_injected" },
            )
          }
          className={`${btn} bg-blue-700 hover:bg-blue-600 text-white`}
        >
          {loading === "inject" ? "Injecting..." : "Inject"}
        </button>
      </div>

      <hr className="border-slate-700" />

      {/* Kill / Restart */}
      <div>
        <div className="text-xs text-slate-400 mb-1">Crash / restart node:</div>
        <div className="flex gap-2 flex-wrap">
          {nodes.map((n) => (
            <div key={n.nodeId} className="flex gap-1">
              <button
                disabled={loading !== null}
                onClick={() => run("stop-" + n.nodeId, () => api.stopNode(simulationId, n.nodeId), { name: "node_crashed", properties: { region: n.region } })}
                className={`${btn} bg-slate-700 hover:bg-red-800 text-slate-300`}
                title={`Kill ${n.nodeId}`}
              >
                ✗ {n.nodeId.split("-").pop()}
              </button>
              <button
                disabled={loading !== null}
                onClick={() => run("restart-" + n.nodeId, () => api.restartNode(simulationId, n.nodeId), { name: "node_restarted", properties: { region: n.region } })}
                className={`${btn} bg-slate-700 hover:bg-green-800 text-slate-300`}
                title={`Restart ${n.nodeId}`}
              >
                ↺
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-xs bg-red-900/20 rounded px-2 py-1">{error}</div>
      )}
    </div>
  );
}
