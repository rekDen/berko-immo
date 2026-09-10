"use client";

import { ReactFlowProvider } from "@xyflow/react";
import FlowEditor from "@/components/telefonassistent/FlowEditor";

export default function TelefonassistentPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Telefonassistent</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Gesprächsablauf für den KI-Telefonassistenten als Workflow entwerfen.
        </p>
      </div>
      <div className="flex-1">
        <ReactFlowProvider>
          <FlowEditor />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
