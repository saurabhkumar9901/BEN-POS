"use client";

import { useActionState } from "react";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { useState } from "react";
import { login } from "@/app/actions/auth";

const initialState = undefined;

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <div>
        <label
          htmlFor="username"
          className="mb-2 block font-mono text-[10px] font-extrabold tracking-[0.16em] text-muted"
        >
          USERNAME
        </label>
        <div className="flex items-center gap-2 border-2 border-ink bg-panel px-3 focus-within:bg-white">
          <User size={16} className="shrink-0 text-muted" aria-hidden />
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            autoFocus
            placeholder="Admin"
            className="h-11 w-full bg-transparent text-[14px] font-bold outline-none placeholder:font-normal placeholder:text-muted"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-2 block font-mono text-[10px] font-extrabold tracking-[0.16em] text-muted"
        >
          PASSWORD
        </label>
        <div className="flex items-center gap-2 border-2 border-ink bg-panel px-3 focus-within:bg-white">
          <Lock size={16} className="shrink-0 text-muted" aria-hidden />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="h-11 w-full bg-transparent text-[14px] font-bold outline-none placeholder:font-normal placeholder:text-muted"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="grid h-8 w-8 shrink-0 place-items-center border border-transparent text-muted hover:border-ink hover:text-ink"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {state?.error && (
        <p
          role="alert"
          className="border-2 border-ink bg-orange px-3 py-2 font-mono text-[11px] font-bold"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 border-2 border-ink bg-ink font-mono text-[12px] font-extrabold tracking-[0.14em] text-lime transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-lime)] disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? "VERIFYING…" : "SIGN IN →"}
      </button>

      <p className="m-0 font-mono text-[10px] leading-relaxed text-muted">
        Authorized research only. Single operator account — contact your
        administrator if you are locked out.
      </p>
    </form>
  );
}
