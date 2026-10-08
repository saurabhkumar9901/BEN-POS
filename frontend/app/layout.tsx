import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Suspense } from "react";
import "./globals.css";
import { SideNav } from "@/components/SideNav";

export const metadata: Metadata = {
  title: "BEN/POS Intelligence",
  description: "Shareholder data analytics, screening and ownership intelligence",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-paper text-ink antialiased">
        <div className="flex min-h-screen">
          <aside className="fixed inset-y-0 left-0 z-40 hidden w-[236px] flex-col bg-ink px-[18px] py-6 text-white md:flex">
            <Link href="/" className="flex items-center gap-[11px] px-1 pb-7">
              <span className="grid h-11 w-11 -rotate-3 place-items-center border-2 border-lime font-mono text-sm font-extrabold text-lime">
                B/P
              </span>
              <span className="grid gap-[2px]">
                <strong className="font-mono text-[18px] leading-none font-black tracking-[0.04em]">
                  BEN/POS
                </strong>
                <span className="font-mono text-[9px] font-bold tracking-[0.18em] text-[#a7a99f]">
                  INTELLIGENCE
                </span>
              </span>
            </Link>
            <Suspense>
              <SideNav showIngestion={(process.env.DATA_SOURCE ?? "local") !== "motherduck"} />
            </Suspense>
            <div className="my-[26px] h-px bg-[#343630]" />
            <span className="mx-3 mb-3 font-mono text-[9px] font-bold tracking-[0.18em] text-[#777a71]">
              DATA SOURCES
            </span>
            <div className="grid grid-cols-[8px_1fr] items-center gap-x-[9px] gap-y-1 px-3 py-[9px] text-[12px]">
              <span className="h-[7px] w-[7px] rounded-full bg-orange" />
              CDSL RT02
              <small className="col-start-2 -mt-[6px] font-mono text-[10px] text-[#777a71]">
                104 fields
              </small>
            </div>
            <div className="grid grid-cols-[8px_1fr] items-center gap-x-[9px] gap-y-1 px-3 py-[9px] text-[12px]">
              <span className="h-[7px] w-[7px] rounded-full bg-blue" />
              NSDL BENPOS
              <small className="col-start-2 -mt-[6px] font-mono text-[10px] text-[#777a71]">
                84 fields
              </small>
            </div>
            <div className="mt-auto flex items-start gap-[10px] border border-[#393b35] p-[13px] text-lime">
              <ShieldCheck size={18} className="shrink-0" />
              <div className="grid gap-1">
                <strong className="text-[11px] text-white">Authorized research</strong>
                <span className="font-mono text-[9px] text-[#8f9288]">
                  Names visible · PAN / account / phone / email suppressed
                </span>
              </div>
            </div>
          </aside>
          <div className="min-w-0 flex-1 md:ml-[236px]">
            <div className="flex h-[6px]" aria-hidden>
              <span className="flex-1 bg-lime" />
              <span className="flex-1 bg-orange" />
              <span className="flex-1 bg-blue" />
              <span className="flex-1 bg-pink" />
            </div>
            <header className="border-b-2 border-ink">
              <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-4 py-3 md:px-8">
                <Link href="/" className="font-mono font-black md:hidden">
                  B<span className="text-muted">/</span>P
                </Link>
                <span className="hidden font-mono text-[10px] font-bold tracking-[0.16em] text-muted md:block">
                  BENEFICIARY POSITION / COMMAND DESK
                </span>
                <span className="border border-ink bg-panel px-2 py-1 font-mono text-[9px] font-bold">
                  WEEKLY BENPOS · NAMES VISIBLE · PII SUPPRESSED
                </span>
              </div>
            </header>
            <main className="mx-auto max-w-[1800px] px-4 pt-0 pb-9 md:px-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
