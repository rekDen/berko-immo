import {
  User,
  Bot,
  AlertTriangle,
  CalendarClock,
  Wrench,
  CheckCircle2,
  Flag,
} from "lucide-react";
import type { StepIconKey } from "./types";

export const ICON_OPTIONS: { key: StepIconKey; label: string; icon: typeof User }[] = [
  { key: "user", label: "Person", icon: User },
  { key: "bot", label: "KI-Aktion", icon: Bot },
  { key: "alert", label: "Notfall", icon: AlertTriangle },
  { key: "calendar", label: "Termin", icon: CalendarClock },
  { key: "wrench", label: "Technik", icon: Wrench },
  { key: "check", label: "Abschluss", icon: CheckCircle2 },
  { key: "flag", label: "Start", icon: Flag },
];

export function iconForKey(key: StepIconKey) {
  return ICON_OPTIONS.find((o) => o.key === key)?.icon ?? User;
}
