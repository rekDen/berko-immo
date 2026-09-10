"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Plus,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Rows3,
  Copy,
  LayoutTemplate,
  Search,
  BarChart2,
  PanelRight,
  Trash2,
  ChevronDown,
} from "lucide-react";
import StepNode from "./StepNode";
import FlowEdge from "./FlowEdge";
import { ICON_OPTIONS } from "./icons";
import { exampleNodes, exampleEdges, blankNodes, blankEdges } from "./template";
import { layoutNodes } from "./layout";
import type { StepNode as StepNodeType, FlowEdge as FlowEdgeType, StepIconKey } from "./types";

const STORAGE_KEY = "telefonassistent-flow-v1";
const nodeTypes = { step: StepNode };
const edgeTypes = { flow: FlowEdge };

type Snapshot = { nodes: StepNodeType[]; edges: FlowEdgeType[] };
type MenuKey = "templates" | "search" | "stats" | null;

function useIsDark() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

export default function FlowEditor() {
  const isDark = useIsDark();
  const { screenToFlowPosition, setCenter, zoomIn, zoomOut, fitView } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<StepNodeType>(exampleNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdgeType>(exampleEdges);

  const [history, setHistory] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const dragSnapshotRef = useRef<Snapshot | null>(null);

  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const toolbarRef = useRef<HTMLDivElement>(null);

  // Load a previously saved diagram (client-only; keeps the example as SSR-safe default).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Snapshot;
        if (saved.nodes?.length) {
          setNodes(saved.nodes);
          setEdges(saved.edges ?? []);
        }
      }
    } catch {
      // ignore malformed storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
  }, [nodes, edges]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-49), { nodes, edges }]);
    setFuture([]);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setFuture((f) => [...f, { nodes, edges }]);
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }, [history, nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setFuture(future.slice(0, -1));
    setHistory((h) => [...h, { nodes, edges }]);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [future, nodes, edges, setNodes, setEdges]);

  const onNodeDragStart = useCallback(() => {
    dragSnapshotRef.current = { nodes, edges };
  }, [nodes, edges]);

  const onNodeDragStop = useCallback(() => {
    if (dragSnapshotRef.current) {
      setHistory((h) => [...h.slice(-49), dragSnapshotRef.current as Snapshot]);
      setFuture([]);
      dragSnapshotRef.current = null;
    }
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      pushHistory();
      const newEdge: FlowEdgeType = {
        id: `edge-${crypto.randomUUID()}`,
        type: "flow",
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        data: { label: "" },
        selected: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#9ca3af" },
      };
      setEdges((eds) => [...eds.map((e) => ({ ...e, selected: false })), newEdge]);
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
      setInspectorOpen(true);
    },
    [pushHistory, setEdges, setNodes]
  );

  const addNode = useCallback(
    (position?: { x: number; y: number }) => {
      pushHistory();
      const id = `node-${crypto.randomUUID()}`;
      const pos =
        position ??
        screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const newNode: StepNodeType = {
        id,
        type: "step",
        position: pos,
        data: { label: "Neuer Schritt", ziel: "", icon: "user", kind: "step" },
        selected: true,
      };
      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), newNode]);
      setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
      setInspectorOpen(true);
    },
    [pushHistory, screenToFlowPosition, setNodes, setEdges]
  );

  const handlePaneDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains("react-flow__pane")) return;
      addNode(screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [addNode, screenToFlowPosition]
  );

  const onNodeClick: NodeMouseHandler = useCallback(() => {
    setOpenMenu(null);
  }, []);

  const duplicateSelected = useCallback(() => {
    const selected = nodes.find((n) => n.selected);
    if (!selected) return;
    pushHistory();
    const id = `node-${crypto.randomUUID()}`;
    const newNode: StepNodeType = {
      ...selected,
      id,
      position: { x: selected.position.x + 40, y: selected.position.y + 40 },
      selected: true,
    };
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), newNode]);
  }, [nodes, pushHistory, setNodes]);

  const applyLayout = useCallback(() => {
    pushHistory();
    setNodes((nds) => layoutNodes(nds, edges));
    requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }));
  }, [edges, pushHistory, setNodes, fitView]);

  const loadTemplate = useCallback(
    (kind: "example" | "blank") => {
      pushHistory();
      setNodes(kind === "example" ? exampleNodes : blankNodes);
      setEdges(kind === "example" ? exampleEdges : blankEdges);
      setOpenMenu(null);
      requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }));
    },
    [pushHistory, setNodes, setEdges, fitView]
  );

  const goToNode = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === id })));
      setCenter(node.position.x + 130, node.position.y + 45, { zoom: 1, duration: 300 });
      setOpenMenu(null);
      setSearchQuery("");
      setInspectorOpen(true);
    },
    [nodes, setNodes, setCenter]
  );

  const selectedNode = nodes.find((n) => n.selected);
  const selectedEdge = edges.find((e) => e.selected);

  const updateSelectedNode = useCallback(
    (patch: Partial<StepNodeType["data"]>) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, ...patch } } : n))
      );
    },
    [selectedNode, setNodes]
  );

  const updateSelectedEdgeLabel = useCallback(
    (label: string) => {
      if (!selectedEdge) return;
      setEdges((eds) =>
        eds.map((e) => (e.id === selectedEdge.id ? { ...e, data: { ...e.data, label } } : e))
      );
    },
    [selectedEdge, setEdges]
  );

  const deleteSelected = useCallback(() => {
    if (selectedNode) {
      pushHistory();
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    } else if (selectedEdge) {
      pushHistory();
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
    }
  }, [selectedNode, selectedEdge, pushHistory, setNodes, setEdges]);

  const searchResults = searchQuery.trim()
    ? nodes.filter((n) => n.data.label.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : nodes;

  const nodeCount = nodes.filter((n) => n.data.kind === "step").length;
  const emptyLabelEdges = edges.filter((e) => !e.data?.label).length;
  const emptyZielNodes = nodes.filter((n) => n.data.kind === "step" && !n.data.ziel.trim()).length;

  return (
    <div className="flex w-full h-full">
      <div className="relative flex-1" onDoubleClick={handlePaneDoubleClick}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={() => pushHistory()}
          onEdgesDelete={() => pushHistory()}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          deleteKeyCode={["Backspace", "Delete"]}
          zoomOnDoubleClick={false}
          colorMode={isDark ? "dark" : "light"}
          minZoom={0.15}
          maxZoom={2}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} />

          <Panel position="top-left">
            <div
              ref={toolbarRef}
              className="flex items-center gap-0.5 rounded-2xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
            >
              <ToolbarButton title="Knoten hinzufügen" onClick={() => addNode()}>
                <Plus className="w-4 h-4" />
              </ToolbarButton>
              <Divider />
              <ToolbarButton title="Rückgängig" disabled={history.length === 0} onClick={undo}>
                <Undo2 className="w-4 h-4" />
              </ToolbarButton>
              <ToolbarButton title="Wiederholen" disabled={future.length === 0} onClick={redo}>
                <Redo2 className="w-4 h-4" />
              </ToolbarButton>
              <Divider />
              <ToolbarButton title="Vergrößern" onClick={() => zoomIn({ duration: 200 })}>
                <ZoomIn className="w-4 h-4" />
              </ToolbarButton>
              <ToolbarButton title="Verkleinern" onClick={() => zoomOut({ duration: 200 })}>
                <ZoomOut className="w-4 h-4" />
              </ToolbarButton>
              <ToolbarButton title="Alles einpassen" onClick={() => fitView({ padding: 0.2, duration: 300 })}>
                <Maximize2 className="w-4 h-4" />
              </ToolbarButton>
              <Divider />
              <ToolbarButton title="Automatisch anordnen" onClick={applyLayout}>
                <Rows3 className="w-4 h-4" />
              </ToolbarButton>
              <ToolbarButton title="Duplizieren" disabled={!selectedNode} onClick={duplicateSelected}>
                <Copy className="w-4 h-4" />
              </ToolbarButton>
              <Divider />

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === "templates" ? null : "templates")}
                  className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <LayoutTemplate className="w-4 h-4" />
                  Templates
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {openMenu === "templates" && (
                  <div className="absolute left-0 top-full mt-1 w-56 rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <MenuItem onClick={() => loadTemplate("example")}>
                      Beispiel: Hausverwaltung
                    </MenuItem>
                    <MenuItem onClick={() => loadTemplate("blank")}>Leeres Diagramm</MenuItem>
                  </div>
                )}
              </div>

              <div className="relative">
                <ToolbarButton
                  title="Suchen"
                  onClick={() => setOpenMenu(openMenu === "search" ? null : "search")}
                >
                  <Search className="w-4 h-4" />
                </ToolbarButton>
                {openMenu === "search" && (
                  <div className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <input
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Knoten suchen…"
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    />
                    <div className="mt-1 max-h-56 overflow-y-auto">
                      {searchResults.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => goToNode(n.id)}
                          className="block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          {n.data.label}
                        </button>
                      ))}
                      {searchResults.length === 0 && (
                        <p className="px-2.5 py-1.5 text-sm text-gray-400">Keine Treffer</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <ToolbarButton
                  title="Statistik"
                  onClick={() => setOpenMenu(openMenu === "stats" ? null : "stats")}
                >
                  <BarChart2 className="w-4 h-4" />
                </ToolbarButton>
                {openMenu === "stats" && (
                  <div className="absolute left-0 top-full mt-1 w-64 space-y-1.5 rounded-xl border border-gray-200 bg-white p-3 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <StatRow label="Schritte" value={nodeCount} />
                    <StatRow label="Verbindungen" value={edges.length} />
                    <StatRow label="Ohne Beschriftung" value={emptyLabelEdges} warn={emptyLabelEdges > 0} />
                    <StatRow label="Ohne Ziel-Text" value={emptyZielNodes} warn={emptyZielNodes > 0} />
                  </div>
                )}
              </div>
            </div>
          </Panel>

          <Panel position="top-right">
            <button
              type="button"
              onClick={() => setInspectorOpen((o) => !o)}
              className={`flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-medium shadow-lg ${
                inspectorOpen
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-300"
                  : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              }`}
            >
              Inspector
              <PanelRight className="w-4 h-4" />
            </button>
          </Panel>
        </ReactFlow>
      </div>

      {inspectorOpen && (
        <div className="w-80 shrink-0 h-full border-l border-gray-200 bg-white p-4 shadow-xl overflow-y-auto dark:border-gray-700 dark:bg-gray-800">
          {selectedNode ? (
            <NodeInspector
              node={selectedNode}
              onChange={updateSelectedNode}
              onDelete={deleteSelected}
            />
          ) : selectedEdge ? (
            <EdgeInspector
              edge={selectedEdge}
              onChangeLabel={updateSelectedEdgeLabel}
              onDelete={deleteSelected}
            />
          ) : (
            <div className="pt-10 text-center text-sm text-gray-400">
              Wähle einen Knoten oder eine Verbindung aus, um sie zu bearbeiten.
              <p className="mt-3 text-xs text-gray-400">
                Tipp: Doppelklick auf die Fläche fügt einen neuen Schritt hinzu. Ziehe von einem
                Kästchen an den Rand eines anderen, um sie zu verbinden.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex items-center justify-center rounded-xl p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-gray-700"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />;
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
    >
      {children}
    </button>
  );
}

function StatRow({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={warn ? "font-semibold text-amber-600" : "font-semibold text-gray-900 dark:text-white"}>
        {value}
      </span>
    </div>
  );
}

function NodeInspector({
  node,
  onChange,
  onDelete,
}: {
  node: StepNodeType;
  onChange: (patch: Partial<StepNodeType["data"]>) => void;
  onDelete: () => void;
}) {
  const isStart = node.data.kind === "start";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {isStart ? "Start-Knoten" : "Schritt bearbeiten"}
        </h3>
        {!isStart && (
          <button
            type="button"
            title="Löschen"
            onClick={onDelete}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Titel</span>
        <input
          value={node.data.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
      </label>

      {!isStart && (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Icon</span>
            <select
              value={node.data.icon}
              onChange={(e) => onChange({ icon: e.target.value as StepIconKey })}
              className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              {ICON_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Ziel dieses Schritts
            </span>
            <textarea
              value={node.data.ziel}
              onChange={(e) => onChange({ ziel: e.target.value })}
              rows={4}
              placeholder="Was soll die KI in diesem Schritt erreichen?"
              className="w-full resize-none rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
        </>
      )}
    </div>
  );
}

function EdgeInspector({
  edge,
  onChangeLabel,
  onDelete,
}: {
  edge: FlowEdgeType;
  onChangeLabel: (label: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Verbindung bearbeiten</h3>
        <button
          type="button"
          title="Löschen"
          onClick={onDelete}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
          Übergangsbedingung
        </span>
        <input
          autoFocus
          value={edge.data?.label ?? ""}
          onChange={(e) => onChangeLabel(e.target.value)}
          placeholder="z. B. Anrufer ist Mieter"
          className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
      </label>
    </div>
  );
}
