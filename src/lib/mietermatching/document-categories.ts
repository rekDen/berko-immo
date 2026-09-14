import type { ApplicantDocType } from "./scoring";

// Kategorien aus scripts/migration-mietermatching-mm2.sql (level='unit',
// eigene Gruppe statt der bestehenden vertragsbezogenen MIETER_DOKUMENTE-
// Gruppe — ein Bewerber hat noch keinen Mietvertrag). Von der authentifizierten
// Upload-Route UND der öffentlichen Bewerbungsroute genutzt.
export const CATEGORY_BY_DOC_TYPE: Record<ApplicantDocType, string> = {
  income_proof: "dc000000-0000-0000-0015-000000000001",
  schufa: "dc000000-0000-0000-0015-000000000002",
  self_disclosure: "dc000000-0000-0000-0015-000000000003",
  other: "dc000000-0000-0000-0015-000000000004",
};
