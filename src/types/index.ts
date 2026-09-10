export interface Email {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  body: string;
  date: string;
  category:
    | "objektbezogen"
    | "mieterkommunikation"
    | "finanzen"
    | "schaeden"
    | "vertraege"
    | "weg"
    | "behoerden"
    | "dienstleister"
    | "termine"
    | "intern"
    | "newsletter";
  folder: "inbox" | "sent" | "draft";
  read: boolean;
  starred: boolean;
  aiSummary: string;
  aiDraft: string;
  aiLegal: string;
  toAddress: string | null;
  cc: string | null;
  bcc: string | null;
  linkedContactId: string | null;
  linkedPropertyId: string | null;
  linkedTicketId: string | null;
  linkedContractId: string | null;
}

export interface Deadline {
  id: string;
  date: string;
  title: string;
  description: string;
  type: "frist" | "termin";
  az: string;
  completed: boolean;
  assignedTo: string;
}

export interface LegalQA {
  q: string;
  a: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}
