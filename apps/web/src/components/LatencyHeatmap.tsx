import { useMemo } from "react";
import type { NodeConfig } from "../lib/api";
import type { MessageArc } from "../hooks/useSimulation";
import { latencyColor } from "../lib/colors";

interface Props {
  nodes: NodeConfig[];
  messages: MessageArc[];
  partitionedPairs: Set<string>;
}

export default function LatencyHeatmap({ nodes, messages, partitionedPairs }: Props) {
  const cutoff = Date.now() - 10_000;

  const avgLatency = useMemo(() => {
    const recent = messages.filter((m) => m.ts >= cutoff && !m.dropped && m.latencyMs > 0);
    const map: Record<string, number[]> = {};
    for (const m of recent) {
      const key = `${m.from}|${m.to}`;
      if (!map[key]) map[key] = [];
      map[key].push(m.latencyMs);
    }
    const avgs: Record<string, number> = {};
    for (const [k, vals] of Object.entries(map)) {
      avgs[k] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    return avgs;
  }, [messages, cutoff]);

  if (nodes.length === 0) return null;

  const labels = nodes.map((n) => n.nodeId.split("-").pop() ?? n.nodeId);

  return (
    <div>
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        Latency Heatmap (last 10s)
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs font-mono border-collapse">
          <thead>
            <tr>
              <th className="px-1 py-0.5 text-slate-500 text-right">from ╲ to</th>
              {nodes.map((n, i) => (
                <th key={n.nodeId} className="px-1 py-0.5 text-slate-400 w-12 text-center">
                  {labels[i]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nodes.map((fromNode, ri) => (
              <tr key={fromNode.nodeId}>
                <td className="px-1 py-0.5 text-slate-400 text-right pr-2">{labels[ri]}</td>
                {nodes.map((toNode) => {
                  if (fromNode.nodeId === toNode.nodeId) {
                    return (
                      <td key={toNode.nodeId} className="w-12 h-7 text-center bg-slate-800 text-slate-600 border border-slate-700">
                        —
                      </td>
                    );
                  }
                  const pairKey = `${fromNode.nodeId}|${toNode.nodeId}`;
                  const isPartitioned = partitionedPairs.has(pairKey);
                  const avg = avgLatency[pairKey];

                  return (
                    <td
                      key={toNode.nodeId}
                      className="w-12 h-7 text-center border border-slate-700 text-xs"
                      style={{
                        backgroundColor: isPartitioned
                          ? "#1c0808"
                          : avg !== undefined
                          ? `${latencyColor(avg)}22`
                          : "#1e293b",
                        color: isPartitioned
                          ? "#ef4444"
                          : avg !== undefined
                          ? latencyColor(avg)
                          : "#475569",
                      }}
                      title={isPartitioned ? "Partitioned" : avg !== undefined ? `${Math.round(avg)}ms avg` : "No data"}
                    >
                      {isPartitioned ? "✗" : avg !== undefined ? `${Math.round(avg)}` : "·"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 mt-2 text-xs text-slate-500">
        <span><span className="text-green-400">■</span> &lt;50ms</span>
        <span><span className="text-yellow-400">■</span> 50–150ms</span>
        <span><span className="text-red-400">■</span> &gt;150ms</span>
        <span><span className="text-red-600">✗</span> partitioned</span>
      </div>
    </div>
  );
}
