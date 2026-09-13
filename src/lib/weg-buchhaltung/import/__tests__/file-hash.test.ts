import { describe, expect, it } from "vitest";
import { computeFileHash } from "../file-hash";

describe("computeFileHash", () => {
  it("liefert für identische Bytes denselben Hash", () => {
    const bytes = new TextEncoder().encode("Hallo Welt");
    expect(computeFileHash(bytes)).toBe(computeFileHash(bytes.slice()));
  });

  it("liefert für ein geändertes Byte einen anderen Hash", () => {
    const a = new TextEncoder().encode("Hallo Welt");
    const b = new TextEncoder().encode("Hallo welt");
    expect(computeFileHash(a)).not.toBe(computeFileHash(b));
  });
});
