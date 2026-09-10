import { NextResponse } from "next/server";

/** Bereinigt und validiert einen Ordner-/Dateinamen. */
export function validateName(raw: unknown): { name: string } | { error: string } {
  if (typeof raw !== "string") return { error: "Name erforderlich" };
  const name = raw.trim();
  if (!name) return { error: "Name darf nicht leer sein" };
  if (name.length > 255) return { error: "Name zu lang (max. 255 Zeichen)" };
  if (/[/\\]/.test(name)) return { error: "Name darf keine Pfadtrenner (/ \\) enthalten" };
  return { name };
}

/** Erkennt Unique-Constraint-Verletzungen (doppelter Name) und liefert 409. */
export function conflictResponse(error: { code?: string; message?: string }) {
  if (error?.code === "23505") {
    return NextResponse.json(
      { error: "Ein Element mit diesem Namen existiert hier bereits" },
      { status: 409 }
    );
  }
  return null;
}
