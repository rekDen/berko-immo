import { createHash } from "crypto";

/** B5.2 Schritt 1: Hash der hochgeladenen Datei, für die Idempotenzprüfung
 * beim Import (dieselbe Datei erzeugt beim erneuten Hochladen nichts Neues). */
export function computeFileHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
