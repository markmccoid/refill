import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { ConvexClientProvider } from "@/app/providers";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Refill — Supplement Tracker",
  description: "Track household supplements, costs, and reorder prices.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: the theme script below may add .dark to <html>
    // before React hydrates, which is expected, not a mismatch to fix.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg">
        {/* Theme before paint. Must live inside <body> — <html> may only
            contain <head> and <body>. Kept in sync with ThemeToggle.tsx. */}
        <Script id="refill-theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem("refill-theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`}
        </Script>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
