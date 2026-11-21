"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 text-[#153C66]", className)}
      classNames={{
        root: "w-fit",
        months: "flex flex-col sm:flex-row gap-4 relative",
        month: "flex flex-col gap-3",
        month_caption: "flex justify-center pt-1 relative items-center h-8",
        caption_label: "text-xs font-bold uppercase tracking-wider text-[#153C66]",
        nav: "flex items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "absolute left-1 top-1 size-7"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "absolute right-1 top-1 size-7"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-[#7B8896] w-8 font-bold text-[10px] uppercase tracking-wider text-center py-1",
        week: "flex w-full mt-1",
        day: "relative p-0 text-center text-xs focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "size-8 p-0 font-medium text-xs aria-selected:opacity-100 rounded-lg"
        ),
        selected:
          "bg-[#153C66] text-white hover:bg-[#12878F] hover:text-white rounded-lg",
        today: "bg-[#F4F6F9] text-[#12878F] font-bold rounded-lg",
        outside: "text-[#7B8896]/50",
        disabled: "text-[#7B8896]/40 opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-3.5" {...rest} />
          ) : (
            <ChevronRight className="size-3.5" {...rest} />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };

