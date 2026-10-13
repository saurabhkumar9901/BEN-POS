import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "BEN/POS Intelligence",
  description: "Shareholder data analytics, screening and ownership intelligence",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-paper text-ink antialiased">
        <div className="flex h-[6px]" aria-hidden>
          <span className="flex-1 bg-lime" />
          <span className="flex-1 bg-orange" />
          <span className="flex-1 bg-blue" />
          <span className="flex-1 bg-pink" />
        </div>
        {/* Shell reads the session cookie, so it must sit inside Suspense:
            with cacheComponents enabled, runtime data outside Suspense
            blocks prerendering (/_not-found) and fails `next build`. */}
        <Suspense
          fallback={
            <main className="mx-auto max-w-[1800px] px-4 pt-0 pb-9 md:px-8">
              <p className="py-8 font-mono text-sm text-muted">Loading…</p>
            </main>
          }
        >
          <Shell>{children}</Shell>
        </Suspense>
      </body>
    </html>
  );
}
