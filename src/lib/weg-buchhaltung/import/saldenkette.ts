// B5.6 Saldenkette: reine Prüffunktion, keine DB-/Dateizugriffe. Der Aufrufer
// lädt den vorherigen Schlusssaldo selbst (letzte `balance_confirmations`-
// Zeile des Kontos) und übergibt ihn hier zusammen mit den Werten des neuen
// Auszugs.

export interface SaldenketteCheckInput {
  previousClosingBalance: number | null;
  statementOpeningBalance: number | null;
  statementClosingBalance: number | null;
  /** Beträge der Umsätze dieses Auszugs (Cents, vorzeichenbehaftet). */
  entryAmounts: number[];
}

export interface SaldenketteWarning {
  code: "BC01";
  reason: string;
  expected: number;
  actual: number;
}

/**
 * Zwei unabhängige Prüfungen nach B5.6: der Anfangssaldo muss dem
 * Schlusssaldo des vorherigen Auszugs entsprechen, und Anfangssaldo + Σ
 * Umsätze muss dem Schlusssaldo entsprechen. Fehlt ein benötigter Saldo
 * (z. B. CSV-Import ohne Saldenangabe), wird die jeweilige Prüfung
 * übersprungen statt einen Fehlalarm auszulösen.
 */
export function checkSaldenkette(input: SaldenketteCheckInput): SaldenketteWarning[] {
  const warnings: SaldenketteWarning[] = [];

  if (input.previousClosingBalance !== null && input.statementOpeningBalance !== null) {
    if (input.previousClosingBalance !== input.statementOpeningBalance) {
      warnings.push({
        code: "BC01",
        reason: "Anfangssaldo weicht vom Schlusssaldo des vorhergehenden Auszugs ab",
        expected: input.previousClosingBalance,
        actual: input.statementOpeningBalance,
      });
    }
  }

  if (input.statementOpeningBalance !== null && input.statementClosingBalance !== null) {
    const computedClosing = input.statementOpeningBalance + input.entryAmounts.reduce((a, b) => a + b, 0);
    if (computedClosing !== input.statementClosingBalance) {
      warnings.push({
        code: "BC01",
        reason: "Anfangssaldo + Umsätze ergibt nicht den ausgewiesenen Schlusssaldo",
        expected: computedClosing,
        actual: input.statementClosingBalance,
      });
    }
  }

  return warnings;
}
