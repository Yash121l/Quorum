import { useRef } from "react";
import type { NodeConfig } from "../lib/api";
import type { MessageArc } from "../hooks/useSimulation";
import { useD3Network } from "../hooks/useD3Network";
import type { RaftState } from "../lib/api";

interface Props {
  nodes: NodeConfig[];
  nodeStates: Record<string, { role?: string } | RaftState>;
  messages: MessageArc[];
  partitionedPairs: Set<string>;
  onNodeClick: (nodeId: string) => void;
}

export default function NetworkGraph({ nodes, nodeStates, messages, partitionedPairs, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useD3Network(svgRef, { nodes, nodeStates, messages, partitionedPairs, onNodeClick });

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />
      <div className="absolute bottom-3 left-3 flex gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Leader
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> Candidate
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Follower
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" /> Replica
        </span>
      </div>
    </div>
  );
}
