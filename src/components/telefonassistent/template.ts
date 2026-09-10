import type { StepNode, FlowEdge } from "./types";

export const exampleNodes: StepNode[] = [
  {
    id: "start",
    type: "step",
    position: { x: 800, y: 0 },
    data: { label: "Start", ziel: "", icon: "flag", kind: "start" },
  },
  {
    id: "welcome",
    type: "step",
    position: { x: 720, y: 110 },
    data: {
      label: "Willkommen & Klassifikation",
      ziel: "Begrüßen, das Anliegen einmal frei schildern lassen und anschließend zuordnen: Eigentümer, Mieter, Dienstleister, Mietinteressent oder Notfall.",
      icon: "user",
      kind: "step",
    },
  },
  {
    id: "owner",
    type: "step",
    position: { x: 0, y: 340 },
    data: {
      label: "Eigentümerrelevante Fragen",
      ziel: "Anliegen von Eigentümern und WEG-Mitgliedern beantworten — ausschließlich anhand hinterlegter Objektdaten.",
      icon: "user",
      kind: "step",
    },
  },
  {
    id: "tenant",
    type: "step",
    position: { x: 360, y: 340 },
    data: {
      label: "Mieterrelevante Fragen",
      ziel: "Anliegen aktueller Mieter beantworten — ausschließlich anhand hinterlegter Vertragsdaten.",
      icon: "user",
      kind: "step",
    },
  },
  {
    id: "emergency",
    type: "step",
    position: { x: 720, y: 340 },
    data: {
      label: "Notfall",
      ziel: "Gefahr korrekt einordnen und den richtigen Weg zur Meldung nennen.",
      icon: "alert",
      kind: "step",
    },
  },
  {
    id: "vendor",
    type: "step",
    position: { x: 1080, y: 340 },
    data: {
      label: "Dienstleisterrelevante Fragen",
      ziel: "Anliegen von Handwerkern und externen Firmen bearbeiten — Auftragsstatus und Ansprechpartner klären.",
      icon: "wrench",
      kind: "step",
    },
  },
  {
    id: "viewing",
    type: "step",
    position: { x: 1440, y: 340 },
    data: {
      label: "Besichtigungstermin vereinbaren",
      ziel: "Mit Interessenten einen Besichtigungstermin vereinbaren — Verfügbarkeit abgleichen.",
      icon: "calendar",
      kind: "step",
    },
  },
  {
    id: "maintenance",
    type: "step",
    position: { x: 180, y: 560 },
    data: {
      label: "Wartungsanfrage",
      ziel: "Nicht-akute Reparatur- oder Mängelmeldung sauber und vollständig aufnehmen.",
      icon: "wrench",
      kind: "step",
    },
  },
  {
    id: "end",
    type: "step",
    position: { x: 720, y: 800 },
    data: {
      label: "Bestätigung und Ende",
      ziel: "Gespräch situationsgerecht zusammenfassen und freundlich abschließen.",
      icon: "check",
      kind: "step",
    },
  },
];

function edge(
  id: string,
  source: string,
  target: string,
  label = ""
): FlowEdge {
  return {
    id,
    type: "flow",
    source,
    target,
    sourceHandle: "source",
    targetHandle: "target",
    data: { label },
  };
}

export const exampleEdges: FlowEdge[] = [
  edge("e-start-welcome", "start", "welcome"),
  edge("e-welcome-owner", "welcome", "owner", "Anrufer ist Eigentümer"),
  edge("e-welcome-tenant", "welcome", "tenant", "Anrufer ist aktueller Mieter"),
  edge("e-welcome-emergency", "welcome", "emergency", "Notfall erkannt"),
  edge("e-welcome-vendor", "welcome", "vendor", "Anrufer ist Dienstleister"),
  edge("e-welcome-viewing", "welcome", "viewing", "Anrufer ist Mietinteressent"),
  edge("e-owner-maintenance", "owner", "maintenance", "Eigentümer hat Wartungsfall"),
  edge("e-tenant-maintenance", "tenant", "maintenance", "Mieter hat Wartungsfall"),
  edge("e-owner-emergency", "owner", "emergency", "Notfall melden"),
  edge("e-tenant-emergency", "tenant", "emergency", "Notfall melden"),
  edge("e-vendor-emergency", "vendor", "emergency", "Notfall melden"),
  edge("e-maintenance-owner", "maintenance", "owner", "Eigentümer hat weitere Fragen"),
  edge("e-maintenance-tenant", "maintenance", "tenant", "Mieter hat weitere Fragen"),
  edge("e-owner-end", "owner", "end", "Alle Fragen beantwortet"),
  edge("e-tenant-end", "tenant", "end", "Alle Fragen beantwortet"),
  edge("e-maintenance-end", "maintenance", "end", "Wartungsanfrage aufgenommen"),
  edge("e-emergency-end", "emergency", "end", "Notfall aufgenommen"),
  edge("e-vendor-self", "vendor", "vendor", "DL hat weitere Fragen"),
  edge("e-vendor-end", "vendor", "end", "Anfrage bearbeitet"),
  edge("e-viewing-end", "viewing", "end", "Besichtigungstermin vereinbart"),
];

export const blankNodes: StepNode[] = [
  {
    id: "start",
    type: "step",
    position: { x: 400, y: 0 },
    data: { label: "Start", ziel: "", icon: "flag", kind: "start" },
  },
];

export const blankEdges: FlowEdge[] = [];
