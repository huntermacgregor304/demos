import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        ice: "border-transparent bg-ice/15 text-ice",
        brass: "border-transparent bg-brass/15 text-brass",
        mint: "border-transparent bg-mint/15 text-mint",
        coral: "border-transparent bg-coral/15 text-coral",
        violet: "border-transparent bg-violet/15 text-violet",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
