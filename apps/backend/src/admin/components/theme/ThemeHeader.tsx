import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Button, Text } from "@medusajs/ui";

interface ThemeHeaderProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  onAddProductClick?: () => void;
}

export const ThemeHeader: React.FC<ThemeHeaderProps> = ({
  title,
  subtitle,
  actions,
  onAddProductClick,
}) => {
  const location = useLocation();

  const navLinks = [
    { path: "/sai-ajanta", label: "EDMS Overview" },
    { path: "/distributors", label: "Distributors & Orders" },
    { path: "/product-import", label: "Product Import" },
    { path: "/advanced", label: "Advanced" },
  ];

  return (
    <header className="rounded-xl border border-ui-border-base bg-ui-bg-base p-5 shadow-sm transition-all duration-200">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Brand identity & titles with solid primary background (no gradient) */}
        <div className="flex items-start gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#102d4d] text-white shadow-sm dark:bg-[#079d9a]">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 21h18" />
              <path d="M5 21V7l8-4v18" />
              <path d="M19 21V11l-6-4" />
              <path d="M9 9v.01" />
              <path d="M9 12v.01" />
              <path d="M9 15v.01" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-ui-fg-base">
                {title}
              </h1>

            </div>
            <Text size="small" className="mt-0.5 text-ui-fg-subtle">
              {subtitle}
            </Text>
          </div>
        </div>

        {/* Global actions: Theme Mode Switcher + Custom Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {onAddProductClick ? (
            <Button
              variant="primary"
              size="small"
              onClick={onAddProductClick}
              className="bg-[#079d9a] hover:bg-[#068280] text-white font-medium shadow-none border-none"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mr-1.5 h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Product
            </Button>
          ) : null}

          {actions}
        </div>
      </div>

      {/* Navigation Sub-bar */}
      <nav className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-ui-border-base pt-3">
        {navLinks.map((link) => {
          const isActive = location.pathname.startsWith(link.path);
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${isActive
                  ? "bg-[#102d4d] text-white dark:bg-[#079d9a] dark:text-white"
                  : "text-ui-fg-subtle hover:bg-ui-bg-subtle hover:text-ui-fg-base"
                }`}
            >
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
};
