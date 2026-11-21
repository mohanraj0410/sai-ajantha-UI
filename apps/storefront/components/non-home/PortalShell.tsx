"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, LogOut, Menu, X } from "lucide-react";
import { StatusTag } from "@/components/non-home/PortalPrimitives";
import type { PortalStatusTone } from "@/lib/portal-helpers";

export interface PortalNavItem {
  id: string;
  label: string;
  description?: string;
  icon: ReactNode;
  badge?: string | number;
  group?: string;
}

export interface PortalShellProps {
  roleTheme: "customer" | "dealer" | "distributor";
  portalLabel: string;
  title: string;
  subtitle: string;
  userName: string;
  userMeta: string;
  statusBadge?: {
    label: string;
    tone: PortalStatusTone;
  };
  priceTierLabel: string;
  navItems: PortalNavItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  onLogout: () => void;
  topBanner?: ReactNode;
  sidebarFooter?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}

export function PortalShell({
  roleTheme,
  portalLabel,
  title,
  subtitle,
  userName,
  userMeta,
  statusBadge,
  priceTierLabel,
  navItems,
  activeTab,
  onSelectTab,
  onLogout,
  topBanner,
  sidebarFooter,
  headerActions,
  children,
}: PortalShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isDarkSidebar = roleTheme === "distributor";
  const activeItem = navItems.find((i) => i.id === activeTab) || navItems[0];

  // Group nav items cleanly while preserving order
  const groups: Array<{ name: string | null; items: PortalNavItem[] }> = [];
  for (const item of navItems) {
    const groupName = item.group ?? null;
    const last = groups[groups.length - 1];
    if (!last || last.name !== groupName) {
      groups.push({ name: groupName, items: [item] });
    } else {
      last.items.push(item);
    }
  }

  function handleNavClick(id: string) {
    onSelectTab(id);
    setMobileMenuOpen(false);
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Identity Card */}
      <div
        className={`p-5 border-b ${
          isDarkSidebar
            ? "border-white/10 bg-white/[0.03]"
            : roleTheme === "dealer"
              ? "border-[#DCE5EE] bg-[#F5F9FC]"
              : "border-[#DCE5EE] bg-[#F8FAFC]"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-[11px] font-bold uppercase tracking-[0.14em] ${
              isDarkSidebar ? "text-[#58DDE2]" : "text-[#076864]"
            }`}
          >
            {portalLabel}
          </span>
          {statusBadge && (
            <StatusTag
              label={statusBadge.label}
              tone={statusBadge.tone}
              compact
            />
          )}
        </div>
        <p
          className={`mt-2.5 text-base font-bold truncate ${
            isDarkSidebar ? "text-white" : "text-[#0B1F35]"
          }`}
        >
          {userName}
        </p>
        <p
          className={`mt-0.5 text-xs truncate ${
            isDarkSidebar ? "text-[#A7BACD]" : "text-[#5D6F82]"
          }`}
        >
          {userMeta}
        </p>
        <div
          className={`mt-3 pt-2.5 border-t flex items-center justify-between text-[11px] ${
            isDarkSidebar
              ? "border-white/10 text-[#C9D8E6]"
              : "border-[#E3ECF3] text-[#526477]"
          }`}
        >
          <span>Pricing Tier</span>
          <span
            className={`font-bold ${
              isDarkSidebar ? "text-[#7EE2E6]" : "text-[#0B1F35]"
            }`}
          >
            {priceTierLabel}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav aria-label={`${portalLabel} navigation`} className="p-3 space-y-4 flex-1">
        {groups.map((grp, gIdx) => (
          <div key={grp.name || `group-${gIdx}`} className="space-y-1">
            {grp.name && (
              <p
                className={`px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                  isDarkSidebar ? "text-[#8BA3BC]" : "text-[#718499]"
                }`}
              >
                {grp.name}
              </p>
            )}
            {grp.items.map((item) => {
              const isActive = item.id === activeTab;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`w-full min-h-[44px] flex items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                    isDarkSidebar
                      ? isActive
                        ? "bg-[#079D9A] text-white font-semibold shadow-sm"
                        : "text-[#D4E1EE] hover:bg-white/[0.07] hover:text-white font-medium"
                      : isActive
                        ? "bg-[#0B1F35] text-white font-semibold shadow-xs"
                        : "text-[#2A3D52] hover:bg-[#F2F6FA] hover:text-[#0B1F35] font-medium"
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`shrink-0 ${
                        isActive
                          ? isDarkSidebar
                            ? "text-white"
                            : "text-[#58DDE2]"
                          : isDarkSidebar
                            ? "text-[#8AA8C5]"
                            : "text-[#5D6F82]"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge !== undefined && item.badge !== null && item.badge !== "" && (
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold sa-tabular ${
                        isActive
                          ? "bg-white/20 text-white"
                          : isDarkSidebar
                            ? "bg-white/10 text-[#C8DAEC]"
                            : "bg-[#EDF2F7] text-[#354B62]"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Optional Footer + Sign Out */}
      <div
        className={`p-3 border-t space-y-2 ${
          isDarkSidebar ? "border-white/10" : "border-[#DCE5EE]"
        }`}
      >
        {sidebarFooter}
        <button
          type="button"
          onClick={onLogout}
          className={`w-full min-h-[42px] flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
            isDarkSidebar
              ? "border border-white/15 text-[#D8E5F2] hover:bg-white/10 hover:text-white"
              : "border border-[#DCE5EE] text-[#495D72] hover:border-[#FCA5A5] hover:bg-[#FEF2F2] hover:text-[#B91C1C]"
          }`}
        >
          <LogOut className="size-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-w-0">
      {/* Compact Top Context Bar */}
      <div className="bg-white border-b border-[#DCE5EE]">
        <div className="sa-content-width py-4 sm:py-5">
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-[#5D6F82]">
              <li>
                <Link href="/" className="hover:text-[#0B1F35]">
                  Home
                </Link>
              </li>
              <li className="inline-flex items-center gap-1.5">
                <ChevronRight aria-hidden="true" className="size-3.5 text-[#9AA8B8]" />
                <span className="font-semibold text-[#0B1F35]">{portalLabel}</span>
              </li>
              {activeItem && (
                <li className="inline-flex items-center gap-1.5" aria-current="page">
                  <ChevronRight aria-hidden="true" className="size-3.5 text-[#9AA8B8]" />
                  <span className="text-[#076864] font-semibold">{activeItem.label}</span>
                </li>
              )}
            </ol>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-xl sm:text-2xl font-bold text-[#0B1F35] tracking-tight">
                  {title}
                </h1>
                {statusBadge && (
                  <StatusTag label={statusBadge.label} tone={statusBadge.tone} />
                )}
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#526477]">{subtitle}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {headerActions}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-[#C5D3E0] bg-white px-3.5 text-xs font-semibold text-[#0B1F35] hover:border-[#076864] cursor-pointer"
                aria-label="Open portal navigation"
              >
                <Menu className="size-4" />
                <span>Menu: {activeItem?.label}</span>
              </button>
            </div>
          </div>

          {/* Mobile Quick Section Strip */}
          <div className="mt-3.5 -mx-1 flex lg:hidden items-center gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar">
            {navItems.map((item) => {
              const active = item.id === activeTab;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`shrink-0 inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? "border-[#0B1F35] bg-[#0B1F35] text-white"
                      : "border-[#DCE5EE] bg-[#F8FAFC] text-[#32465B]"
                  }`}
                >
                  <span className="size-3.5 flex items-center justify-center">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="sa-content-width py-6 sm:py-8">
        {topBanner && <div className="mb-6">{topBanner}</div>}

        <div className="sa-portal-shell">
          {/* Desktop Sticky Sidebar */}
          <aside
            className={`hidden lg:block ${
              isDarkSidebar ? "sa-portal-sidebar-dark" : "sa-portal-sidebar"
            }`}
          >
            {sidebarContent}
          </aside>

          {/* Active Workspace Canvas */}
          <div className="min-w-0 space-y-6 sa-enter">{children}</div>
        </div>
      </div>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label={`${portalLabel} navigation drawer`}
        >
          <div
            className="fixed inset-0 bg-[#0B1F35]/50 backdrop-blur-[2px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            className={`relative z-10 w-[84vw] max-w-[300px] h-full overflow-y-auto shadow-2xl ${
              isDarkSidebar
                ? "bg-[#0B1F35] text-white"
                : "bg-white text-[#0B1F35]"
            }`}
          >
            <div
              className={`flex items-center justify-between px-4 py-3 border-b ${
                isDarkSidebar ? "border-white/10" : "border-[#DCE5EE]"
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-wider">
                {portalLabel}
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close portal menu"
                className={`flex size-9 items-center justify-center rounded-lg cursor-pointer ${
                  isDarkSidebar
                    ? "text-white/80 hover:bg-white/10"
                    : "text-[#495D72] hover:bg-[#F3F6FA]"
                }`}
              >
                <X className="size-4" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}
    </div>
  );
}
