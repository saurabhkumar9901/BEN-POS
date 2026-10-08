"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Database,
  LayoutDashboard,
  ShieldAlert,
  Trophy,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard, active: "bg-lime text-ink border-lime" },
  { href: "/companies", label: "Companies", icon: Building2, active: "bg-orange text-ink border-orange" },
  { href: "/shareholders", label: "Investors", icon: UsersRound, active: "bg-blue text-white border-blue" },
  { href: "/leaders", label: "Leaders", icon: Trophy, active: "bg-pink text-ink border-pink" },
  { href: "/holdings", label: "Holdings", icon: Database, active: "bg-lime text-ink border-lime" },
  { href: "/ingestion", label: "Ingestion", icon: ShieldAlert, active: "bg-ink text-lime border-lime" },
];

export function SideNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
  return (
    <nav aria-label="Primary navigation" className="grid gap-[5px]">
      {NAV.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex min-h-[42px] items-center gap-[11px] border border-transparent px-3 text-[13px] font-bold text-[#b8bbb2] hover:text-white",
            isActive(href) && active
          )}
        >
          <Icon size={17} strokeWidth={2.5} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
