import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in · BEN/POS Intelligence",
  description: "Sign in to access the BEN/POS command desk.",
};

export default function LoginPage() {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-120px)] max-w-[960px] items-center py-10">
      <div className="grid overflow-hidden border-2 border-ink bg-panel shadow-[8px_8px_0_var(--color-ink)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Brand panel */}
        <div className="flex flex-col justify-between gap-8 bg-ink p-7 text-white">
          <div className="flex items-center gap-[11px]">
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
          </div>

          <div>
            <p className="font-mono text-[10px] font-bold tracking-[0.16em] text-lime">
              COMMAND DESK / ACCESS
            </p>
            <h1 className="mt-3 text-[clamp(30px,4vw,44px)] leading-[0.95] font-bold tracking-[-0.04em]">
              Ownership, <br />
              <span className="bg-lime px-2 text-ink">resolved.</span>
            </h1>
            <p className="mt-4 max-w-[300px] text-[13px] leading-relaxed text-[#b8bbb2]">
              Sign in with the operator account to interrogate positions,
              investors and cross-company signals.
            </p>
          </div>

          <div className="flex items-start gap-[10px] border border-[#393b35] p-[13px] text-lime">
            <ShieldCheck size={18} className="shrink-0" />
            <div className="grid gap-1">
              <strong className="text-[11px] text-white">
                Authorized research
              </strong>
              <span className="font-mono text-[9px] text-[#8f9288]">
                Names visible · PAN / account / phone / email suppressed
              </span>
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="p-7 md:p-9">
          <p className="font-mono text-[10px] font-bold tracking-[0.16em] text-muted">
            OPERATOR SIGN IN
          </p>
          <h2 className="mt-2 mb-6 text-[24px] font-bold tracking-[-0.02em]">
            Welcome back.
          </h2>
          <LoginForm />
        </div>
      </div>

      <p className="mt-4 text-center font-mono text-[9px] tracking-[0.14em] text-muted">
        BEN/POS LOCAL RESEARCH DESK · DO NOT DISTRIBUTE PERSONAL DATA
      </p>
    </div>
  );
}
