import dagre from "dagre";
import type { StepNode, FlowEdge } from "./types";

const NODE_WIDTH = 260;
const NODE_HEIGHT = 90;
const START_WIDTH = 100;
const START_HEIGHT = 44;

export function layoutNodes(nodes: StepNode[], edges: FlowEdge[]): StepNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 90 });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    const isStart = node.data.kind === "start";
    g.setNode(node.id, {
      width: isStart ? START_WIDTH : NODE_WIDTH,
      height: isStart ? START_HEIGHT : NODE_HEIGHT,
    });
  });

  edges.forEach((edge) => {
    if (edge.source !== edge.target) {
      g.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    const isStart = node.data.kind === "start";
    const w = isStart ? START_WIDTH : NODE_WIDTH;
    const h = isStart ? START_HEIGHT : NODE_HEIGHT;
    return {
      ...node,
      position: { x: pos.x - w / 2, y: pos.y - h / 2 },
    };
  });
}
