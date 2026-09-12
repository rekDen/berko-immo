import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { computeSettlement } from "../engine";
import { parseSettlementInput, toPlain } from "../serialize";

/**
 * Golden-Tests nach Spec 10.2. Liest jedes Szenario unter
 * `fixtures/weg-settlement/<szenario>/`: `input.json` ist Pflicht,
 * `expected.json` ist optional — fehlt sie, ist der Test als ausstehend
 * markiert (`it.skip`), nicht selbst befüllt (harte Regel 0.3.5).
 *
 * WICHTIG (Stand 2026-09-12): Für S1 liegt `expected.json` bereits vor, ist
 * aber selbst nur eine von Claude Code von Hand nachgerechnete, vom
 * Auftraggeber ohne unabhängige Prüfung freigegebene Übergangslösung — s.
 * `fixtures/weg-settlement/S1/README.md`. Ein grüner Test hier bestätigt
 * interne Konsistenz, keine fachliche Abnahme.
 */

const FIXTURES_ROOT = join(process.cwd(), "fixtures", "weg-settlement");

const scenarios = existsSync(FIXTURES_ROOT)
  ? readdirSync(FIXTURES_ROOT, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : [];

describe("Golden-Tests (Spec 10.2)", () => {
  if (scenarios.length === 0) {
    it.skip("keine Golden-Szenarien unter fixtures/weg-settlement/ gefunden", () => {});
  }

  for (const scenario of scenarios) {
    const dir = join(FIXTURES_ROOT, scenario);
    const inputPath = join(dir, "input.json");
    const expectedPath = join(dir, "expected.json");
    if (!existsSync(inputPath)) continue;

    if (!existsSync(expectedPath)) {
      it.skip(`${scenario}: expected.json fehlt noch — ausstehend (Spec 10.2)`, () => {});
      continue;
    }

    it(`${scenario} liefert das erwartete Ergebnis`, () => {
      const input = parseSettlementInput(JSON.parse(readFileSync(inputPath, "utf8")));
      const expected = JSON.parse(readFileSync(expectedPath, "utf8"));
      const result = toPlain(computeSettlement(input));
      expect(result).toEqual(expected);
    });
  }
});
