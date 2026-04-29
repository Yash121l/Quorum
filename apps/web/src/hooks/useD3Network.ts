import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { NodeConfig } from "../lib/api";
import type { MessageArc } from "./useSimulation";
import { roleColor } from "../lib/colors";
import type { RaftState } from "../lib/api";

export interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  region: string;
  role: string;
}

export interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
  partitioned: boolean;
}

interface UseD3NetworkOptions {
  nodes: NodeConfig[];
  nodeStates: Record<string, { role?: string } | RaftState>;
  messages: MessageArc[];
  partitionedPairs: Set<string>;
  onNodeClick: (nodeId: string) => void;
}

export function useD3Network(
  svgRef: React.RefObject<SVGSVGElement | null>,
  options: UseD3NetworkOptions,
) {
  const { nodes, nodeStates, messages, partitionedPairs, onNodeClick } = options;
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);
  const activeArcsRef = useRef<Set<string>>(new Set());

  const draw = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || nodes.length === 0) return;

    const width = svg.clientWidth || 800;
    const height = svg.clientHeight || 600;

    const sel = d3.select(svg);
    sel.selectAll("*").remove();

    // Defs for arrow markers
    const defs = sel.append("defs");
    defs
      .append("marker")
      .attr("id", "arrow")
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("refX", 20)
      .attr("refY", 3)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,0 L0,6 L8,3 z")
      .attr("fill", "#94a3b8");

    defs
      .append("marker")
      .attr("id", "arrow-drop")
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("refX", 20)
      .attr("refY", 3)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,0 L0,6 L8,3 z")
      .attr("fill", "#ef4444");

    const g = sel.append("g");

    sel.call(
      d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 3]).on("zoom", (e) => {
        g.attr("transform", e.transform.toString());
      }),
    );

    const d3Nodes: D3Node[] = nodes.map((n) => {
      const st = nodeStates[n.nodeId];
      const role = st && "role" in st ? (st as RaftState).role : "replica";
      return { id: n.nodeId, region: n.region, role, x: width / 2, y: height / 2 };
    });

    // Build all peer pairs as links
    const linkSet = new Set<string>();
    const d3Links: D3Link[] = [];
    for (const node of nodes) {
      for (const peer of node.peers) {
        if (peer === node.nodeId) continue;
        const key = [node.nodeId, peer].sort().join("|");
        if (linkSet.has(key)) continue;
        linkSet.add(key);
        d3Links.push({
          source: node.nodeId,
          target: peer,
          partitioned: partitionedPairs.has(`${node.nodeId}|${peer}`),
        });
      }
    }

    const sim = d3
      .forceSimulation<D3Node>(d3Nodes)
      .force("link", d3.forceLink<D3Node, D3Link>(d3Links).id((d) => d.id).distance(180))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(50));

    simulationRef.current = sim;

    const linkSel = g
      .append("g")
      .selectAll<SVGLineElement, D3Link>("line")
      .data(d3Links)
      .join("line")
      .attr("stroke", (d) => (d.partitioned ? "#ef4444" : "#475569"))
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", (d) => (d.partitioned ? "6,4" : "none"))
      .attr("marker-end", "url(#arrow)");

    const nodeSel = g
      .append("g")
      .selectAll<SVGGElement, D3Node>("g")
      .data(d3Nodes)
      .join("g")
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, D3Node>()
          .on("start", (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      )
      .on("click", (_, d) => onNodeClick(d.id));

    nodeSel
      .append("circle")
      .attr("r", 28)
      .attr("fill", (d) => roleColor(d.role as "leader" | "candidate" | "follower" | "replica"))
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 2);

    nodeSel
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "#fff")
      .attr("font-size", "10px")
      .attr("font-family", "monospace")
      .text((d) => d.id.split("-").pop() ?? d.id);

    nodeSel
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "3em")
      .attr("fill", "#94a3b8")
      .attr("font-size", "9px")
      .text((d) => d.region);

    sim.on("tick", () => {
      linkSel
        .attr("x1", (d) => (d.source as D3Node).x ?? 0)
        .attr("y1", (d) => (d.source as D3Node).y ?? 0)
        .attr("x2", (d) => (d.target as D3Node).x ?? 0)
        .attr("y2", (d) => (d.target as D3Node).y ?? 0);

      nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Draw in-flight message dots
    const nodeMap = new Map(d3Nodes.map((n) => [n.id, n]));
    const arcLayer = g.append("g").attr("class", "arcs");

    for (const arc of messages.slice(0, 20)) {
      if (activeArcsRef.current.has(arc.id)) continue;
      const src = nodeMap.get(arc.from);
      const tgt = nodeMap.get(arc.to);
      if (!src || !tgt) continue;

      activeArcsRef.current.add(arc.id);
      const dot = arcLayer
        .append("circle")
        .attr("r", 5)
        .attr("fill", arc.dropped ? "#ef4444" : "#22c55e")
        .attr("cx", src.x ?? 0)
        .attr("cy", src.y ?? 0);

      dot
        .transition()
        .duration(Math.max(arc.latencyMs, 300))
        .ease(d3.easeLinear)
        .attr("cx", tgt.x ?? 0)
        .attr("cy", tgt.y ?? 0)
        .on("end", () => {
          dot.remove();
          activeArcsRef.current.delete(arc.id);
        });
    }
  }, [nodes, nodeStates, messages, partitionedPairs, onNodeClick, svgRef]);

  useEffect(() => {
    draw();
    return () => {
      simulationRef.current?.stop();
    };
  }, [draw]);
}
