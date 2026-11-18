import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, isEncrypted } from "../secrets";

describe("secrets", () => {
  const original = process.env.CREDENTIALS_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  });
  afterEach(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = original;
  });

  it("verschlüsselt und entschlüsselt verlustfrei", () => {
    const enc = encryptSecret("geheim-ÄÖÜ-123");
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain("geheim");
    expect(decryptSecret(enc)).toBe("geheim-ÄÖÜ-123");
  });

  it("erzeugt pro Aufruf einen anderen Ciphertext", () => {
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
  });

  it("gibt Klartext-Altbestand unverändert zurück", () => {
    expect(decryptSecret("altes-passwort")).toBe("altes-passwort");
  });

  it("erkennt Manipulation am Ciphertext", () => {
    const enc = encryptSecret("geheim");
    const parts = enc.split(":");
    const ct = Buffer.from(parts[4], "base64");
    ct[0] ^= 0xff;
    parts[4] = ct.toString("base64");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("lehnt Verschlüsselung ohne Schlüssel ab", () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow(/CREDENTIALS_ENCRYPTION_KEY/);
  });

  it("lehnt einen Schlüssel falscher Länge ab", () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(16).toString("base64");
    expect(() => encryptSecret("x")).toThrow(/32 Byte/);
  });
});
