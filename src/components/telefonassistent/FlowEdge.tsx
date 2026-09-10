"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { CornerDownRight } from "lucide-react";
import type { FlowEdge as FlowEdgeType } from "./types";

export default function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  source,
  target,
  data,
  selected,
  markerEnd,
}: EdgeProps<FlowEdgeType>) {
  const { setEdges } = useReactFlow();
  const isSelfLoop = source === target;

  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (isSelfLoop) {
    const bulge = 170;
    edgePath = `M ${sourceX} ${sourceY} C ${sourceX + bulge} ${sourceY}, ${
      targetX + bulge
    } ${targetY}, ${targetX} ${targetY}`;
    labelX = sourceX + bulge;
    labelY = (sourceY + targetY) / 2;
  } else {
    const [path, lx, ly] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    edgePath = path;
    labelX = lx;
    labelY = ly;
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? "#6366f1" : "#9ca3af",
          strokeWidth: selected ? 2 : 1.5,
        }}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            className="nodrag nopan pointer-events-auto"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEdges((edges) =>
                  edges.map((edge) => ({ ...edge, selected: edge.id === id }))
                );
              }}
              className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm cursor-pointer ${
                selected
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-900 text-white dark:bg-gray-700"
              }`}
            >
              <CornerDownRight className="w-3 h-3 opacity-70" />
              {data.label}
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
