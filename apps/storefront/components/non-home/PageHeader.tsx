import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";

export interface PageHeaderParent {
  label: string;
  href: string;
}

export interface PageHeaderProps {
  title: string;
  section?: string;
  description?: string;
  parents?: PageHeaderParent[];
  /** "compact" for transactional/account/policy pages; "editorial" for brand/catalog/solutions/projects */
  variant?: "editorial" | "compact";
  /** Accepts either a string URL or an object with src/alt/sizes */
  image?:
    | string
    | {
        src: string;
        alt?: string;
        sizes?: string;
      };
  /** Optional single CTA button shorthand used across editorial pages */
  action?: {
    label: string;
    href: string;
  };
  /** Optional inset padding flag for nested layouts */
  inset?: boolean;
  /** Optional right-side meta or actions slot */
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({
  title,
  section,
  description,
  parents = [],
  variant = "compact",
  image,
  action,
  actions,
  children,
}: PageHeaderProps) {
  const resolvedImage =
    typeof image === "string"
      ? { src: image, alt: "", sizes: "(min-width: 1024px) 44vw, 0px" }
      : image;

  const breadcrumb = (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-[#5D6F82]">
        <li>
          <Link href="/" className="hover:text-[#0B1F35] transition-colors">
            Home
          </Link>
        </li>
        {parents.map((p) => (
          <li key={p.href} className="inline-flex items-center gap-1.5">
            <ChevronRight aria-hidden="true" className="size-3.5 text-[#9AA8B8]" />
            <Link href={p.href} className="hover:text-[#0B1F35] transition-colors">
              {p.label}
            </Link>
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5" aria-current="page">
          <ChevronRight aria-hidden="true" className="size-3.5 text-[#9AA8B8]" />
          <span className="font-semibold text-[#0B1F35]">{title}</span>
        </li>
      </ol>
    </nav>
  );

  const actionButton = action ? (
    <Link
      href={action.href}
      className={
        variant === "editorial" || resolvedImage
          ? "inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#D2F5F4] px-4 py-2 text-xs sm:text-sm font-bold text-[#0B1F35] hover:bg-white transition-colors"
          : "inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#0B1F35] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#076864] transition-colors"
      }
    >
      {action.label}
      <ArrowRight aria-hidden="true" className="size-4" />
    </Link>
  ) : null;

  if (variant === "editorial" || resolvedImage) {
    return (
      <section className="sa-page-head-editorial">
        <div className="sa-content-width">
          {breadcrumb}
          <div className="sa-editorial-banner">
            {resolvedImage && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] lg:block"
              >
                <Image
                  src={resolvedImage.src}
                  alt={resolvedImage.alt || ""}
                  fill
                  sizes={resolvedImage.sizes || "(min-width: 1024px) 44vw, 0px"}
                  className="object-cover object-center opacity-45"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(90deg, #0e2845 0%, rgba(14,40,69,0.72) 42%, rgba(14,40,69,0.18) 100%)",
                  }}
                />
              </div>
            )}

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              <div className="max-w-2xl space-y-2.5">
                {section && <p className="sa-page-section-kicker">{section}</p>}
                <h1 className="sa-page-title-editorial">{title}</h1>
                {description && (
                  <p className="max-w-[60ch] text-sm sm:text-[15px] leading-relaxed text-[#D0DDE9]">
                    {description}
                  </p>
                )}
                {(actionButton || children) && (
                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    {actionButton}
                    {children}
                  </div>
                )}
              </div>
              {actions && <div className="shrink-0">{actions}</div>}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="sa-page-head-compact">
      <div className="sa-content-width sa-page-head-compact-inner">
        {breadcrumb}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            {section && <p className="sa-group-label">{section}</p>}
            <h1 className="sa-page-title-compact">{title}</h1>
            {description && (
              <p className="max-w-[66ch] text-sm text-[#526477] leading-relaxed">
                {description}
              </p>
            )}
            {children && <div className="pt-2">{children}</div>}
          </div>
          {(actions || actionButton) && (
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {actions}
              {actionButton}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
