import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-lg border border-[#C6CAD5] bg-white px-3.5 py-2.5 text-sm text-[#153C66] shadow-2xs transition-[color,box-shadow,border-color] outline-none placeholder:text-[#7B8896]/70 disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-[#12878F] focus-visible:ring-2 focus-visible:ring-[#12878F]/25",
        "aria-invalid:border-red-500 aria-invalid:ring-red-500/20",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };

