"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-[#C6CAD5] bg-white shadow-2xs transition-colors outline-none focus-visible:border-[#12878F] focus-visible:ring-2 focus-visible:ring-[#12878F]/30 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[#12878F] data-[state=checked]:bg-[#12878F] data-[state=checked]:text-white cursor-pointer",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="size-3 stroke-[2.6]" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };

