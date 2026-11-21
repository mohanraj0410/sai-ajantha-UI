import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Accessible form field wrapper pairing shadcn/ui Label with hint and validation messages.
 */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={htmlFor} className="flex items-center justify-between text-xs font-semibold text-[#102A43]">
        <span>
          {label}
          {required && (
            <span className="text-red-500 font-bold ml-1 select-none" aria-hidden="true">
              *
            </span>
          )}
        </span>
      </Label>
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-red-600 flex items-center gap-1 animate-in fade-in-50 duration-150">
          <span className="inline-block w-1 h-1 rounded-full bg-red-600" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-[#7B8896]">{hint}</p>
      ) : null}
    </div>
  );
}

