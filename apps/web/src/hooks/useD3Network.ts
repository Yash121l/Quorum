/**
 * D3 force graph — incremental update strategy:
 *
 *   Effect 1 (topology)  — runs ONLY when node list changes.
 *                          Builds the SVG, starts the simulation.
 *
 *   Effect 2 (colors)    — runs when nodeStates changes.
 *                          Updates circle fill in-place; no DOM reconstruction.
 *
 *   Effect 3 (edges)     — runs when partitionedPairs changes.
 *                          Updates edge stroke/dash in-place.
 *
 *   Effect 4 (arcs)      — runs when messages changes.
 *                          Appends animated dots; doesn't touch nodes or edges.
 *
 * This avoids the full-redraw-on-every-heartbeat problem that caused flickering.
 */

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { NodeConfig, RaftState } from "../lib/api";
import type { MessageArc } from "./useSimulation";
import { roleColor } from "../lib/colors";

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  region: string;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  sourceId: string;
  targetId: string;
}

interface Refs {
  sim: d3.Simulation<D3Node, D3Link> | null;
  nodeMap: Map<string, D3Node>;
  arcLayer: d3.Selection<SVGGElement, unknown, null, undefined> | null;
  nodeSel: d3.Selection<SVGGElement, D3Node, SVGGElement, unknown> | null;
  linkSel: d3.Selection<SVGLineElement, D3Link, SVGGElement, unknown> | null;
  seenArcs: Set<string>;
}

