"use client";

import { FileText, Loader2 } from "lucide-react";

type SearchResult = {
  id: string;
  title: string;
  file_name: string;
  category_id: string;
  level: string;
  uploaded_at: string;
};

type Props = {
  results: SearchResult[];
  loading: boolean;
  query: string;
  onSelect: (docId: string) => void;
};

export default function DocumentSearchResults({ results, loading, query, onSelect }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-sm text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        Suche nach &ldquo;{query}&rdquo;…
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
        Keine Ergebnisse für &ldquo;{query}&rdquo;
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {results.map((doc) => (
        <button
          key={doc.id}
          onClick={() => onSelect(doc.id)}
          className="flex items-start gap-3 w-full px-4 py-3 text-left transition-colors
            hover:bg-gray-50 dark:hover:bg-gray-800/50"
        >
          <FileText className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {doc.title}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
              {doc.file_name}
            </p>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
            {new Date(doc.uploaded_at).toLocaleDateString("de-DE")}
          </span>
        </button>
      ))}
    </div>
  );
}
