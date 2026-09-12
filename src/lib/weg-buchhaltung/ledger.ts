// Reine Kontenplan-Auswertung (weg-buchhaltung-spec.md Kapitel 9, B7):
// Bilanz (Bestandskonten) und GuV (Erfolgskonten). Keine DB-Zugriffe hier —
// der Aufrufer liefert Konten und bereits zeitraum-gefilterte Buchungszeilen.

export type AccountKind = "asset" | "liability" | "equity" | "expense" | "income";

export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  kind: AccountKind;
}

export interface LedgerLine {
  accountId: string;
  debit: number | null;
  credit: number | null;
}

export interface AccountBalance {
  accountId: string;
  code: string;
  name: string;
  kind: AccountKind;
  /** Cents. Bei asset/expense: Soll-Saldo (debit − credit). Bei liability/equity/income: Haben-Saldo (credit − debit). */
  balance: number;
}

/** Debit-normale Kontenarten (Zunahme = Soll). Die übrigen (liability, equity, income) sind Haben-normal. */
const DEBIT_NORMAL: ReadonlySet<AccountKind> = new Set(["asset", "expense"]);

function accountBalance(account: LedgerAccount, lines: LedgerLine[]): number {
  const debit = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const credit = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  return DEBIT_NORMAL.has(account.kind) ? debit - credit : credit - debit;
}

function balancesFor(accounts: LedgerAccount[], lines: LedgerLine[], kinds: AccountKind[]): AccountBalance[] {
  return accounts
    .filter((a) => kinds.includes(a.kind))
    .map((a) => ({
      accountId: a.id,
      code: a.code,
      name: a.name,
      kind: a.kind,
      balance: accountBalance(a, lines.filter((l) => l.accountId === a.id)),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Bilanz: Bestände der Bestandskonten (asset/liability/equity) zu einem
 * Stichtag — der Aufrufer filtert `lines` bereits auf Buchungen bis
 * einschließlich dieses Datums.
 */
export function computeBalanceSheet(accounts: LedgerAccount[], lines: LedgerLine[]): {
  assets: AccountBalance[]; liabilitiesAndEquity: AccountBalance[]; totalAssets: number; totalLiabilitiesAndEquity: number;
} {
  const assets = balancesFor(accounts, lines, ["asset"]);
  const liabilitiesAndEquity = balancesFor(accounts, lines, ["liability", "equity"]);
  return {
    assets,
    liabilitiesAndEquity,
    totalAssets: assets.reduce((s, a) => s + a.balance, 0),
    totalLiabilitiesAndEquity: liabilitiesAndEquity.reduce((s, a) => s + a.balance, 0),
  };
}

/**
 * GuV: Aufwand/Ertrag je Erfolgskonto (= je Kostenart, 1:1 verknüpft) für
 * einen Zeitraum — der Aufrufer filtert `lines` bereits auf den Zeitraum.
 */
export function computeIncomeStatement(accounts: LedgerAccount[], lines: LedgerLine[]): {
  expenses: AccountBalance[]; income: AccountBalance[]; totalExpenses: number; totalIncome: number; result: number;
} {
  const expenses = balancesFor(accounts, lines, ["expense"]);
  const income = balancesFor(accounts, lines, ["income"]);
  const totalExpenses = expenses.reduce((s, a) => s + a.balance, 0);
  const totalIncome = income.reduce((s, a) => s + a.balance, 0);
  return { expenses, income, totalExpenses, totalIncome, result: totalIncome - totalExpenses };
}
