"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-gray-900 dark:text-white mt-4 mb-1.5 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold text-gray-900 dark:text-white mt-4 mb-1.5 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-3 mb-1 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 mb-2 last:mb-0">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-700 dark:text-gray-300">{children}</em>
  ),
  del: ({ children }) => (
    <del className="line-through text-gray-400 dark:text-gray-500">{children}</del>
  ),
  ul: ({ children }) => (
    <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 mb-2 last:mb-0 ml-4 list-disc">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-1 mb-2 last:mb-0 ml-4 list-decimal">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 my-2 text-gray-500 dark:text-gray-400 italic text-sm">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs font-mono text-gray-800 dark:text-gray-200">
      {children}
    </code>
  ),
  hr: () => (
    <hr className="my-3 border-gray-200 dark:border-gray-700" />
  ),
};

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
