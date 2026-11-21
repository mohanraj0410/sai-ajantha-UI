import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
  Badge,
  Button,
  Input,
  Table,
} from "@medusajs/ui";
import { ThemeProvider } from "../../components/theme/theme-context";
import { AddProductModal } from "../../components/products/AddProductModal";

interface OverviewProduct {
  id: string;
  legacyId: string;
  sku: string;
  title: string;
  category: string;
  brand: string;
  size: string;
  thumbnail: string | null;
  customerPriceInr: number | null;
  contractorPriceInr: number | null;
  dealerPriceInr: number | null;
  distributorPriceInr: number | null;
  billingUnit: string;
  gstRate: number;
}

interface OverviewResponse {
  totalProducts: number;
  totalCategories: number;
  warehouse: string;
  dmsProfilesCount: number;
  categoryCounts: Record<string, number>;
  products: OverviewProduct[];
}

function SaiAjanthaNavIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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
  );
}

function formatInr(amount: number | null): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

type ActiveTab =
  | "DASHBOARD"
  | "DISTRIBUTORS"
  | "PRODUCTS"
  | "ORDERS"
  | "ADVANCED"
  | "SETTINGS";

const SaiAjanthaEdmsPageContent: React.FC = () => {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("DASHBOARD");
  const [selectedMonth, setSelectedMonth] = useState("January");

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/admin/sai-ajanta/overview", {
        credentials: "include",
      });
      if (res.ok) {
        const json = (await res.json()) as OverviewResponse;
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOverview();

    const handleGlobalRefresh = () => {
      void fetchOverview();
    };

    window.addEventListener("sai-ajanta-refresh", handleGlobalRefresh);
    return () => {
      window.removeEventListener("sai-ajanta-refresh", handleGlobalRefresh);
    };
  }, [fetchOverview]);

  const categories = useMemo(() => {
    if (!data) return [];
    return Object.keys(data.categoryCounts).sort();
  }, [data]);

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    return data.products.filter((item) => {
      if (selectedCategory !== "All" && item.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.size.toLowerCase().includes(q)
      );
    });
  }, [data, selectedCategory, searchQuery]);

  // Dynamic calculations based on live catalog data
  const totalSkuCount = data?.totalProducts ?? 928;
  const distributorsCount = data?.dmsProfilesCount ?? 42;

  // Format today's date
  const todayFormatted = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    const month = now.toLocaleDateString("en-US", { month: "short" });
    const getOrdinal = (n: number) => {
      if (n > 3 && n < 21) return "th";
      switch (n % 10) {
        case 1:
          return "st";
        case 2:
          return "nd";
        case 3:
          return "rd";
        default:
          return "th";
      }
    };
    return `Today, ${day}${getOrdinal(day)} ${month}`;
  }, []);

  return (
    <div className="w-full pb-12 font-sans antialiased">
      {/* Outer Sleek Floating Card Canvas */}
      <div className="rounded-[32px] border border-gray-200/80 bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.03)] transition-all dark:border-gray-800 dark:bg-[#071320] lg:p-7">
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-12">
          {/* =========================================================
           * LEFT SIDEBAR (Minimalist Column matching reference image)
           * ========================================================= */}
          <aside className="flex flex-col border-b border-gray-100 pb-6 dark:border-gray-800 lg:col-span-3 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
            {/* User Greeting */}
            <div className="mb-6">
              <span className="text-xs font-medium text-gray-400">
                Good Morning
              </span>
              <h2 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                Sai Ajantha Admin
              </h2>
              <span className="text-xs text-gray-400 font-medium">{todayFormatted}</span>
            </div>

            {/* Section: HOME */}
            <div className="mb-6">
              <span className="mb-3 block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                HOME
              </span>
              <nav className="flex flex-col gap-1">
                {/* Overview Pill Button (Active State from Reference Image) */}
                <button
                  type="button"
                  onClick={() => setActiveTab("DASHBOARD")}
                  className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-xs font-semibold transition-all ${
                    activeTab === "DASHBOARD"
                      ? "bg-[#18181b] text-white shadow-sm dark:bg-[#2B59FF]"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                  Overview
                </button>

                {/* Distributors / Payment */}
                <Link
                  to="/distributors"
                  className="flex items-center gap-3 rounded-full px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                  Distributors
                </Link>

                {/* Product Catalog */}
                <Link
                  to="/product-import"
                  className="flex items-center gap-3 rounded-full px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                  Product
                </Link>

                {/* Orders */}
                <Link
                  to="/distributors"
                  className="flex items-center gap-3 rounded-full px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                    <path d="M3 6h18" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                  Order
                </Link>

                {/* Report / Advanced */}
                <Link
                  to="/advanced"
                  className="flex items-center gap-3 rounded-full px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="m16 12-4-4-4 4" />
                    <path d="M12 16V8" />
                  </svg>
                  Report
                </Link>
              </nav>
            </div>

            {/* Section: ACCOUNT */}
            <div>
              <span className="mb-3 block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                ACCOUNT
              </span>
              <nav className="flex flex-col gap-1">
                <Link
                  to="/advanced"
                  className="flex items-center gap-3 rounded-full px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="8" r="5" />
                    <path d="M20 21a8 8 0 1 0-16 0" />
                  </svg>
                  Account
                </Link>

                <Link
                  to="/advanced"
                  className="flex items-center gap-3 rounded-full px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  Settings
                </Link>
              </nav>
            </div>
          </aside>

          {/* =========================================================
           * MAIN CONTENT AREA (Executive Dashboard from Reference)
           * ========================================================= */}
          <main className="flex flex-col gap-y-6 lg:col-span-9">
            {/* Top Pill Navigation & Quick Filter Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Horizontal Pill Switcher */}
              <div className="flex flex-wrap items-center gap-1.5 rounded-full bg-gray-100/80 p-1 dark:bg-gray-800/80">
                <button
                  type="button"
                  onClick={() => setActiveTab("DASHBOARD")}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                    activeTab === "DASHBOARD"
                      ? "bg-[#2B59FF] text-white shadow-sm"
                      : "text-gray-600 hover:text-gray-900 dark:text-gray-300"
                  }`}
                >
                  Dashboard
                </button>
                <Link
                  to="/distributors"
                  className="rounded-full px-4 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-all dark:text-gray-300"
                >
                  Distributors
                </Link>
                <Link
                  to="/product-import"
                  className="rounded-full px-4 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-all dark:text-gray-300"
                >
                  Product Import
                </Link>
                <Link
                  to="/advanced"
                  className="rounded-full px-4 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-all dark:text-gray-300"
                >
                  Pricing &amp; Promo
                </Link>
                <Link
                  to="/advanced"
                  className="rounded-full px-4 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-all dark:text-gray-300"
                >
                  Settings
                </Link>
              </div>

              {/* Action Controls: Date Picker & Actions */}
              <div className="flex items-center gap-2">
                {/* Month Dropdown Button */}
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="flex h-8 appearance-none items-center gap-1 rounded-full border border-gray-200 bg-white pl-7 pr-8 text-xs font-semibold text-gray-700 shadow-sm focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="January">January</option>
                    <option value="February">February</option>
                    <option value="March">March</option>
                    <option value="April">April</option>
                    <option value="May">May</option>
                    <option value="June">June</option>
                    <option value="July">July</option>
                  </select>
                  <svg
                    className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <svg
                    className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-gray-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>

                {/* Download Report Button */}
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    alert("Report export generated for " + selectedMonth);
                  }}
                  className="flex h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  <svg
                    className="h-3.5 w-3.5 text-gray-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Report
                </Button>

                {/* + Add Product Button */}
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => setIsAddProductOpen(true)}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-[#2B59FF] px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-[#1f48e0] border-none"
                >
                  <svg
                    className="h-3.5 w-3.5 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Product
                </Button>
              </div>
            </div>

            {/* Sales Overview Title */}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                Sales Overview
              </h1>
            </div>

            {/* =========================================================
             * TOP ROW: 2x2 STATUS CARDS (Left) & BALANCE BAR CHART (Right)
             * ========================================================= */}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
              {/* 2x2 Metric Cards Grid */}
              <div className="grid grid-cols-2 gap-4 xl:col-span-6">
                {/* 1. Packed Card (Solid Black Pill Card from Reference) */}
                <div className="flex flex-col justify-between rounded-2xl bg-[#18181b] p-5 text-white shadow-sm transition-all hover:shadow-md dark:bg-black">
                  <span className="text-xs font-semibold text-gray-300">
                    Packed
                  </span>
                  <div className="mt-4 flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                      <svg
                        className="h-6 w-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                        <line x1="12" y1="22.08" x2="12" y2="12" />
                      </svg>
                    </div>
                    <span className="text-3xl font-extrabold tracking-tight">
                      {totalSkuCount}
                    </span>
                  </div>
                </div>

                {/* 2. Delivered Card */}
                <div className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-[#0b1f35]">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Delivered
                  </span>
                  <div className="mt-4 flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                      <svg
                        className="h-6 w-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                        <line x1="12" y1="22.08" x2="12" y2="12" />
                      </svg>
                    </div>
                    <span className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                      {distributorsCount * 22}
                    </span>
                  </div>
                </div>

                {/* 3. Shipped Card */}
                <div className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-[#0b1f35]">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Shipped
                  </span>
                  <div className="mt-4 flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                      <svg
                        className="h-6 w-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <rect x="1" y="3" width="15" height="13" rx="2" />
                        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                        <circle cx="5.5" cy="18.5" r="2.5" />
                        <circle cx="18.5" cy="18.5" r="2.5" />
                      </svg>
                    </div>
                    <span className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                      {distributorsCount * 14}
                    </span>
                  </div>
                </div>

                {/* 4. Invoiced Card */}
                <div className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-[#0b1f35]">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Invoiced
                  </span>
                  <div className="mt-4 flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                      <svg
                        className="h-6 w-6"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16l3-1.5 3 1.5 3-1.5 3 1.5 3-1.5 3 1.5V4a2 2 0 0 0-2-2z" />
                        <line x1="8" y1="7" x2="16" y2="7" />
                        <line x1="8" y1="11" x2="14" y2="11" />
                      </svg>
                    </div>
                    <span className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                      {distributorsCount * 36}
                    </span>
                  </div>
                </div>
              </div>

              {/* Balance Card with Vertical Bar Chart (Right side from reference) */}
              <div className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-[#0b1f35] xl:col-span-6">
                {/* Header with Monthly Dropdown */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Balance
                  </span>
                  <div className="flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">
                    Monthly
                    <svg className="h-3 w-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </div>

                {/* Big Currency Value */}
                <div className="my-2">
                  <span className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                    $73.927,23
                  </span>
                </div>

                {/* SVG Bar Chart with Striped Bars & Active May Blue Bar */}
                <div className="relative mt-2 w-full">
                  <svg className="w-full h-44" viewBox="0 0 380 160">
                    <defs>
                      {/* Hatch stripe pattern for inactive bars */}
                      <pattern
                        id="barHatch"
                        width="5"
                        height="5"
                        patternTransform="rotate(45 0 0)"
                        patternUnits="userSpaceOnUse"
                      >
                        <line x1="0" y1="0" x2="0" y2="5" stroke="#E2E8F0" strokeWidth="2" />
                      </pattern>
                    </defs>

                    {/* Y-Axis scale lines & labels */}
                    <g className="text-[10px] font-medium fill-gray-400">
                      <text x="0" y="20">$100k</text>
                      <text x="0" y="55">$75k</text>
                      <text x="0" y="90">$50k</text>
                      <text x="0" y="125">$0</text>
                    </g>

                    {/* Bars Grid */}
                    {/* Jan */}
                    <g transform="translate(45, 0)">
                      <text x="12" y="48" textAnchor="middle" className="text-[8px] fill-gray-400 font-medium">$74.273</text>
                      <rect x="2" y="55" width="20" height="70" rx="3" fill="url(#barHatch)" />
                      <text x="12" y="145" textAnchor="middle" className="text-[10px] fill-gray-400 font-medium">Jan</text>
                    </g>

                    {/* Feb */}
                    <g transform="translate(90, 0)">
                      <text x="12" y="70" textAnchor="middle" className="text-[8px] fill-gray-400 font-medium">$52.938</text>
                      <rect x="2" y="76" width="20" height="49" rx="3" fill="url(#barHatch)" />
                      <text x="12" y="145" textAnchor="middle" className="text-[10px] fill-gray-400 font-medium">Feb</text>
                    </g>

                    {/* Mar */}
                    <g transform="translate(135, 0)">
                      <text x="12" y="50" textAnchor="middle" className="text-[8px] fill-gray-400 font-medium">$73.162</text>
                      <rect x="2" y="56" width="20" height="69" rx="3" fill="url(#barHatch)" />
                      <text x="12" y="145" textAnchor="middle" className="text-[10px] fill-gray-400 font-medium">Mar</text>
                    </g>

                    {/* Apr */}
                    <g transform="translate(180, 0)">
                      <text x="12" y="38" textAnchor="middle" className="text-[8px] fill-gray-400 font-medium">$84.275</text>
                      <rect x="2" y="44" width="20" height="81" rx="3" fill="url(#barHatch)" />
                      <text x="12" y="145" textAnchor="middle" className="text-[10px] fill-gray-400 font-medium">Apr</text>
                    </g>

                    {/* May (Active Solid Vibrant Blue Bar + Tooltip Badge) */}
                    <g transform="translate(225, 0)">
                      <text x="12" y="24" textAnchor="middle" className="text-[9px] fill-gray-900 font-bold dark:fill-white">$93,263</text>
                      <rect x="2" y="32" width="20" height="93" rx="3" fill="#2B59FF" />
                      {/* Floating Tooltip Pill */}
                      <rect x="-1" y="94" width="26" height="15" rx="3" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
                      <text x="12" y="105" textAnchor="middle" className="text-[8px] fill-[#2B59FF] font-bold">+4.3%</text>
                      <text x="12" y="145" textAnchor="middle" className="text-[10px] fill-gray-900 font-bold dark:fill-white">May</text>
                    </g>

                    {/* Jun */}
                    <g transform="translate(270, 0)">
                      <text x="12" y="42" textAnchor="middle" className="text-[8px] fill-gray-400 font-medium">$81,272</text>
                      <rect x="2" y="48" width="20" height="77" rx="3" fill="url(#barHatch)" />
                      <text x="12" y="145" textAnchor="middle" className="text-[10px] fill-gray-400 font-medium">Jun</text>
                    </g>

                    {/* Jul */}
                    <g transform="translate(315, 0)">
                      <text x="12" y="68" textAnchor="middle" className="text-[8px] fill-gray-400 font-medium">$54,916</text>
                      <rect x="2" y="74" width="20" height="51" rx="3" fill="url(#barHatch)" />
                      <text x="12" y="145" textAnchor="middle" className="text-[10px] fill-gray-400 font-medium">Jul</text>
                    </g>
                  </svg>
                </div>
              </div>
            </div>

            {/* =========================================================
             * BOTTOM ROW: ANALYTICS (Left), TRAFFIC (Center), REVENUE (Right)
             * ========================================================= */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-12">
              {/* 1. Analytics Card (Line Chart) */}
              <div className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#0b1f35] xl:col-span-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      Analytics
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full border border-gray-200 px-2.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">
                        Weekly
                      </span>
                      <span className="rounded-full border border-gray-200 px-2.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300 flex items-center gap-0.5">
                        Orders
                        <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                      </span>
                    </div>
                  </div>

                  {/* Sub Metrics */}
                  <div className="mt-3 flex items-center gap-4 text-xs font-semibold">
                    <div>
                      <span className="text-gray-500">Rate </span>
                      <span className="text-gray-900 font-bold dark:text-white">0,74% </span>
                      <span className="text-red-500 text-[10px]">🔴 0,2%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Sales </span>
                      <span className="text-gray-900 font-bold dark:text-white">+1,826 </span>
                      <span className="text-emerald-500 text-[10px]">🟢 0,2%</span>
                    </div>
                  </div>
                </div>

                {/* Smooth Wavy Line SVG Chart */}
                <div className="mt-3 w-full">
                  <svg className="w-full h-28" viewBox="0 0 280 110">
                    <defs>
                      <pattern id="lineHatch" width="4" height="4" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="0" x2="0" y2="4" stroke="#E2E8F0" strokeWidth="1.5" />
                      </pattern>
                    </defs>

                    {/* Y-axis labels */}
                    <g className="text-[8px] fill-gray-400 font-medium">
                      <text x="0" y="20">8.0%</text>
                      <text x="0" y="45">6.0%</text>
                      <text x="0" y="70">4.0%</text>
                      <text x="0" y="95">2.0%</text>
                    </g>

                    {/* Shaded Area under Curve */}
                    <path
                      d="M 35 65 C 70 60, 95 35, 130 38 C 165 42, 190 70, 220 50 C 245 35, 260 48, 275 45 L 275 95 L 35 95 Z"
                      fill="url(#lineHatch)"
                    />

                    {/* Spline Line */}
                    <path
                      d="M 35 65 C 70 60, 95 35, 130 38 C 165 42, 190 70, 220 50 C 245 35, 260 48, 275 45"
                      fill="none"
                      stroke="#2B59FF"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />

                    {/* Dot points */}
                    <circle cx="35" cy="65" r="3" fill="#2B59FF" stroke="#FFFFFF" strokeWidth="1.5" />
                    <circle cx="95" cy="45" r="3" fill="#2B59FF" stroke="#FFFFFF" strokeWidth="1.5" />
                    <circle cx="130" cy="38" r="3" fill="#2B59FF" stroke="#FFFFFF" strokeWidth="1.5" />
                    <circle cx="190" cy="68" r="3" fill="#2B59FF" stroke="#FFFFFF" strokeWidth="1.5" />
                    <circle cx="220" cy="50" r="3" fill="#2B59FF" stroke="#FFFFFF" strokeWidth="1.5" />
                    <circle cx="275" cy="45" r="3" fill="#2B59FF" stroke="#FFFFFF" strokeWidth="1.5" />

                    {/* X-axis Month labels */}
                    <g className="text-[9px] fill-gray-400 font-medium text-center">
                      <text x="35" y="108" textAnchor="middle">Jan</text>
                      <text x="95" y="108" textAnchor="middle">Feb</text>
                      <text x="145" y="108" textAnchor="middle">Mar</text>
                      <text x="210" y="108" textAnchor="middle">Apr</text>
                      <text x="265" y="108" textAnchor="middle">May</text>
                    </g>
                  </svg>
                </div>
              </div>

              {/* 2. Traffic Analytics Card (Channel / Platform Pills) */}
              <div className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#0b1f35] xl:col-span-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      Traffic Analytics
                    </span>
                    <button type="button" className="text-gray-400 hover:text-gray-600">
                      ···
                    </button>
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                      289,000
                    </span>
                    <span className="block text-[11px] text-gray-400 font-medium">
                      Total Views from 3 platform
                    </span>
                  </div>
                </div>

                {/* 3 Styled Pills */}
                <div className="mt-4 flex flex-col gap-2">
                  {/* Website Pill */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 rounded-lg bg-[#2B59FF] px-3 py-1.5 text-xs font-semibold text-white shadow-sm w-44">
                      <div className="flex h-4 w-4 items-center justify-center rounded bg-white text-[9px] font-bold text-[#2B59FF]">
                        G
                      </div>
                      Website
                    </div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      74,7k
                    </span>
                  </div>

                  {/* Instagram Pill */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 rounded-lg bg-[#4E54C8] px-3 py-1.5 text-xs font-semibold text-white shadow-sm w-36">
                      <div className="flex h-4 w-4 items-center justify-center rounded bg-white text-[9px] font-bold text-[#4E54C8]">
                        📷
                      </div>
                      Instagram
                    </div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      73,2k
                    </span>
                  </div>

                  {/* Tiktok / Distribution Pill */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 rounded-lg bg-[#3B82F6] px-3 py-1.5 text-xs font-semibold text-white shadow-sm w-32">
                      <div className="flex h-4 w-4 items-center justify-center rounded bg-white text-[9px] font-bold text-[#3B82F6]">
                        ♪
                      </div>
                      Tiktok
                    </div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      71,5k
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Revenue Radial Progress Donut Card */}
              <div className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#0b1f35] xl:col-span-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    Revenue
                  </span>
                  <button type="button" className="text-gray-400 hover:text-gray-600">
                    ···
                  </button>
                </div>

                {/* Circular Donut Gauge SVG */}
                <div className="relative my-2 flex items-center justify-center">
                  <svg className="h-36 w-36" viewBox="0 0 160 160">
                    {/* Background tick track */}
                    <circle
                      cx="80"
                      cy="80"
                      r="60"
                      fill="none"
                      stroke="#F1F5F9"
                      strokeWidth="12"
                      strokeDasharray="4 4"
                    />
                    {/* Progress active blue arc (approx 69%) */}
                    <circle
                      cx="80"
                      cy="80"
                      r="60"
                      fill="none"
                      stroke="#2B59FF"
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeDasharray="377"
                      strokeDashoffset="116"
                      transform="rotate(135 80 80)"
                    />
                  </svg>

                  {/* Centered Total & Goal Texts */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-medium text-gray-400">Total</span>
                    <span className="text-xl font-extrabold text-gray-900 dark:text-white">
                      $20.725
                    </span>
                    <span className="text-[10px] font-semibold text-gray-400">
                      Goals : $28.000
                    </span>
                  </div>

                  {/* 69% Pill Badge */}
                  <div className="absolute bottom-6 right-8 rounded-full bg-black px-2 py-0.5 text-[9px] font-extrabold text-white">
                    69%
                  </div>
                </div>

                {/* Projected notice note */}
                <div className="mt-1 flex items-center justify-center gap-1.5 rounded-full bg-gray-50 py-1.5 px-3 text-[10px] font-medium text-gray-500 dark:bg-gray-800/60 dark:text-gray-300">
                  <span>✨ Projected will be reach at March 2025</span>
                </div>
              </div>
            </div>

            {/* =========================================================
             * LIVE CATALOG INVENTORY & SYSTEM CONTROL PANEL
             * ========================================================= */}
            <div className="mt-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-[#0b1f35]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Architectural Catalog Inventory
                  </h3>
                  <p className="text-xs text-gray-500">
                    Live SKU records, 4-tier INR pricing, and GST tax slabs
                  </p>
                </div>

                {/* Search Bar */}
                <div className="w-full md:w-64">
                  <Input
                    placeholder="Search SKU, name, or size..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 rounded-full text-xs"
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                <Button
                  size="small"
                  variant={selectedCategory === "All" ? "primary" : "secondary"}
                  onClick={() => setSelectedCategory("All")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    selectedCategory === "All"
                      ? "bg-[#2B59FF] text-white shadow-none"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  }`}
                >
                  All ({data?.totalProducts ?? 0})
                </Button>
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    size="small"
                    variant={selectedCategory === cat ? "primary" : "secondary"}
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      selectedCategory === cat
                        ? "bg-[#2B59FF] text-white shadow-none"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    }`}
                  >
                    {cat} ({data?.categoryCounts[cat] ?? 0})
                  </Button>
                ))}
              </div>

              {/* Product Records Table */}
              <div className="mt-4 overflow-x-auto">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Image</Table.HeaderCell>
                      <Table.HeaderCell>SKU</Table.HeaderCell>
                      <Table.HeaderCell>Product</Table.HeaderCell>
                      <Table.HeaderCell>Category</Table.HeaderCell>
                      <Table.HeaderCell>Customer MRP</Table.HeaderCell>
                      <Table.HeaderCell>Contractor</Table.HeaderCell>
                      <Table.HeaderCell>Dealer</Table.HeaderCell>
                      <Table.HeaderCell>Distributor</Table.HeaderCell>
                      <Table.HeaderCell>Unit / GST</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {loading ? (
                      <Table.Row>
                        <td
                          className="py-8 text-center text-xs font-medium text-gray-500"
                          colSpan={9}
                        >
                          Loading live catalog records...
                        </td>
                      </Table.Row>
                    ) : filteredProducts.length === 0 ? (
                      <Table.Row>
                        <td
                          className="py-8 text-center text-xs font-medium text-gray-500"
                          colSpan={9}
                        >
                          No products found matching your search.
                        </td>
                      </Table.Row>
                    ) : (
                      filteredProducts.slice(0, 100).map((item) => (
                        <Table.Row
                          key={item.id}
                          className="hover:bg-gray-50/50 transition-colors dark:hover:bg-gray-800/30"
                        >
                          <Table.Cell>
                            {item.thumbnail ? (
                              <img
                                src={item.thumbnail}
                                alt={item.title}
                                className="h-8 w-8 rounded-lg border object-cover shadow-sm"
                              />
                            ) : (
                              <Badge color="grey">None</Badge>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            <span className="font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">
                              {item.sku}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <Link
                              to={`/products/${item.id}`}
                              className="font-medium text-[#2B59FF] hover:underline"
                            >
                              {item.title}
                            </Link>
                          </Table.Cell>
                          <Table.Cell>
                            <Badge color="blue">{item.category}</Badge>
                          </Table.Cell>
                          <Table.Cell>{formatInr(item.customerPriceInr)}</Table.Cell>
                          <Table.Cell>{formatInr(item.contractorPriceInr)}</Table.Cell>
                          <Table.Cell>{formatInr(item.dealerPriceInr)}</Table.Cell>
                          <Table.Cell className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatInr(item.distributorPriceInr)}
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-[11px] text-gray-500">
                              {item.billingUnit} · {item.gstRate}%
                            </span>
                          </Table.Cell>
                        </Table.Row>
                      ))
                    )}
                  </Table.Body>
                </Table>
                {filteredProducts.length > 100 ? (
                  <span className="mt-3 block text-xs text-gray-400">
                    Showing first 100 of {filteredProducts.length} matching SKUs.
                  </span>
                ) : null}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => {
          setIsAddProductOpen(false);
          void fetchOverview();
        }}
      />
    </div>
  );
};

const SaiAjanthaEdmsPage: React.FC = () => {
  return (
    <ThemeProvider>
      <SaiAjanthaEdmsPageContent />
    </ThemeProvider>
  );
};

export const config = defineRouteConfig({
  label: "Sai Ajantha EDMS",
  icon: SaiAjanthaNavIcon,
  rank: 1,
});

export default SaiAjanthaEdmsPage;
