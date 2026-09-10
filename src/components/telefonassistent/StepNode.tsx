"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { iconForKey } from "./icons";
import type { StepNode as StepNodeType } from "./types";

const handleClass =
  "!w-2.5 !h-2.5 !bg-gray-400 !border-2 !border-white dark:!border-gray-900 dark:!bg-gray-500";

export default function StepNode({ data, selected }: NodeProps<StepNodeType>) {
  const Icon = iconForKey(data.icon);

  if (data.kind === "start") {
    return (
      <div
        className={`flex items-center gap-2 rounded-full border bg-white px-4 py-2 shadow-sm dark:bg-gray-800 ${
          selected
            ? "border-indigo-500 ring-2 ring-indigo-500/30"
            : "border-gray-200 dark:border-gray-700"
        }`}
      >
        <Icon className="w-4 h-4 text-gray-700 dark:text-gray-200" />
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {data.label}
        </span>
        <Handle
          type="source"
          position={Position.Bottom}
          id="source"
          className={handleClass}
        />
      </div>
    );
  }

  return (
    <div
      className={`w-64 rounded-xl border bg-white p-3.5 shadow-sm dark:bg-gray-800 ${
        selected
          ? "border-indigo-500 ring-2 ring-indigo-500/30"
          : "border-gray-200 dark:border-gray-700"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        className={handleClass}
      />
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 shrink-0">
          <Icon className="w-3.5 h-3.5" />
        </span>
        <span className="text-sm font-medium text-gray-900 dark:text-white leading-tight">
          {data.label}
        </span>
      </div>
      {data.ziel && (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
          ZIEL: {data.ziel}
        </p>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        className={handleClass}
      />
    </div>
  );
}
