import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import NetworkGraph from "../components/NetworkGraph";
import EventLog from "../components/EventLog";
import NodeDetail from "../components/NodeDetail";
import ControlPanel from "../components/ControlPanel";
import LatencyHeatmap from "../components/LatencyHeatmap";
import AlgorithmExplainer from "../components/AlgorithmExplainer";
import {
  useSimulationStore,
  useSimulationWebSocket,
} from "../hooks/useSimulation";
import type { RaftState, CrdtState, GossipState } from "../lib/api";

export default function Simulation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const simulationId = useSimulationStore((s) => s.simulationId);
  const algorithm = useSimulationStore((s) => s.algorithm);
  const nodes = useSimulationStore((s) => s.nodes);
  const nodeStates = useSimulationStore((s) => s.nodeStates);
  const events = useSimulationStore((s) => s.events);
  const messages = useSimulationStore((s) => s.messages);
  const partitionedPairs = useSimulationStore((s) => s.partitionedPairs);
  const toast = useSimulationStore((s) => s.toast);
  const selectedNodeId = useSimulationStore((s) => s.selectedNodeId);
  const isConnected = useSimulationStore((s) => s.isConnected);
  const setSelectedNode = useSimulationStore((s) => s.setSelectedNode);
  const clearToast = useSimulationStore((s) => s.clearToast);

  // Connect WebSocket
  useSimulationWebSocket(id ?? null);

  // Auto-clear toast after 4s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 4000);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  // If no simulation in store (e.g. page refresh), redirect home
  useEffect(() => {
    if (!simulationId && id) {
      navigate("/", { replace: true });
    }
  }, [simulationId, id, navigate]);

  if (!simulationId || !algorithm) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <div className="text-2xl font-semibold">No active simulation</div>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
          >
            Start one →
          </button>
        </div>
      </div>
    );
  }

  const selectedState = selectedNodeId ? nodeStates[selectedNodeId] : undefined;

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden">
      {/* Topbar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <button
          onClick={() => navigate("/")}
          className="text-slate-500 hover:text-white transition-colors text-sm"
        >
          ← Back
        </button>
        <div className="font-mono text-xs text-slate-500">{simulationId}</div>
        <div className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300">
          {algorithm.toUpperCase()} · {nodes.length} nodes
        </div>
        <div className={`flex items-center gap-1 text-xs ${isConnected ? "text-green-400" : "text-red-400"}`}>
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400" : "bg-red-400"} animate-pulse`} />
          {isConnected ? "Live" : "Reconnecting..."}
        </div>
        <Link
          to="/tutorial"
          className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Guide →
        </Link>
      </div>

      {/* Toast */}
      {toast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-orange-800 text-white text-sm px-4 py-2 rounded-lg shadow-xl border border-orange-600 animate-fade-in">
          {toast}
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Left sidebar — controls + explainer */}
        <div className="w-64 shrink-0 flex flex-col border-r border-slate-800 overflow-y-auto bg-slate-900">
          <ControlPanel
            simulationId={simulationId}
            algorithm={algorithm}
            nodes={nodes}
          />
          <hr className="border-slate-700" />
          <AlgorithmExplainer algorithm={algorithm} />
        </div>

        {/* Center — graph */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-3">
            <NetworkGraph
              nodes={nodes}
              nodeStates={nodeStates as Record<string, RaftState>}
              messages={messages}
              partitionedPairs={partitionedPairs}
              onNodeClick={setSelectedNode}
            />
          </div>
          {/* Latency heatmap below graph */}
          <div className="shrink-0 px-4 pb-3">
            <LatencyHeatmap
              nodes={nodes}
              messages={messages}
              partitionedPairs={partitionedPairs}
            />
          </div>
        </div>

        {/* Right sidebar — node detail + event log */}
        <div className="w-80 shrink-0 flex flex-col border-l border-slate-800 bg-slate-900 overflow-hidden">
          {selectedNodeId ? (
            <div className="h-72 shrink-0 border-b border-slate-800 overflow-y-auto">
              <NodeDetail
                nodeId={selectedNodeId}
                algorithm={algorithm}
                state={selectedState as RaftState | CrdtState | GossipState | undefined}
                onClose={() => setSelectedNode(null)}
              />
            </div>
          ) : (
            <div className="h-12 shrink-0 flex items-center justify-center text-xs text-slate-600 border-b border-slate-800">
              Click a node to inspect
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <EventLog events={events} />
          </div>
        </div>
      </div>
    </div>
  );
}
