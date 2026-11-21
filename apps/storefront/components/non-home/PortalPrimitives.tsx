import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, Info, Lock, ShieldAlert } from "lucide-react";
import type { PortalStatusTone } from "@/lib/portal-helpers";

const TONE_STYLES: Record<PortalStatusTone, string> = {
  success: "bg-[#E6F6F2] text-[#065F46] border-[#A7DFD0]",
  warning: "bg-[#FEF7E6] text-[#92400E] border-[#F4D38B]",
  danger: "bg-[#FEF2F2] text-[#991B1B] border-[#F7B8B8]",
  info: "bg-[#EAF3FA] text-[#144470] border-[#BDD6EE]",
  neutral: "bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]",
};

export function StatusTag({
  label,
  tone = "neutral",
  compact = false,
}: {
  label: string;
  tone?: PortalStatusTone;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-semibold whitespace-nowrap ${
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
      } ${TONE_STYLES[tone]}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${
          tone === "success"
            ? "bg-[#059669]"
            : tone === "warning"
              ? "bg-[#D97706]"
              : tone === "danger"
                ? "bg-[#DC2626]"
                : tone === "info"
                  ? "bg-[#174B78]"
                  : "bg-[#64748B]"
        }`}
      />
      {label}
    </span>
  );
}

export interface KpiStatItem {
  label: string;
  value: string | number;
  detail?: string;
  accent?: boolean;
}

export function KpiStatRow({ items }: { items: KpiStatItem[] }) {
  return (
    <div className="sa-kpi-strip">
      {items.map((item) => (
        <div key={item.label} className="sa-kpi-cell">
          <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-[#5D6F82]">
            {item.label}
          </p>
          <p
            className={`mt-1.5 font-display text-2xl font-bold tracking-tight sa-tabular ${
              item.accent ? "text-[#076864]" : "text-[#0B1F35]"
            }`}
          >
            {item.value}
          </p>
          {item.detail && (
            <p className="mt-1 text-xs text-[#64748B] truncate">{item.detail}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function SectionCard({
  title,
  kicker,
  description,
  actions,
  children,
  padded = true,
  className = "",
}: {
  title?: string;
  kicker?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  className?: string;
}) {
  return (
    <section className={`sa-card overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[#E7EEF4] bg-[#FCFDFE]">
          <div className="min-w-0">
            {kicker && <p className="sa-group-label mb-0.5">{kicker}</p>}
            {title && (
              <h2 className="font-display text-base sm:text-lg font-bold text-[#0B1F35]">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-[#5D6F82] leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={padded ? "p-5 sm:p-6" : ""}>{children}</div>
    </section>
  );
}

export function WorkflowStepper({
  steps,
}: {
  steps: Array<{
    label: string;
    detail?: string;
    state: "done" | "active" | "upcoming";
  }>;
}) {
  return (
    <ol className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {steps.map((step, idx) => (
        <li
          key={step.label}
          className={`rounded-xl border p-3.5 transition-colors ${
            step.state === "active"
              ? "border-[#076864] bg-[#F0FAF9]"
              : step.state === "done"
                ? "border-[#C5E4DC] bg-[#F7FCFA]"
                : "border-[#E3ECF3] bg-[#FAFBFD]"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold sa-tabular ${
                step.state === "done"
                  ? "bg-[#059669] text-white"
                  : step.state === "active"
                    ? "bg-[#076864] text-white"
                    : "bg-[#E2E8F0] text-[#475569]"
              }`}
            >
              {step.state === "done" ? <Check className="size-3.5" /> : idx + 1}
            </span>
            <p className="text-xs font-bold text-[#0B1F35]">{step.label}</p>
          </div>
          {step.detail && (
            <p className="mt-1.5 pl-8 text-[11px] text-[#5D6F82] leading-relaxed">
              {step.detail}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

export function CommercialGateBanner({
  tone = "info",
  title,
  description,
  action,
}: {
  tone?: "info" | "warning" | "restricted";
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const styles =
    tone === "warning"
      ? "border-[#F3D18E] bg-[#FFFBEB] text-[#78350F]"
      : tone === "restricted"
        ? "border-[#F5C2C2] bg-[#FEF2F2] text-[#7F1D1D]"
        : "border-[#C5E3E0] bg-[#F1FAF9] text-[#0F3942]";

  const Icon =
    tone === "warning" ? ShieldAlert : tone === "restricted" ? Lock : Info;

  return (
    <div
      className={`rounded-xl border px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${styles}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <Icon className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-bold">{title}</p>
          <p className="mt-0.5 text-xs opacity-90 leading-relaxed">{description}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyStatePanel({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  primaryAction?: { label: string; href?: string; onClick?: () => void };
  secondaryAction?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#CBD7E3] bg-[#F9FBFD] px-6 py-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-white border border-[#DCE5EE] text-[#076864] shadow-xs">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-base font-bold text-[#0B1F35]">
        {title}
      </h3>
      <p className="mx-auto mt-1.5 max-w-md text-xs sm:text-sm text-[#5D6F82] leading-relaxed">
        {description}
      </p>
      {(primaryAction || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {primaryAction &&
            (primaryAction.href ? (
              <Link
                href={primaryAction.href}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#0B1F35] px-4 py-2 text-xs font-semibold text-white hover:bg-[#076864] transition-colors"
              >
                {primaryAction.label}
                <ArrowRight className="size-3.5" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#0B1F35] px-4 py-2 text-xs font-semibold text-white hover:bg-[#076864] transition-colors cursor-pointer"
              >
                {primaryAction.label}
                <ArrowRight className="size-3.5" />
              </button>
            ))}
          {secondaryAction &&
            (secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#C5D3E0] bg-white px-4 py-2 text-xs font-semibold text-[#0B1F35] hover:border-[#076864] transition-colors"
              >
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#C5D3E0] bg-white px-4 py-2 text-xs font-semibold text-[#0B1F35] hover:border-[#076864] transition-colors cursor-pointer"
              >
                {secondaryAction.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
