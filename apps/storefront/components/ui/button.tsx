import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-semibold uppercase tracking-[0.11em] transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-[#12878F] focus-visible:ring-2 focus-visible:ring-[#12878F]/35 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-[#153C66] text-white shadow-xs hover:bg-[#12878F]",
        teal:
          "bg-[#12878F] text-white shadow-xs hover:bg-[#153C66]",
        destructive:
          "bg-red-700 text-white shadow-xs hover:bg-red-800 focus-visible:ring-red-500/30",
        outline:
          "border border-[#C6CAD5] bg-white text-[#153C66] shadow-2xs hover:border-[#153C66] hover:bg-[#F4F6F9]",
        "outline-navy":
          "border border-[#153C66] bg-white text-[#153C66] hover:bg-[#153C66] hover:text-white",
        secondary:
          "bg-[#F4F6F9] text-[#153C66] border border-[#C6CAD5]/80 hover:bg-[#E8EDF4]",
        ghost:
          "text-[#153C66] hover:bg-[#F4F6F9] hover:text-[#12878F]",
        link:
          "text-[#12878F] underline-offset-4 hover:underline tracking-normal normal-case",
      },
      size: {
        default: "h-10 px-5 py-2.5",
        sm: "h-8 rounded-md px-3 text-[11px]",
        lg: "h-12 rounded-xl px-6 text-xs",
        icon: "size-9 rounded-lg",
        "icon-sm": "size-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

function ButtonGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="button-group"
      role="group"
      className={cn(
        "inline-flex items-center rounded-lg border border-[#C6CAD5] bg-white p-0.5 [&>button]:rounded-md [&>button]:border-0 [&>button]:shadow-none",
        className
      )}
      {...props}
    />
  );
}

export { Button, ButtonGroup, buttonVariants };

