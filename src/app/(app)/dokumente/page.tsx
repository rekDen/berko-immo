"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  Upload,
  File as FileIcon,
  Download,
  Pencil,
  Trash2,
  ChevronRight,
  Home,
  Loader2,
  Search,
  X,
} from "lucide-react";

type FolderRow = { id: string; parent_id: string | null; name: string };
type FileRow = {
  id: string;
  folder_id: string | null;
  name: string;
  file_size: number | null;
  mime_type: string | null;
  updated_at: string;
};

const DRAG_MIME = "application/x-dokument";

function formatSize(bytes: number | null): string {
  if (!bytes) return "–";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function DokumentePage() {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOverMain, setDragOverMain] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | "root" | null>(null);
  const [renaming, setRenaming] = useState<{ kind: "folder" | "file"; id: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ folders: FolderRow[]; files: FileRow[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, FolderRow[]>();
    for (const f of folders) {
      const key = f.parent_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return map;
  }, [folders]);

  const subfolders = childrenOf.get(currentId) ?? [];

  const loadFolders = useCallback(async () => {
    const res = await fetch("/api/folders");
    if (res.ok) setFolders(await res.json());
  }, []);

  const loadFiles = useCallback(async (folderId: string | null) => {
    const res = await fetch(`/api/files?folder_id=${folderId ?? "root"}`);
    if (res.ok) setFiles(await res.json());
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadFolders(), loadFiles(null)]);
      setLoading(false);
    })();
  }, [loadFolders, loadFiles]);

  useEffect(() => {
    loadFiles(currentId);
  }, [currentId, loadFiles]);

  // Suche (debounced)
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults(null);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/dokumente/search?q=${encodeURIComponent(search)}`);
      if (res.ok) setSearchResults(await res.json());
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  // Breadcrumb-Pfad
  const breadcrumb = useMemo(() => {
    const path: FolderRow[] = [];
    let id = currentId;
    const byId = new Map(folders.map((f) => [f.id, f]));
    while (id) {
      const f = byId.get(id);
      if (!f) break;
      path.unshift(f);
      id = f.parent_id;
    }
    return path;
  }, [currentId, folders]);

  async function handle(res: Response): Promise<boolean> {
    if (res.ok) {
      setError("");
      return true;
    }
    const body = await res.json().catch(() => ({}));
    setError(body.error ?? "Aktion fehlgeschlagen");
    return false;
  }

  async function createFolder() {
    const name = window.prompt("Name des neuen Ordners:");
    if (!name?.trim()) return;
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_id: currentId }),
    });
    if (await handle(res)) await loadFolders();
  }

  async function uploadFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    if (!arr.length) return;
    setUploading(true);
    setError("");
    for (const file of arr) {
      const form = new FormData();
      form.append("file", file);
      if (currentId) form.append("folder_id", currentId);
      const res = await fetch("/api/files/upload", { method: "POST", body: form });
      await handle(res);
    }
    setUploading(false);
    await loadFiles(currentId);
  }

  async function deleteFolder(f: FolderRow) {
    if (!window.confirm(`Ordner „${f.name}" mit gesamtem Inhalt löschen?`)) return;
    const res = await fetch(`/api/folders/${f.id}`, { method: "DELETE" });
    if (await handle(res)) {
      await loadFolders();
      if (currentId === f.id) setCurrentId(f.parent_id);
    }
  }

  async function deleteFile(f: FileRow) {
    if (!window.confirm(`Datei „${f.name}" löschen?`)) return;
    const res = await fetch(`/api/files/${f.id}`, { method: "DELETE" });
    if (await handle(res)) await loadFiles(currentId);
  }

  function startRename(kind: "folder" | "file", id: string, current: string) {
    setRenaming({ kind, id });
    setRenameValue(current);
  }

  async function commitRename() {
    if (!renaming || !renameValue.trim()) {
      setRenaming(null);
      return;
    }
    const url = renaming.kind === "folder" ? `/api/folders/${renaming.id}` : `/api/files/${renaming.id}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue }),
    });
    if (await handle(res)) {
      if (renaming.kind === "folder") await loadFolders();
      else await loadFiles(currentId);
    }
    setRenaming(null);
  }

  async function downloadFile(id: string) {
    const res = await fetch(`/api/files/${id}/download`);
    if (!(await handle(res))) return;
    const { url } = await res.json();
    window.open(url, "_blank");
  }

  async function moveItem(kind: "folder" | "file", id: string, targetFolderId: string | null) {
    const url = kind === "folder" ? `/api/folders/${id}` : `/api/files/${id}`;
    const payload = kind === "folder" ? { parent_id: targetFolderId } : { folder_id: targetFolderId };
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (await handle(res)) {
      await loadFolders();
      await loadFiles(currentId);
    }
  }

  // ---- Drag & Drop -----------------------------------------------------
  function onRowDragStart(e: React.DragEvent, kind: "folder" | "file", id: string) {
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ kind, id }));
    e.dataTransfer.effectAllowed = "move";
  }

  function onFolderDrop(e: React.DragEvent, targetFolderId: string | null) {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    setDragOverMain(false);
    if (e.dataTransfer.files.length) {
      // Desktop-Upload direkt in den Zielordner
      uploadInto(e.dataTransfer.files, targetFolderId);
      return;
    }
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    const { kind, id } = JSON.parse(raw) as { kind: "folder" | "file"; id: string };
    if (kind === "folder" && id === targetFolderId) return;
    moveItem(kind, id, targetFolderId);
  }

  async function uploadInto(list: FileList, folderId: string | null) {
    const prev = currentId;
    // temporär in Zielordner hochladen
    const arr = Array.from(list);
    setUploading(true);
    for (const file of arr) {
      const form = new FormData();
      form.append("file", file);
      if (folderId) form.append("folder_id", folderId);
      await handle(await fetch("/api/files/upload", { method: "POST", body: form }));
    }
    setUploading(false);
    if (prev === folderId) await loadFiles(currentId);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---- Rekursiver Ordnerbaum (Sidebar) ---------------------------------
  function FolderTreeNode({ folder, depth }: { folder: FolderRow; depth: number }) {
    const kids = childrenOf.get(folder.id) ?? [];
    const isOpen = expanded.has(folder.id);
    const isActive = currentId === folder.id;
    return (
      <div>
        <div
          onClick={() => setCurrentId(folder.id)}
          onDragOver={(e) => {
            e.preventDefault();
            setDropTarget(folder.id);
          }}
          onDragLeave={() => setDropTarget((t) => (t === folder.id ? null : t))}
          onDrop={(e) => onFolderDrop(e, folder.id)}
          className={`flex items-center gap-1 pr-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
            isActive
              ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          } ${dropTarget === folder.id ? "ring-2 ring-indigo-400" : ""}`}
          style={{ paddingLeft: depth * 14 + 4 }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(folder.id);
            }}
            className={`p-0.5 rounded ${kids.length ? "" : "invisible"}`}
          >
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          </button>
          {isOpen && kids.length ? <FolderOpen className="w-4 h-4 flex-shrink-0" /> : <Folder className="w-4 h-4 flex-shrink-0" />}
          <span className="truncate">{folder.name}</span>
        </div>
        {isOpen && kids.map((k) => <FolderTreeNode key={k.id} folder={k} depth={depth + 1} />)}
      </div>
    );
  }

  const rootFolders = childrenOf.get(null) ?? [];

  return (
    <div className="h-full flex flex-col">
      {/* Kopf */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex-1">Dokumente</h1>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen…"
            className="pl-9 pr-8 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white w-56"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-2.5 text-gray-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={createFolder}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <FolderPlus className="w-4 h-4" /> Neuer Ordner
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Hochladen
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div className="mx-6 mt-3 px-4 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Baum */}
        <aside className="w-64 border-r border-gray-200 dark:border-gray-800 overflow-y-auto p-3 flex-shrink-0">
          <div
            onClick={() => setCurrentId(null)}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTarget("root");
            }}
            onDragLeave={() => setDropTarget((t) => (t === "root" ? null : t))}
            onDrop={(e) => onFolderDrop(e, null)}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm mb-1 ${
              currentId === null
                ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            } ${dropTarget === "root" ? "ring-2 ring-indigo-400" : ""}`}
          >
            <Home className="w-4 h-4" /> Alle Dokumente
          </div>
          {rootFolders.map((f) => (
            <FolderTreeNode key={f.id} folder={f} depth={0} />
          ))}
        </aside>

        {/* Inhalt */}
        <section
          className={`flex-1 overflow-y-auto p-6 relative ${dragOverMain ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""}`}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              setDragOverMain(true);
            }
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDragOverMain(false);
          }}
          onDrop={(e) => onFolderDrop(e, currentId)}
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-4 flex-wrap">
            <button onClick={() => setCurrentId(null)} className="hover:text-gray-900 dark:hover:text-white">
              Alle Dokumente
            </button>
            {breadcrumb.map((b) => (
              <span key={b.id} className="flex items-center gap-1">
                <ChevronRight className="w-3.5 h-3.5" />
                <button onClick={() => setCurrentId(b.id)} className="hover:text-gray-900 dark:hover:text-white">
                  {b.name}
                </button>
              </span>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Lädt…
            </div>
          ) : searchResults ? (
            <SearchView
              results={searchResults}
              onOpenFolder={(id) => {
                setSearch("");
                setCurrentId(id);
              }}
              onDownload={downloadFile}
            />
          ) : (
            <div className="space-y-1">
              {subfolders.length === 0 && files.length === 0 && (
                <div className="text-sm text-gray-400 py-16 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                  Ordner ist leer — Dateien hierher ziehen oder oben „Hochladen“ wählen.
                </div>
              )}

              {subfolders.map((f) => (
                <div
                  key={f.id}
                  draggable
                  onDragStart={(e) => onRowDragStart(e, "folder", f.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropTarget(f.id);
                  }}
                  onDragLeave={() => setDropTarget((t) => (t === f.id ? null : t))}
                  onDrop={(e) => onFolderDrop(e, f.id)}
                  onDoubleClick={() => setCurrentId(f.id)}
                  className={`group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                    dropTarget === f.id ? "ring-2 ring-indigo-400" : ""
                  }`}
                >
                  <Folder className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                  {renaming?.kind === "folder" && renaming.id === f.id ? (
                    <RenameInput value={renameValue} onChange={setRenameValue} onCommit={commitRename} onCancel={() => setRenaming(null)} />
                  ) : (
                    <button onClick={() => setCurrentId(f.id)} className="flex-1 text-left text-sm text-gray-900 dark:text-white truncate">
                      {f.name}
                    </button>
                  )}
                  <RowActions
                    onRename={() => startRename("folder", f.id, f.name)}
                    onDelete={() => deleteFolder(f)}
                  />
                </div>
              ))}

              {files.map((f) => (
                <div
                  key={f.id}
                  draggable
                  onDragStart={(e) => onRowDragStart(e, "file", f.id)}
                  className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <FileIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  {renaming?.kind === "file" && renaming.id === f.id ? (
                    <RenameInput value={renameValue} onChange={setRenameValue} onCommit={commitRename} onCancel={() => setRenaming(null)} />
                  ) : (
                    <button onClick={() => downloadFile(f.id)} className="flex-1 text-left text-sm text-gray-900 dark:text-white truncate">
                      {f.name}
                    </button>
                  )}
                  <span className="text-xs text-gray-400 w-20 text-right flex-shrink-0">{formatSize(f.file_size)}</span>
                  <RowActions
                    onRename={() => startRename("file", f.id, f.name)}
                    onDelete={() => deleteFile(f)}
                    onDownload={() => downloadFile(f.id)}
                  />
                </div>
              ))}
            </div>
          )}

          {dragOverMain && (
            <div className="absolute inset-4 border-2 border-dashed border-indigo-400 rounded-xl flex items-center justify-center bg-indigo-50/70 dark:bg-indigo-950/40 pointer-events-none">
              <span className="text-indigo-600 dark:text-indigo-300 font-medium">Zum Hochladen ablegen</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RowActions({
  onRename,
  onDelete,
  onDownload,
}: {
  onRename: () => void;
  onDelete: () => void;
  onDownload?: () => void;
}) {
  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
      {onDownload && (
        <button onClick={onDownload} title="Herunterladen" className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500">
          <Download className="w-4 h-4" />
        </button>
      )}
      <button onClick={onRename} title="Umbenennen" className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500">
        <Pencil className="w-4 h-4" />
      </button>
      <button onClick={onDelete} title="Löschen" className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-gray-500 hover:text-red-600">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function RenameInput({
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit();
        if (e.key === "Escape") onCancel();
      }}
      className="flex-1 text-sm px-2 py-1 rounded border border-indigo-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
    />
  );
}

function SearchView({
  results,
  onOpenFolder,
  onDownload,
}: {
  results: { folders: FolderRow[]; files: FileRow[] };
  onOpenFolder: (id: string) => void;
  onDownload: (id: string) => void;
}) {
  const empty = results.folders.length === 0 && results.files.length === 0;
  if (empty) return <div className="text-sm text-gray-400 py-12 text-center">Keine Treffer.</div>;
  return (
    <div className="space-y-1">
      {results.folders.map((f) => (
        <button
          key={f.id}
          onClick={() => onOpenFolder(f.id)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 text-left"
        >
          <Folder className="w-5 h-5 text-indigo-500" />
          <span className="text-sm text-gray-900 dark:text-white">{f.name}</span>
        </button>
      ))}
      {results.files.map((f) => (
        <button
          key={f.id}
          onClick={() => onDownload(f.id)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 text-left"
        >
          <FileIcon className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-900 dark:text-white">{f.name}</span>
        </button>
      ))}
    </div>
  );
}
