"use client";

import { useRouter, usePathname } from "next/navigation";

export function DateSelect({ dates, value }: { dates: string[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <select
      value={value}
      onChange={(e) => router.push(`${pathname}?date=${e.target.value}`)}
      className="h-9 cursor-pointer appearance-none border border-ink bg-white pr-7 pl-3 text-[12px] outline-none"
    >
      {dates.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
    </select>
  );
}
