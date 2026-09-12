import { describe, expect, it } from "vitest";
import { parseCamt053 } from "../camt053";

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Ntry>
        <Amt Ccy="EUR">920.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2026-03-05</Dt></BookgDt>
        <NtryDtls>
          <TxDtls>
            <RmtInf><Ustrd>Reparatur Dachrinne</Ustrd></RmtInf>
            <RltdPties>
              <Cdtr><Nm>Dachdecker Schmidt GmbH</Nm></Cdtr>
              <CdtrAcct><Id><IBAN>DE12345678901234567890</IBAN></Id></CdtrAcct>
            </RltdPties>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="EUR">1250.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-03-10</Dt></BookgDt>
        <NtryDtls>
          <TxDtls>
            <RmtInf>
              <Ustrd>Hausgeld W01</Ustrd>
              <Ustrd>Nachzahlung</Ustrd>
            </RmtInf>
            <RltdPties>
              <Dbtr><Nm>Erika Musterfrau</Nm></Dbtr>
              <DbtrAcct><Id><IBAN>DE98765432109876543210</IBAN></Id></DbtrAcct>
            </RltdPties>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

describe("parseCamt053", () => {
  it("parst Abflüsse (DBIT) als negative Beträge mit Kreditor-IBAN/-Name als Gegenpartei", () => {
    const rows = parseCamt053(xml);
    expect(rows[0]).toEqual({
      bookingDate: "2026-03-05",
      amount: -92000,
      purpose: "Reparatur Dachrinne",
      counterpartyIban: "DE12345678901234567890",
      counterpartyName: "Dachdecker Schmidt GmbH",
    });
  });

  it("parst Zuflüsse (CRDT) als positive Beträge mit Debitor-IBAN/-Name als Gegenpartei, mehrere Ustrd zusammengefügt", () => {
    const rows = parseCamt053(xml);
    expect(rows[1]).toEqual({
      bookingDate: "2026-03-10",
      amount: 125000,
      purpose: "Hausgeld W01 Nachzahlung",
      counterpartyIban: "DE98765432109876543210",
      counterpartyName: "Erika Musterfrau",
    });
  });

  it("ist deterministisch", () => {
    expect(parseCamt053(xml)).toEqual(parseCamt053(xml));
  });

  it("liefert eine leere Liste ohne Ntry-Elemente", () => {
    expect(parseCamt053("<Document></Document>")).toEqual([]);
  });
});
