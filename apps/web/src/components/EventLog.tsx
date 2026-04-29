import type { ObserverEvent } from "../lib/api";
import { eventTypeColor } from "../lib/colors";

interface Props {
  events: ObserverEvent[];
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour12: false, fractionalSecondDigits: 3 });
}

function eventSummary(event: ObserverEvent): string {
  switch (event.type) {
    case "node_state_update": return `state → ${event.nodeId}`;
    case "message_sent": return `${event.from} → ${event.to} [${event.msgType}]${event.latencyMs !== undefined ? ` ${event.latencyMs}ms` : ""}`;
    case "message_dropped": return `DROP ${event.from} → ${event.to} (${event.reason})`;
    case "leader_elected": return `LEADER: ${event.leaderId} (term ${event.term})`;
    case "partition_applied": return `PARTITION: [${event.isolatedNodes.join(", ")}] isolated`;
    case "partition_healed": return `PARTITION HEALED`;
    case "simulation_started": return `STARTED: ${event.algorithm} ${event.nodeCount} nodes`;
  }
}

function fromNode(event: ObserverEvent): string {
  if ("from" in event) return event.from;
  if ("nodeId" in event) return event.nodeId;
  if ("leaderId" in event) return event.leaderId;
  return "-";
}

function toNode(event: ObserverEvent): string {
  if ("to" in event) return event.to;
  return "-";
}

export default function EventLog({ events }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2 border-b border-slate-700">
        Event Log ({events.length})
      </div>
      <div className="overflow-y-auto flex-1 font-mono text-xs">
        <table className="w-full">
          <thead className="sticky top-0 bg-slate-800 text-slate-500">
            <tr>
              <th className="text-left px-2 py-1 w-24">Time</th>
              <th className="text-left px-2 py-1 w-24">From</th>
              <th className="text-left px-2 py-1 w-24">To</th>
              <th className="text-left px-2 py-1">Event</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr
                key={i}
                className="border-b border-slate-800 hover:bg-slate-800/50"
                style={{ color: eventTypeColor(e.type) }}
              >
                <td className="px-2 py-0.5 text-slate-500">{formatTime(e.ts)}</td>
                <td className="px-2 py-0.5 truncate max-w-[6rem]">{fromNode(e)}</td>
                <td className="px-2 py-0.5 truncate max-w-[6rem]">{toNode(e)}</td>
                <td className="px-2 py-0.5">{eventSummary(e)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && (
          <div className="text-slate-500 text-center py-8">Waiting for events...</div>
        )}
      </div>
    </div>
  );
}
