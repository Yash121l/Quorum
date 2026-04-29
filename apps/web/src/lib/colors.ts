import type { RaftRole } from "./api";

export function roleColor(role: RaftRole | "replica"): string {
  switch (role) {
    case "leader": return "#f97316";
    case "candidate": return "#eab308";
    case "follower": return "#3b82f6";
    case "replica": return "#a855f7";
  }
}

export function latencyColor(ms: number): string {
  if (ms < 50) return "#22c55e";
  if (ms < 150) return "#eab308";
  return "#ef4444";
}

export function eventTypeColor(type: string): string {
  if (type.includes("drop") || type.includes("partition")) return "#ef4444";
  if (type.includes("elect") || type.includes("leader")) return "#f97316";
  if (type.includes("commit")) return "#22c55e";
  if (type.includes("replicate") || type.includes("append")) return "#3b82f6";
  return "#94a3b8";
}
