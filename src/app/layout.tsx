import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Berko AI — KI-Assistent für Hausverwaltungen",
  description: "KI-gestützte Hausverwaltung-Management-Software",
  icons: {
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180" }],
    icon: [
      { url: "/favicon/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
  },
  manifest: "/favicon/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="h-full" suppressHydrationWarning>
      {/* Anti-flicker: apply stored theme before React hydration */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('lexio-theme')||'dark';if(t==='dark')document.documentElement.classList.add('dark');})()`,
          }}
        />
      </head>
      <body
        className={`${inter.className} h-full antialiased bg-slate-50 text-gray-900 dark:bg-gray-950 dark:text-white`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
