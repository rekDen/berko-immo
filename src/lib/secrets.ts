/**
 * Verschlüsselung gespeicherter Zugangsdaten (z. B. IMAP-Passwörter).
 *
 * AES-256-GCM mit einem Schlüssel aus `CREDENTIALS_ENCRYPTION_KEY`
 * (32 Byte, Base64). Erzeugen mit:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Format in der DB: `enc:v1:<iv>:<authTag>:<ciphertext>` (jeweils Base64).
 * Werte ohne Präfix gelten als Altbestand im Klartext und werden beim
 * Lesen unverändert zurückgegeben (siehe `isEncrypted`).
 *
 * Nur serverseitig verwenden.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) throw new Error("CREDENTIALS_ENCRYPTION_KEY ist nicht gesetzt.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY muss 32 Byte (Base64-kodiert) lang sein.");
  }
  return key;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, tag, ciphertext].map((b) => b.toString("base64")).join(":");
}

export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) return value; // Altbestand (Klartext)
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Ungültiges Format des verschlüsselten Werts.");
  const [iv, tag, ciphertext] = parts.map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
