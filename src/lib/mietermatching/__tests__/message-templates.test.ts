import { describe, it, expect } from "vitest";
import {
  renderTemplate, buildApplicantMessageVars, findUnfilledPlaceholders,
  DEFAULT_INVITATION_SUBJECT, DEFAULT_INVITATION_BODY, DEFAULT_REJECTION_BODY,
} from "../message-templates";

describe("buildApplicantMessageVars", () => {
  it("befüllt die Standard-Platzhalter", () => {
    const vars = buildApplicantMessageVars({
      firstName: "Anna", lastName: "Musterfrau", unitLabel: "M01", unitAddress: "Musterstraße 1, 04103 Leipzig",
      managerName: "Frau Köhler", firmName: "Berko Hausverwaltung",
    });
    expect(vars.vorname).toBe("Anna");
    expect(vars.nachname).toBe("Musterfrau");
    expect(vars.einheit_bezeichnung).toBe("M01");
    expect(vars.besichtigungstermin).toBeUndefined();
  });

  it("befüllt besichtigungstermin nur wenn übergeben", () => {
    const vars = buildApplicantMessageVars({
      firstName: "Anna", lastName: "Musterfrau", unitLabel: "M01", unitAddress: "–",
      managerName: "Frau Köhler", firmName: "Berko Hausverwaltung", viewingAppointment: "Montag, 10 Uhr",
    });
    expect(vars.besichtigungstermin).toBe("Montag, 10 Uhr");
  });
});

describe("renderTemplate + findUnfilledPlaceholders", () => {
  it("rendert die Standard-Einladung vollständig, wenn besichtigungstermin gesetzt ist", () => {
    const vars = buildApplicantMessageVars({
      firstName: "Anna", lastName: "Musterfrau", unitLabel: "M01", unitAddress: "Musterstraße 1",
      managerName: "Frau Köhler", firmName: "Berko Hausverwaltung", viewingAppointment: "Montag, 10 Uhr",
    });
    const subject = renderTemplate(DEFAULT_INVITATION_SUBJECT, vars);
    const body = renderTemplate(DEFAULT_INVITATION_BODY, vars);
    expect(subject).toBe("Einladung zur Besichtigung — M01");
    expect(body).toContain("Montag, 10 Uhr");
    expect(findUnfilledPlaceholders(body)).toEqual([]);
  });

  it("meldet besichtigungstermin als unbefüllt, wenn keiner übergeben wurde", () => {
    const vars = buildApplicantMessageVars({
      firstName: "Anna", lastName: "Musterfrau", unitLabel: "M01", unitAddress: "Musterstraße 1",
      managerName: "Frau Köhler", firmName: "Berko Hausverwaltung",
    });
    const body = renderTemplate(DEFAULT_INVITATION_BODY, vars);
    expect(findUnfilledPlaceholders(body)).toEqual(["besichtigungstermin"]);
  });

  it("rendert die Standard-Absage ohne besichtigungstermin-Platzhalter vollständig", () => {
    const vars = buildApplicantMessageVars({
      firstName: "Anna", lastName: "Musterfrau", unitLabel: "M01", unitAddress: "Musterstraße 1",
      managerName: "Frau Köhler", firmName: "Berko Hausverwaltung",
    });
    const body = renderTemplate(DEFAULT_REJECTION_BODY, vars);
    expect(findUnfilledPlaceholders(body)).toEqual([]);
  });
});
