// ─── Base ──────────────────────────────────────────────────────

type BaseFields = {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  deleted_at: string | null;
};

// ─── Document Level ────────────────────────────────────────────

export type DocumentLevel = "property" | "unit" | "contract";

// ─── Document Categories ───────────────────────────────────────

export type DocumentCategory = {
  id: string;
  parent_id: string | null;
  code: string;
  group_code: string;
  name_de: string;
  name_en: string;
  name_ru: string;
  level: DocumentLevel;
  allowed_roles: string[];
  supports_fiscal_year: boolean;
  search_synonyms: string[];
  sort_order: number;
};

export type CategoryTreeNode = DocumentCategory & {
  children: CategoryTreeNode[];
  doc_count?: number;
};

// ─── Document Markers ──────────────────────────────────────────

export type DocumentMarker = {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  color: string | null;
  created_at: string;
  created_by: string | null;
};

export type DocumentMarkerInsert = Omit<DocumentMarker, "id" | "created_at"> & {
  id?: string;
};

// ─── Document Batches ──────────────────────────────────────────

export type BatchType = "mass_upload" | "mailing" | "handover";
export type BatchStatus = "draft" | "processing" | "completed" | "partially_failed";

export type DocumentBatch = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  batch_type: BatchType;
  target_category_id: string | null;
  target_level: DocumentLevel | null;
  status: BatchStatus;
  created_at: string;
  created_by: string | null;
};

// ─── Documents ─────────────────────────────────────────────────

export type Document = BaseFields & {
  category_id: string;
  level: DocumentLevel;
  property_id: string | null;
  unit_id: string | null;
  contract_id: string | null;
  title: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  file_hash: string | null;
  fiscal_year: number | null;
  markers: string[];
  visibility_override: Record<string, unknown> | null;
  internal_only: boolean;
  batch_id: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  deleted_by: string | null;
};

export type DocumentInsert = Omit<
  Document,
  "id" | "created_at" | "updated_at" | "deleted_at" | "deleted_by"
> & {
  id?: string;
};

// ─── Document Access Log ───────────────────────────────────────

export type DocumentAccessAction = "view" | "download" | "preview";

export type DocumentAccessLog = {
  id: string;
  document_id: string;
  user_id: string | null;
  contact_id: string | null;
  action: DocumentAccessAction;
  ip_address: string | null;
  user_agent: string | null;
  occurred_at: string;
};

// ─── Document Handovers ────────────────────────────────────────

export type HandoverStatus = "requested" | "approved" | "completed" | "cancelled";

export type DocumentHandover = {
  id: string;
  property_id: string;
  from_tenant_id: string;
  to_tenant_id: string;
  status: HandoverStatus;
  requested_by: string | null;
  approved_by: string | null;
  completed_at: string | null;
  snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

// ─── Document Shares ───────────────────────────────────────────

export type DocumentShare = {
  id: string;
  document_id: string;
  token: string;
  expires_at: string;
  password_hash: string | null;
  access_count: number;
  max_access: number | null;
  created_at: string;
  created_by: string | null;
};

// ─── Composed / View Types ─────────────────────────────────────

export type DocumentWithCategory = Document & {
  document_categories: DocumentCategory;
};

export type DocumentWithDetails = Document & {
  document_categories: DocumentCategory;
  properties: { id: string; name: string } | null;
  units: { id: string; unit_number: string } | null;
  contracts: { id: string; type: string } | null;
};

export type CategoryWithCount = {
  category_id: string;
  code: string;
  group_code: string;
  name_de: string;
  name_en: string;
  name_ru: string;
  level: DocumentLevel;
  doc_count: number;
};

export type DocumentVisibility = {
  level: DocumentLevel;
  property_id: string | null;
  unit_id: string | null;
  contract_id: string | null;
  internal_only: boolean;
  allowed_roles: string[];
  visibility_override: Record<string, unknown> | null;
};

// ─── Bulk Upload Types ──────────────────────────────────────��──

export type BulkUploadItem = {
  file_name: string;
  title: string;
  unit_id?: string;
  contract_id?: string;
};

export type BulkUploadRequest = {
  property_id: string;
  category_id: string;
  level: DocumentLevel;
  fiscal_year?: number;
  items: BulkUploadItem[];
};

// ─── Display helpers ───────────────────────────────────────────

export function localizedName<T extends Record<string, unknown>>(
  row: T,
  field: string,
  lang: string
): string {
  return (row[`${field}_${lang}`] as string) ?? (row[`${field}_de`] as string) ?? "";
}

export function categoryDisplayName(cat: DocumentCategory, lang: string = "de"): string {
  return localizedName(cat as unknown as Record<string, unknown>, "name", lang);
}

export function buildCategoryTree(categories: DocumentCategory[]): CategoryTreeNode[] {
  const groups = categories.filter((c) => !c.parent_id);
  const children = categories.filter((c) => c.parent_id);

  return groups
    .map((g) => ({
      ...g,
      children: children
        .filter((c) => c.parent_id === g.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => ({ ...c, children: [] })),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
