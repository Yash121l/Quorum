import { useEffect, useRef, useCallback } from "react";
import { create } from "zustand";
import type {
  Algorithm,
  CFRegion,
  NodeConfig,
  ObserverEvent,
  RaftState,
  CrdtState,
  GossipState,
} from "../lib/api";
import { api } from "../lib/api";
import { track } from "../lib/analytics";

// Simulation id -> creation time, used to report time-to-first-leader once per simulation.
const simCreatedAt = new Map<string, number>();

export interface MessageArc {
  id: string;
  from: string;
  to: string;
  msgType: string;
  latencyMs: number;
  ts: number;
  dropped: boolean;
}

export interface SimulationStore {
  simulationId: string | null;
  algorithm: Algorithm | null;
  nodes: NodeConfig[];
  nodeStates: Record<string, RaftState | CrdtState | GossipState>;
  events: ObserverEvent[];
  messages: MessageArc[];
  partitionedPairs: Set<string>;
  toast: string | null;
  selectedNodeId: string | null;
  isConnected: boolean;

  setSimulation: (simId: string, algorithm: Algorithm, nodes: NodeConfig[]) => void;
  pushEvent: (event: ObserverEvent) => void;
  setSelectedNode: (nodeId: string | null) => void;
  clearToast: () => void;
  reset: () => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  simulationId: null,
  algorithm: null,
  nodes: [],
  nodeStates: {},
  events: [],
  messages: [],
  partitionedPairs: new Set(),
  toast: null,
  selectedNodeId: null,
  isConnected: false,

  setSimulation: (simId, algorithm, nodes) =>
    set({ simulationId: simId, algorithm, nodes, events: [], messages: [], nodeStates: {}, partitionedPairs: new Set() }),

  pushEvent: (event) =>
    set((s) => {
      const events = [event, ...s.events].slice(0, 200);
      let nodeStates = s.nodeStates;
      let messages = s.messages;
      let partitionedPairs = s.partitionedPairs;
      let toast = s.toast;

      if (event.type === "node_state_update") {
        nodeStates = { ...nodeStates, [event.nodeId]: event.state };
      } else if (event.type === "message_sent") {
        const arc: MessageArc = {
          id: `${event.from}-${event.to}-${event.ts}`,
          from: event.from,
          to: event.to,
          msgType: event.msgType,
          latencyMs: event.latencyMs ?? 50,
          ts: event.ts,
          dropped: false,
        };
        messages = [arc, ...messages].slice(0, 100);
      } else if (event.type === "message_dropped") {
        const arc: MessageArc = {
          id: `drop-${event.from}-${event.to}-${event.ts}`,
          from: event.from,
          to: event.to,
          msgType: "dropped",
          latencyMs: 0,
          ts: event.ts,
          dropped: true,
        };
        messages = [arc, ...messages].slice(0, 100);
      } else if (event.type === "leader_elected") {
        toast = `Node ${event.leaderId} elected leader (term ${event.term})`;
      } else if (event.type === "partition_applied") {
        const newPairs = new Set(partitionedPairs);
        for (const n1 of event.isolatedNodes) {
          for (const n2 of (s.nodes.map(n => n.nodeId).filter(id => !event.isolatedNodes.includes(id)))) {
            newPairs.add(`${n1}|${n2}`);
            newPairs.add(`${n2}|${n1}`);
          }
        }
        partitionedPairs = newPairs;
      } else if (event.type === "partition_healed") {
        partitionedPairs = new Set();
        toast = "Partition healed";
      }

      return { events, nodeStates, messages, partitionedPairs, toast };
    }),

  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  clearToast: () => set({ toast: null }),
  reset: () =>
    set({
      simulationId: null,
      algorithm: null,
      nodes: [],
      nodeStates: {},
      events: [],
      messages: [],
      partitionedPairs: new Set(),
      toast: null,
      selectedNodeId: null,
      isConnected: false,
    }),
}));

export function useSimulationWebSocket(simId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const pushEvent = useSimulationStore((s) => s.pushEvent);
  const storeSet = useSimulationStore.setState;

  const connect = useCallback(() => {
    if (!simId || wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(api.observerWsUrl(simId));
    wsRef.current = ws;

    ws.onopen = () => storeSet({ isConnected: true });
    ws.onclose = () => {
      storeSet({ isConnected: false });
      // Reconnect after 2s
      setTimeout(() => connect(), 2000);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as ObserverEvent;
        pushEvent(event);
        if (event.type === "leader_elected" && simCreatedAt.has(simId)) {
          const createdAt = simCreatedAt.get(simId) ?? Date.now();
          simCreatedAt.delete(simId);
          const { algorithm, nodes } = useSimulationStore.getState();
          track("first_leader_elected", {
            algorithm,
            node_count: nodes.length,
            term: event.term,
            ms_since_created: Date.now() - createdAt,
          });
        }
      } catch {
        // ignore malformed messages
      }
    };
  }, [simId, pushEvent, storeSet]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);
}

export function useCreateSimulation() {
  const setSimulation = useSimulationStore((s) => s.setSimulation);

  return async (algorithm: Algorithm, nodeCount: number, regions: CFRegion[]) => {
    const result = await api.createSimulation({ algorithm, nodeCount, regions });
    setSimulation(result.simulationId, result.algorithm, result.nodes);
    simCreatedAt.set(result.simulationId, Date.now());
    return result;
  };
}
