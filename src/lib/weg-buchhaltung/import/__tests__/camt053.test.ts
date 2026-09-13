import { describe, expect, it } from "vitest";
import { parseCamt053 } from "../camt053";

function wrap(schemaVersion: "02" | "08", stmtBody: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.${schemaVersion}">
  <BkToCstmrStmt>
    <Stmt>
      ${stmtBody}
    </Stmt>
  </BkToCstmrStmt>
</Document>`;
}

describe("parseCamt053", () => {
  it("parst Abflüsse (DBIT) als negative Beträge mit Kreditor-IBAN/-Name als Gegenpartei (Schema .02)", () => {
    const xml = wrap(
      "02",
      `<Id>STMT-1</Id>
       <Acct><Id><IBAN>DE00000000000000000001</IBAN></Id></Acct>
       <Ntry>
         <Amt Ccy="EUR">920.00</Amt>
         <CdtDbtInd>DBIT</CdtDbtInd>
         <Sts>BOOK</Sts>
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
       </Ntry>`,
    );
    const statements = parseCamt053(xml);
    expect(statements).toHaveLength(1);
    expect(statements[0].schemaVersion).toBe("002");
    expect(statements[0].iban).toBe("DE00000000000000000001");
    const [row] = statements[0].entries;
    expect(row.bookingDate).toBe("2026-03-05");
    expect(row.amount).toBe(-92000);
    expect(row.purpose).toBe("Reparatur Dachrinne");
    expect(row.counterpartyIban).toBe("DE12345678901234567890");
    expect(row.counterpartyName).toBe("Dachdecker Schmidt GmbH");
    expect(row.needsManualSplit).toBe(false);
    expect(row.batchParentId).toBeNull();
  });

  it("parst Zuflüsse (CRDT) als positive Beträge mit Debitor-IBAN/-Name als Gegenpartei, mehrere Ustrd zusammengefügt, Schema .08 mit RltdPties/Dbtr/Pty/Nm", () => {
    const xml = wrap(
      "08",
      `<Id>STMT-2</Id>
       <Acct><Id><IBAN>DE00000000000000000002</IBAN></Id></Acct>
       <Ntry>
         <Amt Ccy="EUR">1250.00</Amt>
         <CdtDbtInd>CRDT</CdtDbtInd>
         <Sts>BOOK</Sts>
         <BookgDt><Dt>2026-03-10</Dt></BookgDt>
         <NtryDtls>
           <TxDtls>
             <RmtInf>
               <Ustrd>Hausgeld W01</Ustrd>
               <Ustrd>Nachzahlung</Ustrd>
             </RmtInf>
             <RltdPties>
               <Dbtr><Pty><Nm>Erika Musterfrau</Nm></Pty></Dbtr>
               <DbtrAcct><Id><IBAN>DE98765432109876543210</IBAN></Id></DbtrAcct>
             </RltdPties>
           </TxDtls>
         </NtryDtls>
       </Ntry>`,
    );
    const statements = parseCamt053(xml);
    expect(statements[0].schemaVersion).toBe("008");
    const [row] = statements[0].entries;
    expect(row.amount).toBe(125000);
    expect(row.purpose).toBe("Hausgeld W01 Nachzahlung");
    expect(row.counterpartyIban).toBe("DE98765432109876543210");
    expect(row.counterpartyName).toBe("Erika Musterfrau");
  });

  it("ist deterministisch", () => {
    const xml = wrap(
      "02",
      `<Ntry><Amt Ccy="EUR">10.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts>BOOK</Sts><BookgDt><Dt>2026-01-01</Dt></BookgDt></Ntry>`,
    );
    expect(parseCamt053(xml)).toEqual(parseCamt053(xml));
  });

  it("liefert eine leere Liste ohne Stmt-Elemente", () => {
    expect(parseCamt053("<Document></Document>")).toEqual([]);
  });

  it("ignoriert vorgemerkte Umsätze (Sts=PDNG), behält gebuchte (Sts=BOOK)", () => {
    const xml = wrap(
      "02",
      `<Ntry><Amt Ccy="EUR">10.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts>PDNG</Sts><BookgDt><Dt>2026-01-01</Dt></BookgDt></Ntry>
       <Ntry><Amt Ccy="EUR">20.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts>BOOK</Sts><BookgDt><Dt>2026-01-02</Dt></BookgDt></Ntry>`,
    );
    const [stmt] = parseCamt053(xml);
    expect(stmt.entries).toHaveLength(1);
    expect(stmt.entries[0].amount).toBe(2000);
  });

  it("lehnt Umsätze mit Währung ungleich EUR ab (BC06)", () => {
    const xml = wrap(
      "02",
      `<Ntry><Amt Ccy="USD">50.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts>BOOK</Sts><BookgDt><Dt>2026-01-01</Dt></BookgDt></Ntry>`,
    );
    const [stmt] = parseCamt053(xml);
    expect(stmt.entries).toHaveLength(0);
    expect(stmt.rejectedEntries).toHaveLength(1);
    expect(stmt.rejectedEntries[0]).toMatchObject({ reason: "Währung ungleich EUR", currency: "USD" });
  });

  it("liest Anfangs-/Schlusssaldo aus Bal-Elementen (OPBD/CLBD)", () => {
    const xml = wrap(
      "02",
      `<Bal>
         <Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp>
         <Amt Ccy="EUR">1000.00</Amt>
         <CdtDbtInd>CRDT</CdtDbtInd>
       </Bal>
       <Bal>
         <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
         <Amt Ccy="EUR">850.00</Amt>
         <CdtDbtInd>CRDT</CdtDbtInd>
         <Dt><Dt>2026-01-31</Dt></Dt>
       </Bal>`,
    );
    const [stmt] = parseCamt053(xml);
    expect(stmt.openingBalance).toBe(100000);
    expect(stmt.closingBalance).toBe(85000);
    expect(stmt.closingDate).toBe("2026-01-31");
  });

  it("teilt eine Sammelbuchung mit passender Summe in Einzelposten mit gemeinsamer batchParentId auf", () => {
    const xml = wrap(
      "02",
      `<Ntry>
         <Amt Ccy="EUR">300.00</Amt>
         <CdtDbtInd>DBIT</CdtDbtInd>
         <Sts>BOOK</Sts>
         <BookgDt><Dt>2026-02-01</Dt></BookgDt>
         <NtryDtls>
           <TxDtls>
             <Amt Ccy="EUR">100.00</Amt>
             <RmtInf><Ustrd>Teil A</Ustrd></RmtInf>
             <RltdPties><Cdtr><Nm>Firma A</Nm></Cdtr></RltdPties>
           </TxDtls>
           <TxDtls>
             <Amt Ccy="EUR">200.00</Amt>
             <RmtInf><Ustrd>Teil B</Ustrd></RmtInf>
             <RltdPties><Cdtr><Nm>Firma B</Nm></Cdtr></RltdPties>
           </TxDtls>
         </NtryDtls>
       </Ntry>`,
    );
    const [stmt] = parseCamt053(xml);
    expect(stmt.entries).toHaveLength(2);
    expect(stmt.entries[0].amount).toBe(-10000);
    expect(stmt.entries[0].counterpartyName).toBe("Firma A");
    expect(stmt.entries[1].amount).toBe(-20000);
    expect(stmt.entries[1].counterpartyName).toBe("Firma B");
    expect(stmt.entries[0].batchParentId).not.toBeNull();
    expect(stmt.entries[0].batchParentId).toBe(stmt.entries[1].batchParentId);
    expect(stmt.entries[0].needsManualSplit).toBe(false);
  });

  it("markiert eine Sammelbuchung mit nicht passender Summe als einen Umsatz zur manuellen Aufteilung", () => {
    const xml = wrap(
      "02",
      `<Ntry>
         <Amt Ccy="EUR">300.00</Amt>
         <CdtDbtInd>DBIT</CdtDbtInd>
         <Sts>BOOK</Sts>
         <BookgDt><Dt>2026-02-01</Dt></BookgDt>
         <NtryDtls>
           <TxDtls><Amt Ccy="EUR">100.00</Amt></TxDtls>
           <TxDtls><Amt Ccy="EUR">150.00</Amt></TxDtls>
         </NtryDtls>
       </Ntry>`,
    );
    const [stmt] = parseCamt053(xml);
    expect(stmt.entries).toHaveLength(1);
    expect(stmt.entries[0].amount).toBe(-30000);
    expect(stmt.entries[0].needsManualSplit).toBe(true);
    expect(stmt.entries[0].batchParentId).toBeNull();
  });

  it("markiert einen Umsatz mit Btch/NbOfTxs > 1 aber ohne Einzelposten zur manuellen Aufteilung", () => {
    const xml = wrap(
      "02",
      `<Ntry>
         <Amt Ccy="EUR">500.00</Amt>
         <CdtDbtInd>DBIT</CdtDbtInd>
         <Sts>BOOK</Sts>
         <BookgDt><Dt>2026-02-01</Dt></BookgDt>
         <NtryDtls>
           <Btch><NbOfTxs>3</NbOfTxs></Btch>
         </NtryDtls>
       </Ntry>`,
    );
    const [stmt] = parseCamt053(xml);
    expect(stmt.entries).toHaveLength(1);
    expect(stmt.entries[0].needsManualSplit).toBe(true);
  });

  it("erkennt eine Rücklastschrift (RvslInd) und liest den Rückgabegrund", () => {
    const xml = wrap(
      "02",
      `<Ntry>
         <Amt Ccy="EUR">45.00</Amt>
         <CdtDbtInd>DBIT</CdtDbtInd>
         <Sts>BOOK</Sts>
         <RvslInd>true</RvslInd>
         <BookgDt><Dt>2026-02-05</Dt></BookgDt>
         <RtrInf><Rsn><Cd>AC04</Cd></Rsn></RtrInf>
         <NtryDtls><TxDtls>
           <Refs><EndToEndId>E2E-123</EndToEndId><MndtId>MNDT-1</MndtId></Refs>
         </TxDtls></NtryDtls>
       </Ntry>`,
    );
    const [stmt] = parseCamt053(xml);
    expect(stmt.entries[0].isReversal).toBe(true);
    expect(stmt.entries[0].returnReasonCode).toBe("AC04");
    expect(stmt.entries[0].endToEndId).toBe("E2E-123");
    expect(stmt.entries[0].mandateId).toBe("MNDT-1");
  });

  it("normalisiert die literale Ende-zu-Ende-Referenz NOTPROVIDED zu null", () => {
    const xml = wrap(
      "02",
      `<Ntry>
         <Amt Ccy="EUR">10.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts>BOOK</Sts>
         <BookgDt><Dt>2026-01-01</Dt></BookgDt>
         <NtryDtls><TxDtls><Refs><EndToEndId>NOTPROVIDED</EndToEndId></Refs></TxDtls></NtryDtls>
       </Ntry>`,
    );
    const [stmt] = parseCamt053(xml);
    expect(stmt.entries[0].endToEndId).toBeNull();
  });

  it("erhält Umlaute im Gegenparteinamen", () => {
    const xml = wrap(
      "02",
      `<Ntry>
         <Amt Ccy="EUR">10.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts>BOOK</Sts>
         <BookgDt><Dt>2026-01-01</Dt></BookgDt>
         <NtryDtls><TxDtls><RltdPties><Dbtr><Nm>Jürgen Müller-Weiß</Nm></Dbtr></RltdPties></TxDtls></NtryDtls>
       </Ntry>`,
    );
    const [stmt] = parseCamt053(xml);
    expect(stmt.entries[0].counterpartyName).toBe("Jürgen Müller-Weiß");
  });

  it("liest Bankreferenz, BIC und Bankgeschäftsvorfallcode", () => {
    const xml = wrap(
      "02",
      `<Ntry>
         <Amt Ccy="EUR">10.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts>BOOK</Sts>
         <BookgDt><Dt>2026-01-01</Dt></BookgDt>
         <AcctSvcrRef>REF-999</AcctSvcrRef>
         <BkTxCd><Domn><Cd>PMNT</Cd><Fmly><Cd>RCDT</Cd><SubFmlyCd>ESCT</SubFmlyCd></Fmly></Domn></BkTxCd>
         <NtryDtls><TxDtls>
           <RltdPties><Dbtr><Nm>Zahler</Nm></Dbtr></RltdPties>
           <RltdAgts><DbtrAgt><FinInstnId><BIC>GENODEF1XXX</BIC></FinInstnId></DbtrAgt></RltdAgts>
         </TxDtls></NtryDtls>
       </Ntry>`,
    );
    const [stmt] = parseCamt053(xml);
    const row = stmt.entries[0];
    expect(row.bankRef).toBe("REF-999");
    expect(row.counterpartyBic).toBe("GENODEF1XXX");
    expect(row.bankTxCode).toEqual({
      domainCode: "PMNT",
      familyCode: "RCDT",
      subFamilyCode: "ESCT",
      proprietaryCode: null,
    });
  });

  it("verarbeitet mehrere Stmt-Elemente in einer Datei getrennt", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Acct><Id><IBAN>DE00000000000000000001</IBAN></Id></Acct>
      <Ntry><Amt Ccy="EUR">10.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts>BOOK</Sts><BookgDt><Dt>2026-01-01</Dt></BookgDt></Ntry>
    </Stmt>
    <Stmt>
      <Acct><Id><IBAN>DE00000000000000000002</IBAN></Id></Acct>
      <Ntry><Amt Ccy="EUR">20.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts>BOOK</Sts><BookgDt><Dt>2026-01-02</Dt></BookgDt></Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;
    const statements = parseCamt053(xml);
    expect(statements).toHaveLength(2);
    expect(statements[0].iban).toBe("DE00000000000000000001");
    expect(statements[1].iban).toBe("DE00000000000000000002");
    expect(statements[0].entries[0].amount).toBe(1000);
    expect(statements[1].entries[0].amount).toBe(2000);
  });
});
