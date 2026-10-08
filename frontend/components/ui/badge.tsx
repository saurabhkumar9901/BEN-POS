import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border border-ink px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "bg-panel text-ink",
        lime: "bg-lime text-ink",
        orange: "bg-orange text-ink",
        pink: "bg-pink text-ink",
        blue: "bg-blue text-white",
        ink: "bg-ink text-paper",
        high: "bg-lime text-ink",
        medium: "bg-orange text-ink",
        low: "bg-pink text-ink",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
