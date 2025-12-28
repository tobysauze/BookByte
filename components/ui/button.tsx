import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))] hover:opacity-90",
        secondary:
          "bg-[rgb(var(--card))] text-[rgb(var(--foreground))] shadow-sm border border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]",
        ghost: "bg-transparent text-[rgb(var(--foreground))] hover:bg-black/5 dark:hover:bg-white/5",
        outline:
          "border border-[rgb(var(--border))] bg-transparent text-[rgb(var(--foreground))] hover:bg-black/5 dark:hover:bg-white/5",
        destructive: "bg-red-500 text-white hover:bg-red-500/90",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref as never}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };







