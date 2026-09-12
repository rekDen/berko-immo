import { describe, expect, it } from "vitest";
import { computeBalanceSheet, computeIncomeStatement, type LedgerAccount, type LedgerLine } from "../ledger";

const accounts: LedgerAccount[] = [
  { id: "bank", code: "1000", name: "Bankkonto", kind: "asset" },
  { id: "reserve", code: "1100", name: "Rücklage", kind: "asset" },
  { id: "payables", code: "2000", name: "Verbindlichkeiten", kind: "liability" },
  { id: "hausmeister", code: "4000", name: "Hausmeister", kind: "expense" },
  { id: "zinsen", code: "8000", name: "Zinserträge", kind: "income" },
];

describe("computeBalanceSheet", () => {
  it("Bankkonto: Soll erhöht, Haben verringert den Bestand (asset ist debit-normal)", () => {
    const lines: LedgerLine[] = [
      { accountId: "bank", debit: 340000, credit: null },
      { accountId: "bank", debit: null, credit: 24700 },
    ];
    const { assets } = computeBalanceSheet(accounts, lines);
    expect(assets.find((a) => a.accountId === "bank")!.balance).toBe(340000 - 24700);
  });

  it("Verbindlichkeiten: Haben erhöht den Bestand (liability ist haben-normal)", () => {
    const lines: LedgerLine[] = [{ accountId: "payables", debit: null, credit: 5000 }];
    const { liabilitiesAndEquity } = computeBalanceSheet(accounts, lines);
    expect(liabilitiesAndEquity.find((a) => a.accountId === "payables")!.balance).toBe(5000);
  });

  it("summiert Aktiva und Passiva getrennt", () => {
    const lines: LedgerLine[] = [
      { accountId: "bank", debit: 100000, credit: null },
      { accountId: "reserve", debit: 50000, credit: null },
      { accountId: "payables", debit: null, credit: 30000 },
    ];
    const { totalAssets, totalLiabilitiesAndEquity } = computeBalanceSheet(accounts, lines);
    expect(totalAssets).toBe(150000);
    expect(totalLiabilitiesAndEquity).toBe(30000);
  });

  it("ist deterministisch und reihenfolgeunabhängig (nach Kontocode sortiert)", () => {
    const lines: LedgerLine[] = [{ accountId: "reserve", debit: 100, credit: null }];
    const a = computeBalanceSheet(accounts, lines);
    const b = computeBalanceSheet([...accounts].reverse(), [...lines]);
    expect(a.assets.map((x) => x.code)).toEqual(b.assets.map((x) => x.code));
  });
});

describe("computeIncomeStatement", () => {
  it("Aufwand: Soll erhöht den Saldo (expense ist debit-normal)", () => {
    const lines: LedgerLine[] = [{ accountId: "hausmeister", debit: 24700, credit: null }];
    const { expenses, totalExpenses } = computeIncomeStatement(accounts, lines);
    expect(expenses[0].balance).toBe(24700);
    expect(totalExpenses).toBe(24700);
  });

  it("Ertrag: Haben erhöht den Saldo (income ist haben-normal)", () => {
    const lines: LedgerLine[] = [{ accountId: "zinsen", debit: null, credit: 500 }];
    const { income, totalIncome } = computeIncomeStatement(accounts, lines);
    expect(income[0].balance).toBe(500);
    expect(totalIncome).toBe(500);
  });

  it("Ergebnis = Ertrag − Aufwand", () => {
    const lines: LedgerLine[] = [
      { accountId: "hausmeister", debit: 24700, credit: null },
      { accountId: "zinsen", debit: null, credit: 500 },
    ];
    const { result } = computeIncomeStatement(accounts, lines);
    expect(result).toBe(500 - 24700);
  });

  it("bezieht Bestandskonten nicht in die GuV-Summe ein (Erfolgskonten bleiben bei 0, wenn unbebucht)", () => {
    const lines: LedgerLine[] = [{ accountId: "bank", debit: 1000, credit: null }];
    const { expenses, income, totalExpenses, totalIncome } = computeIncomeStatement(accounts, lines);
    expect(expenses.every((a) => a.balance === 0)).toBe(true);
    expect(income.every((a) => a.balance === 0)).toBe(true);
    expect(totalExpenses).toBe(0);
    expect(totalIncome).toBe(0);
  });
});
