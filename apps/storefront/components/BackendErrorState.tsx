"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface BackendErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function BackendErrorState({
  title = "Backend Service Unavailable",
  message,
  onRetry,
  retrying = false,
}: BackendErrorStateProps) {
  const router = useRouter();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      router.refresh();
    }
  };

  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50/70 p-8 sm:p-10 text-center space-y-4"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
        <AlertTriangle className="size-6" />
      </div>
      <div className="space-y-1.5">
        <h3 className="font-display text-lg sm:text-xl font-bold text-[#153C66]">
          {title}
        </h3>
        <p className="mx-auto max-w-xl text-xs sm:text-sm text-[#7B8896]">
          {message}
        </p>
      </div>
      <div>
        <Button
          type="button"
          variant="outline-navy"
          size="sm"
          onClick={handleRetry}
          disabled={retrying}
          className="gap-2"
        >
          <RefreshCw className={`size-3.5 ${retrying ? "animate-spin" : ""}`} />
          {retrying ? "Retrying..." : "Retry Connection"}
        </Button>
      </div>
    </div>
  );
}
