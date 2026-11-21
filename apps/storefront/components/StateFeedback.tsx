"use client";

import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileQuestion,
  Loader2,
  Lock,
  PackageOpen,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type FeedbackStateKind =
  | "loading"
  | "empty"
  | "unavailable"
  | "error"
  | "pending_approval"
  | "quote_only"
  | "eligible_buy"
  | "payment_verifying"
  | "permission_denied"
  | "confirmed_success";

interface StateFeedbackProps {
  kind: FeedbackStateKind;
  title: string;
  description: string;
  badgeLabel?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  actionLoading?: boolean;
  secondaryLabel?: string;
  secondaryHref?: string;
  className?: string;
}

const KIND_CONFIG: Record<
  FeedbackStateKind,
  {
    icon: typeof Clock;
    containerClass: string;
    iconClass: string;
    badgeVariant: "default" | "teal" | "secondary" | "warning" | "destructive" | "success";
    defaultBadge: string;
  }
> = {
  loading: {
    icon: Loader2,
    containerClass: "border-[#DCE4EE] bg-[#F8FAFC]",
    iconClass: "bg-[#E5F7F6] text-[#079D9A] animate-spin",
    badgeVariant: "secondary",
    defaultBadge: "Loading",
  },
  empty: {
    icon: PackageOpen,
    containerClass: "border-[#DCE4EE] bg-[#F8FAFC]",
    iconClass: "bg-white text-[#102D4D] border border-[#DCE4EE]",
    badgeVariant: "secondary",
    defaultBadge: "No Records",
  },
  unavailable: {
    icon: ShieldAlert,
    containerClass: "border-amber-200 bg-amber-50/70",
    iconClass: "bg-amber-100 text-amber-800",
    badgeVariant: "warning",
    defaultBadge: "Unavailable / Pending API",
  },
  error: {
    icon: AlertCircle,
    containerClass: "border-red-200 bg-red-50/70",
    iconClass: "bg-red-100 text-red-700",
    badgeVariant: "destructive",
    defaultBadge: "Connection Error",
  },
  pending_approval: {
    icon: Clock,
    containerClass: "border-amber-200 bg-amber-50/80",
    iconClass: "bg-amber-100 text-amber-800",
    badgeVariant: "warning",
    defaultBadge: "Pending Approval",
  },
  quote_only: {
    icon: FileQuestion,
    containerClass: "border-[#079D9A]/30 bg-[#E5F7F6]/60",
    iconClass: "bg-white text-[#079D9A] border border-[#079D9A]/25",
    badgeVariant: "teal",
    defaultBadge: "Quote / Enquiry Only",
  },
  eligible_buy: {
    icon: CheckCircle2,
    containerClass: "border-emerald-200 bg-emerald-50/60",
    iconClass: "bg-emerald-100 text-emerald-700",
    badgeVariant: "success",
    defaultBadge: "Eligible for Order",
  },
  payment_verifying: {
    icon: Loader2,
    containerClass: "border-[#174B78]/30 bg-[#EAF0F6]",
    iconClass: "bg-white text-[#174B78] animate-spin",
    badgeVariant: "default",
    defaultBadge: "Verifying Payment",
  },
  permission_denied: {
    icon: Lock,
    containerClass: "border-red-200 bg-red-50/70",
    iconClass: "bg-red-100 text-red-700",
    badgeVariant: "destructive",
    defaultBadge: "Access Restricted",
  },
  confirmed_success: {
    icon: CheckCircle2,
    containerClass: "border-emerald-200 bg-emerald-50/80",
    iconClass: "bg-emerald-100 text-emerald-700",
    badgeVariant: "success",
    defaultBadge: "Confirmed",
  },
};

export function StateFeedback({
  kind,
  title,
  description,
  badgeLabel,
  actionLabel,
  actionHref,
  onAction,
  actionLoading = false,
  secondaryLabel,
  secondaryHref,
  className = "",
}: StateFeedbackProps) {
  const cfg = KIND_CONFIG[kind];
  const Icon = cfg.icon;
  const roleAttr =
    kind === "error" || kind === "permission_denied" ? "alert" : "status";

  return (
    <div
      role={roleAttr}
      aria-live={roleAttr === "alert" ? "assertive" : "polite"}
      className={`rounded-2xl border p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 ${cfg.containerClass} ${className}`}
    >
      <div className="flex items-start gap-4">
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${cfg.iconClass}`}
        >
          <Icon className="size-5" />
        </span>
        <div className="space-y-1.5">
          <Badge variant={cfg.badgeVariant}>
            {badgeLabel ?? cfg.defaultBadge}
          </Badge>
          <h3 className="font-display text-base sm:text-lg font-bold text-[#102D4D]">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-[#4A5B6E] leading-relaxed max-w-2xl">
            {description}
          </p>
        </div>
      </div>

      {(actionLabel || secondaryLabel) && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {actionLabel && actionHref && (
            <Button asChild size="sm" variant="default">
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          )}
          {actionLabel && onAction && !actionHref && (
            <Button
              type="button"
              size="sm"
              variant="outline-navy"
              onClick={onAction}
              disabled={actionLoading}
              className="gap-1.5"
            >
              <RefreshCw
                className={`size-3.5 ${actionLoading ? "animate-spin" : ""}`}
              />
              {actionLoading ? "Working..." : actionLabel}
            </Button>
          )}
          {secondaryLabel && secondaryHref && (
            <Button asChild size="sm" variant="outline">
              <Link href={secondaryHref}>{secondaryLabel}</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
