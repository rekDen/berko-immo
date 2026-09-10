import type { Node, Edge } from "@xyflow/react";

export type StepIconKey =
  | "user"
  | "bot"
  | "alert"
  | "calendar"
  | "wrench"
  | "check"
  | "flag";

export type StepNodeData = {
  label: string;
  ziel: string;
  icon: StepIconKey;
  kind: "start" | "step";
};

export type FlowEdgeData = {
  label: string;
};

export type StepNode = Node<StepNodeData, "step">;
export type FlowEdge = Edge<FlowEdgeData, "flow">;
