import type { Algorithm, RaftState, CrdtState, GossipState } from "../lib/api";
import { roleColor } from "../lib/colors";

interface Props {
  nodeId: string;
  algorithm: Algorithm;
  state: RaftState | CrdtState | GossipState | undefined;
  onClose: () => void;
}

function RaftDetail({ state }: { state: RaftState }) {
  return (
    <div className="space-y-3 text-xs">
      <div className="flex gap-3">
        <div className="flex-1 bg-slate-800 rounded p-2">
          <div className="text-slate-400 mb-1">Role</div>
          <div className="font-bold text-sm" style={{ color: roleColor(state.role) }}>
            {state.role.toUpperCase()}
          </div>
        </div>
        <div className="flex-1 bg-slate-800 rounded p-2">
          <div className="text-slate-400 mb-1">Term</div>
          <div className="font-bold text-sm text-white">{state.currentTerm}</div>
        </div>
        <div className="flex-1 bg-slate-800 rounded p-2">
          <div className="text-slate-400 mb-1">Commit</div>
          <div className="font-bold text-sm text-green-400">{state.commitIndex}</div>
        </div>
      </div>

      {state.leaderId && (
        <div className="bg-slate-800 rounded p-2">
          <span className="text-slate-400">Leader: </span>
          <span className="text-orange-400 font-mono">{state.leaderId}</span>
        </div>
      )}

      {state.votedFor && (
        <div className="bg-slate-800 rounded p-2">
          <span className="text-slate-400">Voted for: </span>
          <span className="text-yellow-400 font-mono">{state.votedFor}</span>
        </div>
      )}

      <div>
        <div className="text-slate-400 mb-1 font-semibold">Log Entries ({state.log.length})</div>
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {state.log.length === 0 && <div className="text-slate-600 italic">empty</div>}
          {state.log.map((entry) => (
            <div
              key={entry.index}
              className={`flex gap-2 px-2 py-1 rounded font-mono ${
                entry.index <= state.commitIndex ? "bg-green-900/30 text-green-300" : "bg-slate-800 text-slate-300"
              }`}
            >
              <span className="text-slate-500 w-6 text-right">{entry.index}</span>
              <span className="text-yellow-500">t{entry.term}</span>
              <span className="flex-1 truncate">{entry.command}</span>
              {entry.index <= state.commitIndex && (
                <span className="text-green-400 text-xs">✓</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CrdtDetail({ state }: { state: CrdtState }) {
  return (
    <div className="space-y-3 text-xs">
      <div>
        <div className="text-slate-400 mb-1 font-semibold">Registers</div>
        <table className="w-full font-mono">
          <thead className="text-slate-500">
            <tr>
              <th className="text-left">Key</th>
              <th className="text-left">Value</th>
              <th className="text-left">TS</th>
              <th className="text-left">Node</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(state.registers).map((r) => (
              <tr key={r.key} className="border-b border-slate-800">
                <td className="py-0.5 text-purple-300">{r.key}</td>
                <td className="py-0.5 text-white">{String(r.value)}</td>
                <td className="py-0.5 text-slate-400">{r.timestamp}</td>
                <td className="py-0.5 text-slate-400 truncate">{r.nodeId.split("-").pop()}</td>
              </tr>
            ))}
            {Object.keys(state.registers).length === 0 && (
              <tr>
                <td colSpan={4} className="text-slate-600 italic py-2">empty</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <div className="text-slate-400 mb-1 font-semibold">Vector Clock</div>
        <div className="flex flex-wrap gap-1">
          {Object.entries(state.vectorClock).map(([node, ts]) => (
            <span key={node} className="bg-slate-800 rounded px-2 py-0.5 text-slate-300">
              {node.split("-").pop()}: {ts}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function GossipDetail({ state }: { state: GossipState }) {
  return (
    <div className="space-y-3 text-xs">
      <div className="bg-slate-800 rounded p-2">
        <span className="text-slate-400">Infection Count: </span>
        <span className="text-purple-400 font-bold">{state.infectionCount}</span>
      </div>

      <div>
        <div className="text-slate-400 mb-1 font-semibold">Local Data</div>
        <table className="w-full font-mono">
          <thead className="text-slate-500">
            <tr>
              <th className="text-left">Key</th>
              <th className="text-left">Value</th>
              <th className="text-left">Version</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(state.localData).map(([key, { value, version }]) => (
              <tr key={key} className="border-b border-slate-800">
                <td className="py-0.5 text-purple-300">{key}</td>
                <td className="py-0.5 text-white">{value}</td>
                <td className="py-0.5 text-slate-400">{version}</td>
              </tr>
            ))}
            {Object.keys(state.localData).length === 0 && (
              <tr>
                <td colSpan={3} className="text-slate-600 italic py-2">empty</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <div className="text-slate-400 mb-1 font-semibold">Known Peers ({state.peers.length})</div>
        <div className="flex flex-wrap gap-1">
          {state.peers.map((p) => (
            <span key={p} className="bg-slate-800 rounded px-2 py-0.5 text-slate-300 font-mono text-xs">
              {p.split("-").pop()}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function NodeDetail({ nodeId, algorithm, state, onClose }: Props) {
  return (
    <div className="flex flex-col h-full text-white">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wider">Node Detail</div>
          <div className="font-mono text-sm font-semibold">{nodeId}</div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-white transition-colors text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!state && (
          <div className="text-slate-500 text-xs italic">No state received yet...</div>
        )}
        {state && algorithm === "raft" && <RaftDetail state={state as RaftState} />}
        {state && algorithm === "crdt" && <CrdtDetail state={state as CrdtState} />}
        {state && algorithm === "gossip" && <GossipDetail state={state as GossipState} />}
      </div>
    </div>
  );
}