export function useD3Network(
  svgRef: React.RefObject<SVGSVGElement | null>,
  options: {
    nodes: NodeConfig[];
    nodeStates: Record<string, { role?: string } | RaftState>;
    messages: MessageArc[];
    partitionedPairs: Set<string>;
    onNodeClick: (id: string) => void;
  },
) {
  const { nodes, nodeStates, messages, partitionedPairs, onNodeClick } = options;
  const r = useRef<Refs>({
    sim: null,
    nodeMap: new Map(),
    arcLayer: null,
    nodeSel: null,
    linkSel: null,
    seenArcs: new Set(),
  });

  // ── Effect 1: topology — only when node list changes ────────────────────────
  const nodeKey = nodes.map((n) => n.nodeId).join(",");
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || nodes.length === 0) return;

    // Clean up previous simulation
    r.current.sim?.stop();
    r.current.seenArcs.clear();
    d3.select(svg).selectAll("*").remove();

    const W = svg.clientWidth || 800;
    const H = svg.clientHeight || 600;

    const sel = d3.select(svg);

    // Arrow marker defs
    const defs = sel.append("defs");
    for (const [id, color] of [["arrow", "#64748b"], ["arrow-red", "#ef4444"]] as const) {
      defs.append("marker")
        .attr("id", id)
        .attr("markerWidth", 8).attr("markerHeight", 8)
        .attr("refX", 22).attr("refY", 3)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,0 L0,6 L8,3 z")
        .attr("fill", color);
    }

    const root = sel.append("g").attr("class", "root");
    sel.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.25, 4])
        .on("zoom", (e) => root.attr("transform", e.transform.toString())),
    );

    const d3Nodes: D3Node[] = nodes.map((n) => ({
      id: n.nodeId,
      region: n.region,
      x: W / 2 + (Math.random() - 0.5) * 200,
      y: H / 2 + (Math.random() - 0.5) * 200,
    }));
    const nodeMap = new Map(d3Nodes.map((n) => [n.id, n]));
    r.current.nodeMap = nodeMap;

    // Build links (unique pairs)
    const seen = new Set<string>();
    const d3Links: D3Link[] = [];
    for (const node of nodes) {
      for (const peer of node.peers) {
        if (peer === node.nodeId) continue;
        const key = [node.nodeId, peer].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        d3Links.push({ sourceId: node.nodeId, targetId: peer, source: node.nodeId, target: peer });
      }
    }

    const linkLayer = root.append("g").attr("class", "links");
    const nodeLayer = root.append("g").attr("class", "nodes");
    const arcLayer = root.append("g").attr("class", "arcs");
    r.current.arcLayer = arcLayer;

    const linkSel = linkLayer
      .selectAll<SVGLineElement, D3Link>("line")
      .data(d3Links)
      .join("line")
      .attr("stroke", "#475569")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow)");
    r.current.linkSel = linkSel;

    const nodeSel = nodeLayer
      .selectAll<SVGGElement, D3Node>("g.node")
      .data(d3Nodes, (d) => d.id)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, D3Node>()
          .on("start", (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on("end", (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }),
      )
      .on("click", (_, d) => onNodeClick(d.id));

    nodeSel.append("circle")
      .attr("r", 28)
      .attr("fill", "#a855f7")       // default purple; updated by effect 2
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 2.5)
      .attr("class", "node-circle");

    // Short label: last segment of "algo-simId-N"
    nodeSel.append("text")
      .attr("text-anchor", "middle").attr("dy", "0.35em")
      .attr("fill", "#fff").attr("font-size", "11px")
      .attr("font-family", "ui-monospace, monospace")
      .attr("pointer-events", "none")
      .text((d) => d.id.split("-").pop() ?? d.id);

    nodeSel.append("text")
      .attr("text-anchor", "middle").attr("dy", "3.2em")
      .attr("fill", "#64748b").attr("font-size", "9px")
      .attr("pointer-events", "none")
      .text((d) => d.region);

    r.current.nodeSel = nodeSel;

    const sim = d3.forceSimulation<D3Node>(d3Nodes)
      .force("link", d3.forceLink<D3Node, D3Link>(d3Links).id((d) => d.id).distance(180))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide(50));
    r.current.sim = sim;

    sim.on("tick", () => {
      linkSel
        .attr("x1", (d) => (d.source as D3Node).x ?? 0)
        .attr("y1", (d) => (d.source as D3Node).y ?? 0)
        .attr("x2", (d) => (d.target as D3Node).x ?? 0)
        .attr("y2", (d) => (d.target as D3Node).y ?? 0);
      nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => { sim.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeKey, svgRef]);

  // ── Effect 2: node colors — incremental, no DOM rebuild ─────────────────────
  useEffect(() => {
    if (!r.current.nodeSel) return;
    r.current.nodeSel.selectAll<SVGCircleElement, D3Node>("circle.node-circle")
      .attr("fill", (d) => {
        const st = nodeStates[d.id];
        const role = st && "role" in st ? (st as RaftState).role : "replica";
        return roleColor(role as "leader" | "candidate" | "follower" | "replica");
      });
  }, [nodeStates]);

  // ── Effect 3: partition edges — incremental stroke update ───────────────────
  useEffect(() => {
    if (!r.current.linkSel) return;
    r.current.linkSel
      .attr("stroke", (d) => {
        const partitioned = partitionedPairs.has(`${d.sourceId}|${d.targetId}`) ||
          partitionedPairs.has(`${d.targetId}|${d.sourceId}`);
        return partitioned ? "#ef4444" : "#475569";
      })
      .attr("stroke-dasharray", (d) => {
        const partitioned = partitionedPairs.has(`${d.sourceId}|${d.targetId}`) ||
          partitionedPairs.has(`${d.targetId}|${d.sourceId}`);
        return partitioned ? "6,4" : "none";
      })
      .attr("marker-end", (d) => {
        const partitioned = partitionedPairs.has(`${d.sourceId}|${d.targetId}`) ||
          partitionedPairs.has(`${d.targetId}|${d.sourceId}`);
        return partitioned ? "url(#arrow-red)" : "url(#arrow)";
      });
  }, [partitionedPairs]);

  // ── Effect 4: message arcs — append-only animated dots ──────────────────────
  useEffect(() => {
    const arcLayer = r.current.arcLayer;
    const nodeMap = r.current.nodeMap;
    if (!arcLayer || nodeMap.size === 0) return;

    for (const arc of messages.slice(0, 30)) {
      if (r.current.seenArcs.has(arc.id)) continue;
      const src = nodeMap.get(arc.from);
      const tgt = nodeMap.get(arc.to);
      if (!src || !tgt) continue;

      r.current.seenArcs.add(arc.id);
      const dot = arcLayer.append("circle")
        .attr("r", arc.dropped ? 4 : 5)
        .attr("fill", arc.dropped ? "#ef4444" : "#22c55e")
        .attr("opacity", 0.9)
        .attr("cx", src.x ?? 0)
        .attr("cy", src.y ?? 0);

      const duration = Math.max(arc.latencyMs || 50, 250);
      dot.transition()
        .duration(duration)
        .ease(d3.easeLinear)
        .attr("cx", tgt.x ?? 0)
        .attr("cy", tgt.y ?? 0)
        .attr("opacity", 0)
        .on("end", () => {
          dot.remove();
          r.current.seenArcs.delete(arc.id);
        });
    }
  }, [messages]);
}
