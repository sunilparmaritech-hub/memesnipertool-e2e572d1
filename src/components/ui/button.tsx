import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
        destructive: "bg-destructive/90 text-destructive-foreground hover:bg-destructive border border-destructive/20 shadow-sm",
        outline: "border border-border/60 bg-card/50 hover:bg-secondary/80 hover:border-border text-foreground shadow-sm",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/20 shadow-sm",
        ghost: "hover:bg-secondary/60 hover:text-foreground text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        glow: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--primary)/0.25)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.4)] border border-primary/20",
        success: "bg-success/90 text-success-foreground hover:bg-success border border-success/20 shadow-sm",
        warning: "bg-warning/90 text-warning-foreground hover:bg-warning border border-warning/20 shadow-sm",
        glass: "bg-card/50 backdrop-blur-xl border border-border/30 hover:bg-card/70 text-foreground hover:border-primary/30 shadow-sm",
      },
      size: {
        default: "h-9 px-3.5 py-2 text-sm",
        sm: "h-8 rounded-md px-2.5 text-xs",
        lg: "h-11 rounded-lg px-6 text-sm",
        icon: "h-9 w-9",
        xl: "h-12 rounded-xl px-8 text-base",
        xs: "h-7 rounded-md px-2 text-[11px]",
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
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
