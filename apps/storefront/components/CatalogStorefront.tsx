"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Filter,
  ChevronDown,
  ClipboardList,
  Gem,
  Headset,
  Home,
  Layers,
  LayoutGrid,
  List,
  ShieldCheck,
  Truck,
  Info,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { BrandProductCard } from "@/components/BrandProductCard";
import { ProductQuickViewModal } from "@/components/ProductQuickViewModal";
import { StateFeedback } from "@/components/StateFeedback";
import { useStore } from "@/components/StoreProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BackendErrorState } from "@/components/BackendErrorState";
import {
  HOUSE_OF_AJANTHA_CATEGORIES,
  isDistributorLedCategory,
} from "@/lib/commercial-policy";
import {
  PRODUCT_CATEGORIES,
  type ProductCategory,
  type ProductItem,
} from "@/lib/products";
import { formatInr, getProductSpecData } from "@/lib/productSpecs";

type SortOption = "featured" | "name-asc" | "price-asc" | "price-desc";
type ApprovalFilter = "all" | "approved" | "priced";

export const KITCHEN_BASKET_SUBCATEGORIES = [
  "All Kitchen Basket",
  "Kitchen Baskets",
  "Trolleys With Slides",
  "Cabinet Accessories",
  "Vegetable Baskets",
] as const;

export function getKitchenBasketSubcategory(item: ProductItem): string {
  const sub = (item.subcategory || "").trim();
  if (
    sub === "Trolleys With Slides" ||
    sub === "Vegetable Baskets" ||
    sub === "Cabinet Accessories" ||
    sub === "Kitchen Baskets"
  ) {
    return sub;
  }
  const subLower = sub.toLowerCase();
  const name = (item.name || "").toLowerCase();
  const sku = (
    item.code || ("sku" in item && typeof item.sku === "string" ? item.sku : "")
  ).toUpperCase();

  // 1. Trolleys With Slides (6 SKUs: Grain Trolleys)
  if (
    subLower.includes("trolley") ||
    name.includes("grain trolley") ||
    name.includes("trolley") ||
    [
      "SA-T-KB-OO40",
      "SA-T-KB-OO41",
      "SA-T-KB-OO42",
      "SA-T-KB-OO107",
      "SA-T-KB-OO108",
      "SA-T-KB-OO109",
    ].includes(sku)
  ) {
    return "Trolleys With Slides";
  }

  // 2. Vegetable Baskets (6 SKUs)
  if (
    subLower.includes("vegetable") ||
    name.includes("vegetable") ||
    [
      "SA-T-KB-OO101",
      "SA-T-KB-OO102",
      "SA-T-KB-OO103",
      "SA-T-KB-OO104",
      "SA-T-KB-OO105",
      "SA-T-KB-OO106",
    ].includes(sku)
  ) {
    return "Vegetable Baskets";
  }

  // 3. Cabinet Accessories (13 SKUs: Bottle Pullout, Bottle Basket, Glass Tray & Plate Tray)
  // Master Excel taxonomy specifies exactly 13 SKUs; Box Cutlery belongs to Kitchen Baskets (89 total).
  if (
    subLower.includes("cabinet") ||
    subLower.includes("accessor") ||
    name.includes("bottle pullout") ||
    name.includes("bottle basket") ||
    name.includes("glass tray") ||
    [
      "SA-T-KB-OO43",
      "SA-T-KB-OO95",
      "SA-T-KB-OO96",
      "SA-T-KB-OO97",
      "SA-T-KB-OO98",
      "SA-T-KB-OO99",
      "SA-T-KB-OO110",
      "SA-T-KB-OO111",
      "SA-T-KB-OO112",
      "SA-T-KB-OO113",
      "SA-T-KB-OO114",
      "SA-T-KB-OO115",
      "SA-T-KB-OO116",
    ].includes(sku)
  ) {
    return "Cabinet Accessories";
  }

  // 4. Kitchen Baskets (89 SKUs: Plain, Partition, Cup & Saucer, Plate, Thali, Cutlery, Box Cutlery)
  return "Kitchen Baskets";
}

const PAGE_SIZE = 18;
const MAX_PRICE_CEILING = 105000;

function FilterGroup({
  title,
  children,
  expanded = false,
}: {
  title: string;
  children: ReactNode;
  expanded?: boolean;
}) {
  return (
    <details className="catalogue-filter-group" open={expanded}>
      <summary>
        {title}
        <ChevronDown aria-hidden="true" className="size-4" />
      </summary>
      <div className="catalogue-filter-options">{children}</div>
    </details>
  );
}
const CATALOGUE_BENEFITS = [
  {
    icon: Layers,
    title: "Wide Product Range",
    description: "Architectural & interior essentials",
  },
  {
    icon: Headset,
    title: "Project Support",
    description: "Technical guidance",
  },
  {
    icon: Truck,
    title: "Reliable Supply",
    description: "Delivery confirmed by PIN",
  },
  {
    icon: ShieldCheck,
    title: "Genuine Quality",
    description: "Trusted brands",
  },
];
const CATALOGUE_PROMISES = [
  {
    icon: Gem,
    title: "Premium Quality",
    description: "Materials for your project",
  },
  {
    icon: Layers,
    title: "Wide Selection",
    description: "For every application",
  },
  {
    icon: Headset,
    title: "Expert Support",
    description: "From selection to installation",
  },
  {
    icon: ShieldCheck,
    title: "Project Ready",
    description: "For architects, builders & contractors",
  },
];
export function CatalogStorefront() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    compareIds,
    toggleCompare,
    clearCompare,
    getAuthorizedUnitPrice,
    getProductImage,
    catalogProducts,
    catalogCategories,
    catalogLoading,
    catalogError,
    refreshAuthAndCatalog,
  } = useStore();

  const initialCategoryParam = searchParams.get("category");
  const initialQueryParam = searchParams.get("q") ?? "";
  const initialSizeParam = searchParams.get("size") ?? "all";
  const initialMaterialParam = searchParams.get("material") ?? "all";
  const initialFinishParam = searchParams.get("finish") ?? "all";
  const initialBrandParam = searchParams.get("brand") ?? "all";
  const initialSortParam =
    (searchParams.get("sort") as SortOption) || "featured";

  const matchedInitialCategory: "All" | ProductCategory =
    initialCategoryParam &&
    PRODUCT_CATEGORIES.includes(initialCategoryParam as ProductCategory)
      ? (initialCategoryParam as ProductCategory)
      : "All";

  const [selectedCategory, setSelectedCategory] = useState<
    "All" | ProductCategory
  >(matchedInitialCategory);
  const [kitchenSubcategory, setKitchenSubcategory] =
    useState<string>("All Kitchen Basket");
  const [searchQuery, setSearchQuery] = useState(initialQueryParam);
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>("all");
  const [sizeFilter, setSizeFilter] = useState<string>(initialSizeParam);
  const [materialFilter, setMaterialFilter] =
    useState<string>(initialMaterialParam);
  const [finishFilter, setFinishFilter] = useState<string>(initialFinishParam);
  const [brandFilter, setBrandFilter] = useState(initialBrandParam);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>(initialSortParam);
  const [maxPriceCap, setMaxPriceCap] = useState<number>(MAX_PRICE_CEILING);
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [quickViewItem, setQuickViewItem] = useState<ProductItem | null>(null);
  const quickViewTrigger = useRef<HTMLElement | null>(null);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  const syncUrlParams = (
    overrides: Record<string, string | null>,
    push = false,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (!v || v === "All" || v === "all" || v === "featured") {
        params.delete(k);
      } else {
        params.set(k, v);
      }
    }
    const qs = params.toString();
    const href = qs ? `${pathname}?${qs}` : pathname;
    if (push) router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  };

  const [prevSearchKey, setPrevSearchKey] = useState(searchParams.toString());
  const currentSearchKey = searchParams.toString();
  if (currentSearchKey !== prevSearchKey) {
    setPrevSearchKey(currentSearchKey);
    const cat = searchParams.get("category");
    if (cat && PRODUCT_CATEGORIES.includes(cat as ProductCategory)) {
      setSelectedCategory(cat as ProductCategory);
    } else if (cat === null) {
      setSelectedCategory("All");
    }
    const q = searchParams.get("q");
    setSearchQuery(q ?? "");
    setSortBy((searchParams.get("sort") as SortOption) || "featured");
    setSizeFilter(searchParams.get("size") ?? "all");
    setMaterialFilter(searchParams.get("material") ?? "all");
    setFinishFilter(searchParams.get("finish") ?? "all");
    setBrandFilter(searchParams.get("brand") ?? "all");
    setCurrentPage(1);
  }

  const activeCategories =
    catalogCategories.length > 0 ? catalogCategories : PRODUCT_CATEGORIES;

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: catalogProducts.length };
    for (const cat of activeCategories) {
      counts[cat] = catalogProducts.filter((p) => p.category === cat).length;
    }
    return counts;
  }, [catalogProducts, activeCategories]);

  const brandOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of catalogProducts)
      if (product.brand?.trim())
        counts.set(
          product.brand.trim(),
          (counts.get(product.brand.trim()) ?? 0) + 1,
        );
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [catalogProducts]);
  const kitchenSubcategoryCounts = useMemo(() => {
    const counts: Record<string, number> = { "All Kitchen Basket": 0 };
    for (const sub of KITCHEN_BASKET_SUBCATEGORIES.slice(1)) {
      counts[sub] = 0;
    }
    for (const p of catalogProducts) {
      if (p.category === "Kitchen Basket") {
        counts["All Kitchen Basket"] = (counts["All Kitchen Basket"] || 0) + 1;
        const sub = getKitchenBasketSubcategory(p);
        counts[sub] = (counts[sub] || 0) + 1;
      }
    }
    return counts;
  }, [catalogProducts]);

  const enrichedProducts = useMemo(
    () =>
      catalogProducts.map((item) => ({
        item,
        spec: getProductSpecData(item),
      })),
    [catalogProducts],
  );

  const categoryPool = useMemo(() => {
    if (selectedCategory === "All") return enrichedProducts;
    return enrichedProducts.filter(
      ({ item }) => item.category === selectedCategory,
    );
  }, [enrichedProducts, selectedCategory]);

  const availableSizes = useMemo(() => {
    const vals = new Set<string>();
    for (const { item, spec } of categoryPool) {
      const s = item.size || spec.size;
      if (s && s.trim()) vals.add(s.trim());
    }
    return Array.from(vals).sort();
  }, [categoryPool]);

  const availableMaterials = useMemo(() => {
    const vals = new Set<string>();
    for (const { item, spec } of categoryPool) {
      const m = item.material || spec.material;
      if (m && m.trim()) vals.add(m.trim());
    }
    return Array.from(vals).sort();
  }, [categoryPool]);

  const availableFinishes = useMemo(() => {
    const vals = new Set<string>();
    for (const { spec } of categoryPool) {
      for (const f of spec.finishOptions) {
        if (f && f.trim()) vals.add(f.trim());
      }
    }
    return Array.from(vals).sort();
  }, [categoryPool]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = enrichedProducts.filter(({ item, spec }) => {
      const authorizedPrice = getAuthorizedUnitPrice(item.id);
      const effectivePrice =
        authorizedPrice !== undefined ? authorizedPrice : spec.verifiedPriceInr;

      if (selectedCategory !== "All" && item.category !== selectedCategory) {
        return false;
      }
      if (
        selectedCategory === "Kitchen Basket" &&
        kitchenSubcategory !== "All Kitchen Basket"
      ) {
        if (getKitchenBasketSubcategory(item) !== kitchenSubcategory)
          return false;
      }
      if (brandFilter !== "all" && item.brand?.trim() !== brandFilter)
        return false;
      if (approvalFilter === "approved" && !spec.isWorkbookApproved) {
        return false;
      }
      if (approvalFilter === "priced" && effectivePrice === null) {
        return false;
      }
      if (sizeFilter !== "all") {
        const s = (item.size || spec.size || "").trim();
        if (s !== sizeFilter) return false;
      }
      if (materialFilter !== "all") {
        const m = (item.material || spec.material || "").trim();
        if (m !== materialFilter) return false;
      }
      if (finishFilter !== "all") {
        if (!spec.finishOptions.includes(finishFilter)) return false;
      }
      if (
        maxPriceCap < MAX_PRICE_CEILING &&
        effectivePrice !== null &&
        effectivePrice > maxPriceCap
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.subcategory?.toLowerCase().includes(q) ?? false) ||
        (item.code?.toLowerCase().includes(q) ?? false) ||
        spec.material.toLowerCase().includes(q)
      );
    });

    if (sortBy === "name-asc") {
      return [...list].sort((a, b) => a.item.name.localeCompare(b.item.name));
    }
    if (sortBy === "price-asc") {
      return [...list].sort(
        (a, b) =>
          (getAuthorizedUnitPrice(a.item.id) ??
            a.spec.verifiedPriceInr ??
            Number.MAX_SAFE_INTEGER) -
          (getAuthorizedUnitPrice(b.item.id) ??
            b.spec.verifiedPriceInr ??
            Number.MAX_SAFE_INTEGER),
      );
    }
    if (sortBy === "price-desc") {
      return [...list].sort(
        (a, b) =>
          (getAuthorizedUnitPrice(b.item.id) ?? b.spec.verifiedPriceInr ?? -1) -
          (getAuthorizedUnitPrice(a.item.id) ?? a.spec.verifiedPriceInr ?? -1),
      );
    }
    return list;
  }, [
    enrichedProducts,
    selectedCategory,
    kitchenSubcategory,
    approvalFilter,
    brandFilter,
    sizeFilter,
    materialFilter,
    finishFilter,
    maxPriceCap,
    searchQuery,
    sortBy,
    getAuthorizedUnitPrice,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PAGE_SIZE),
  );
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const comparedItems = useMemo(
    () =>
      compareIds
        .map((id) => enrichedProducts.find((e) => e.item.id === id))
        .filter((e): e is NonNullable<typeof e> => Boolean(e)),
    [compareIds, enrichedProducts],
  );

  const hasActiveFilters =
    selectedCategory !== "All" ||
    searchQuery.trim() !== "" ||
    approvalFilter !== "all" ||
    brandFilter !== "all" ||
    sizeFilter !== "all" ||
    materialFilter !== "all" ||
    finishFilter !== "all" ||
    sortBy !== "featured" ||
    maxPriceCap < MAX_PRICE_CEILING;

  const resetFilters = () => {
    setSelectedCategory("All");
    setKitchenSubcategory("All Kitchen Basket");
    setSearchQuery("");
    setApprovalFilter("all");
    setBrandFilter("all");
    setSizeFilter("all");
    setMaterialFilter("all");
    setFinishFilter("all");
    setSortBy("featured");
    setMaxPriceCap(MAX_PRICE_CEILING);
    setCurrentPage(1);
    router.replace(pathname, { scroll: false });
  };

  const isSelectedDistributorCategory =
    selectedCategory !== "All" && isDistributorLedCategory(selectedCategory);

  function selectCategory(category: "All" | ProductCategory) {
    setSelectedCategory(category);
    setKitchenSubcategory("All Kitchen Basket");
    setSizeFilter("all");
    setMaterialFilter("all");
    setFinishFilter("all");
    setCurrentPage(1);
    syncUrlParams({ category, size: null, material: null, finish: null }, true);
  }
  function applyFilters() {
    setMobileFiltersOpen(false);
    document
      .getElementById("catalogue-results")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function renderFilters(prefix: string) {
    const visibleCategories = showAllCategories
      ? activeCategories
      : [
          ...new Set([
            ...activeCategories.slice(0, 5),
            ...(selectedCategory === "All" ? [] : [selectedCategory]),
          ]),
        ];
    return (
      <div className="catalogue-filter-body">
        <FilterGroup title="Category" expanded>
          {visibleCategories.map((category) => (
            <label className="catalogue-check" key={category}>
              <input
                type="checkbox"
                checked={selectedCategory === category}
                onChange={() =>
                  selectCategory(
                    selectedCategory === category ? "All" : category,
                  )
                }
              />
              <span>{category}</span>
              <span className="catalogue-option-count">
                ({categoryCounts[category] ?? 0})
              </span>
            </label>
          ))}
          {activeCategories.length > 5 && (
            <button
              type="button"
              className="catalogue-view-more"
              onClick={() => setShowAllCategories((value) => !value)}
            >
              <span aria-hidden="true">{showAllCategories ? "−" : "+"}</span>
              {showAllCategories ? "View fewer" : "View more"}
            </button>
          )}
        </FilterGroup>
        <FilterGroup title="Brand" expanded>
          {brandOptions.map(([brand, count]) => (
            <label className="catalogue-check" key={brand}>
              <input
                type="checkbox"
                checked={brandFilter === brand}
                onChange={() => {
                  const value = brandFilter === brand ? "all" : brand;
                  setBrandFilter(value);
                  setCurrentPage(1);
                  syncUrlParams({ brand: value });
                }}
              />
              <span>{brand}</span>
              <span className="catalogue-option-count">({count})</span>
            </label>
          ))}
        </FilterGroup>
        <FilterGroup title="Material" expanded={materialFilter !== "all"}>
          <Select
            value={materialFilter}
            onValueChange={(value) => {
              setMaterialFilter(value);
              setCurrentPage(1);
              syncUrlParams({ material: value });
            }}
          >
            <SelectTrigger
              id={prefix + "-material"}
              aria-label="Filter by material"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All materials</SelectItem>
              {availableMaterials.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterGroup>
        <FilterGroup title="Finish" expanded={finishFilter !== "all"}>
          <Select
            value={finishFilter}
            onValueChange={(value) => {
              setFinishFilter(value);
              setCurrentPage(1);
              syncUrlParams({ finish: value });
            }}
          >
            <SelectTrigger
              id={prefix + "-finish"}
              aria-label="Filter by finish"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All finishes</SelectItem>
              {availableFinishes.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterGroup>
        <FilterGroup title="Application">
          <p className="catalogue-filter-note">
            Application details are not listed in the catalogue. Our technical
            desk can help you choose.
          </p>
          <Link className="catalogue-filter-help" href="/contact">
            Ask about your application{" "}
            <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </FilterGroup>
        <FilterGroup
          title="More specifications"
          expanded={sizeFilter !== "all" || approvalFilter !== "all"}
        >
          <label className="catalogue-select-label" htmlFor={prefix + "-size"}>
            Size
          </label>
          <Select
            value={sizeFilter}
            onValueChange={(value) => {
              setSizeFilter(value);
              setCurrentPage(1);
              syncUrlParams({ size: value });
            }}
          >
            <SelectTrigger id={prefix + "-size"} aria-label="Filter by size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sizes</SelectItem>
              {availableSizes.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label
            className="catalogue-select-label"
            htmlFor={prefix + "-approval"}
          >
            Specification status
          </label>
          <Select
            value={approvalFilter}
            onValueChange={(value) => {
              setApprovalFilter(value as ApprovalFilter);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger
              id={prefix + "-approval"}
              aria-label="Filter by specification status"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All specifications</SelectItem>
              <SelectItem value="approved">Approved Spec Only</SelectItem>
              <SelectItem value="priced">With Listed Public Price</SelectItem>
            </SelectContent>
          </Select>
        </FilterGroup>
        <FilterGroup title="Price range" expanded>
          <Slider
            value={[maxPriceCap]}
            min={500}
            max={MAX_PRICE_CEILING}
            step={500}
            aria-label="Maximum unit price filter"
            onValueChange={(values) => {
              setMaxPriceCap(values[0] ?? MAX_PRICE_CEILING);
              setCurrentPage(1);
            }}
          />
          <div className="catalogue-price-range">
            <span>₹ 0</span>
            <span>
              {maxPriceCap >= MAX_PRICE_CEILING
                ? "Any price"
                : formatInr(maxPriceCap)}
            </span>
          </div>
        </FilterGroup>
        <div className="catalogue-filter-actions">
          <Button type="button" onClick={applyFilters}>
            <Filter className="size-4" />
            Apply filters
          </Button>
          <Button type="button" variant="outline" onClick={resetFilters}>
            <RotateCcw className="size-4" />
            Clear all
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="sa-catalogue min-w-0" data-view={viewMode}>
      <div className="catalogue-container catalogue-intro">
        <nav className="catalogue-breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/">
                <Home className="size-3" aria-hidden="true" />
                Home
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li aria-current="page">Product Catalogue</li>
          </ol>
        </nav>
        <section className="catalogue-hero" aria-labelledby="catalogue-title">
          <Image
            className="catalogue-hero-architecture"
            src="/about-banner.jpg"
            alt=""
            fill
            sizes="1200px"
            loading="eager"
          />
          <div className="catalogue-hero-photo" aria-hidden="true">
            <Image
              src="/products/Door-closer-&-Floor-spring-Door-closer-[SA-M-DC-60-001]-img.jpg"
              alt=""
              fill
              sizes="(min-width: 1024px) 650px, 60vw"
              loading="eager"
            />
          </div>
          <div className="catalogue-hero-content">
            <span className="catalogue-eyebrow">Explore our range</span>
            <h1 id="catalogue-title">
              Product <span>Catalogue</span>
            </h1>
            <p>
              Find premium architectural hardware, aluminium systems, and
              interior solutions for your projects.
            </p>
            <Link className="catalogue-white-button" href="/quotes">
              Ask for Bulk Quote{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
        <div className="catalogue-benefits" aria-label="Catalogue services">
          {CATALOGUE_BENEFITS.map(
            ({ icon: Icon, title, description }, index) => (
              <div key={title}>
                <Icon aria-hidden="true" />
                <div>
                  <strong>{title}</strong>
                  <span>
                    {index === 0
                      ? catalogProducts.length + " products in our catalogue"
                      : description}
                  </span>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
      <div className="catalogue-container catalogue-main">
        {selectedCategory === "Kitchen Basket" && (
          <section
            className="catalogue-subcollections"
            aria-label="Kitchen Basket sub-collections"
          >
            <div>
              <strong>Kitchen Basket sub-collections</strong>
              <span>{categoryCounts["Kitchen Basket"] ?? 0} products</span>
            </div>
            <div>
              {KITCHEN_BASKET_SUBCATEGORIES.map((subcat) => (
                <button
                  key={subcat}
                  type="button"
                  aria-pressed={kitchenSubcategory === subcat}
                  onClick={() => {
                    setKitchenSubcategory(subcat);
                    setCurrentPage(1);
                  }}
                >
                  {subcat}
                  <span>{kitchenSubcategoryCounts[subcat] ?? 0}</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {selectedCategory !== "All" && (
          <div
            className="catalogue-route-notice"
            data-distributor={isSelectedDistributorCategory}
          >
            <Info className="size-4" aria-hidden="true" />
            <p>
              <strong>
                {selectedCategory} ·{" "}
                {isSelectedDistributorCategory
                  ? "Distributor sales"
                  : "Sai Ajantha Direct"}
              </strong>
              <span>
                {selectedCategory === HOUSE_OF_AJANTHA_CATEGORIES[0]
                  ? "Ask a distributor about door closers. Floor springs are quote only."
                  : isSelectedDistributorCategory
                    ? "Check the delivery PIN or use your linked dealer account to find a distributor."
                    : "Check your delivery PIN on the product page for availability."}
              </span>
            </p>
            <Link href="/quotes">
              Request custom quote{" "}
              <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          </div>
        )}
        <div className="sa-catalogue-workspace">
          <aside
            aria-label="Catalogue filters"
            className="sa-catalogue-filters"
          >
            <div className="catalogue-filter-heading">
              <Filter aria-hidden="true" className="size-5" />
              <h2>Filter Products</h2>
            </div>
            <div className="catalogue-search">
              <Search aria-hidden="true" className="size-4" />
              <Input
                type="search"
                aria-label="Filter product catalogue"
                placeholder="Search products…"
                value={searchQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearchQuery(value);
                  setCurrentPage(1);
                  syncUrlParams({ q: value.trim() || null });
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search query"
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                    syncUrlParams({ q: null });
                  }}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
            <div className="catalogue-desktop-filters">
              {renderFilters("catalogue-desktop")}
            </div>
            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <Button
                  className="catalogue-mobile-filter-trigger"
                  variant="outline"
                  aria-label="Open category filters"
                >
                  <Filter className="size-4" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="catalogue-mobile-filters w-[min(100%,360px)] overflow-y-auto p-0"
              >
                <SheetHeader className="px-5 pt-6">
                  <SheetTitle>Filter Products</SheetTitle>
                  <SheetDescription>
                    Search and filter the live product catalogue.
                  </SheetDescription>
                </SheetHeader>
                {renderFilters("catalogue-mobile")}
              </SheetContent>
            </Sheet>
          </aside>
          <div className="sa-catalogue-results" id="catalogue-results">
            <div className="catalogue-results-toolbar">
              <div
                role="status"
                aria-live="polite"
                className="catalogue-result-count"
              >
                <h2>
                  {selectedCategory === "All"
                    ? "All Products"
                    : selectedCategory}
                </h2>
                <span>({filteredProducts.length} Products)</span>
                <span className="sr-only">
                  Showing{" "}
                  {filteredProducts.length === 0
                    ? 0
                    : (safePage - 1) * PAGE_SIZE + 1}
                  –{Math.min(safePage * PAGE_SIZE, filteredProducts.length)} of{" "}
                  {filteredProducts.length} products
                </span>
              </div>
              <div className="catalogue-view-options">
                {hasActiveFilters && (
                  <button
                    type="button"
                    className="catalogue-toolbar-reset"
                    onClick={resetFilters}
                  >
                    Reset filters
                  </button>
                )}
                <label htmlFor="catalogue-sort">Sort by</label>
                <Select
                  value={sortBy}
                  onValueChange={(value) => {
                    setSortBy(value as SortOption);
                    setCurrentPage(1);
                    syncUrlParams({ sort: value });
                  }}
                >
                  <SelectTrigger id="catalogue-sort" aria-label="Sort products">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured</SelectItem>
                    <SelectItem value="name-asc">Name (A–Z)</SelectItem>
                    <SelectItem value="price-asc">
                      Price: Low to High
                    </SelectItem>
                    <SelectItem value="price-desc">
                      Price: High to Low
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div role="group" aria-label="Product view">
                  <button
                    type="button"
                    aria-label="Grid view"
                    aria-pressed={viewMode === "grid"}
                    onClick={() => setViewMode("grid")}
                  >
                    <LayoutGrid aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="List view"
                    aria-pressed={viewMode === "list"}
                    onClick={() => setViewMode("list")}
                  >
                    <List aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </div>
            </div>
            {catalogError ? (
              <BackendErrorState
                title="Products could not load"
                message={catalogError}
                onRetry={() => void refreshAuthAndCatalog()}
                retrying={catalogLoading}
              />
            ) : catalogLoading && catalogProducts.length === 0 ? (
              <StateFeedback
                kind="loading"
                title="Loading products"
                description="Getting the latest catalogue."
              />
            ) : catalogProducts.length === 0 ? (
              <StateFeedback
                kind="unavailable"
                badgeLabel="Unavailable"
                title="No products are available right now"
                description="Ask us about the product you need."
                actionLabel="Request a Quote"
                actionHref="/quotes"
                secondaryLabel="Contact Desk"
                secondaryHref="/contact"
              />
            ) : filteredProducts.length === 0 ? (
              <StateFeedback
                kind="empty"
                title="No matching products"
                description="Clear your search or try different filters."
                actionLabel="Reset All Filters"
                onAction={resetFilters}
              />
            ) : (
              <>
                <div
                  key={
                    selectedCategory +
                    "-" +
                    safePage +
                    "-" +
                    sortBy +
                    "-" +
                    approvalFilter
                  }
                  className="sa-product-grid"
                >
                  {paginatedProducts.map(({ item }) => (
                    <BrandProductCard
                      key={item.id}
                      item={item}
                      presentation="catalogue"
                      showCompareToggle
                      onQuickView={(product) => {
                        quickViewTrigger.current =
                          document.activeElement instanceof HTMLElement
                            ? document.activeElement
                            : null;
                        setQuickViewItem(product);
                      }}
                    />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="catalogue-pagination">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            disabled={safePage <= 1}
                            onClick={() =>
                              setCurrentPage((value) => Math.max(1, value - 1))
                            }
                          />
                        </PaginationItem>
                        {Array.from(
                          new Set([
                            1,
                            2,
                            3,
                            safePage - 1,
                            safePage,
                            safePage + 1,
                            totalPages,
                          ]),
                        )
                          .filter((page) => page > 0 && page <= totalPages)
                          .sort((a, b) => a - b)
                          .map((pageNum, index, pages) => (
                            <PaginationItem key={pageNum}>
                              {index > 0 && pageNum - pages[index - 1] > 1 && (
                                <span
                                  className="catalogue-page-gap"
                                  aria-hidden="true"
                                >
                                  …
                                </span>
                              )}
                              <PaginationButton
                                isActive={pageNum === safePage}
                                onClick={() => setCurrentPage(pageNum)}
                              >
                                {pageNum}
                              </PaginationButton>
                            </PaginationItem>
                          ))}
                        <PaginationItem>
                          <PaginationNext
                            disabled={safePage >= totalPages}
                            onClick={() =>
                              setCurrentPage((value) =>
                                Math.min(totalPages, value + 1),
                              )
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <div className="catalogue-container catalogue-bottom">
        <section
          className="catalogue-project-banner"
          aria-labelledby="catalogue-project-title"
        >
          <div className="catalogue-project-photo" aria-hidden="true">
            <Image src="/about-showcase.jpg" alt="" fill sizes="600px" />
          </div>
          <div className="catalogue-project-copy">
            <ClipboardList aria-hidden="true" />
            <div>
              <span className="catalogue-eyebrow">Need a custom solution?</span>
              <h2 id="catalogue-project-title">
                Bulk Requirement or Project Enquiry?
              </h2>
              <p>
                Get expert support, product recommendations and best quotes for
                your project.
              </p>
              <Link href="/quotes" className="catalogue-white-button">
                Request a Quote{" "}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </div>
        </section>
        <div
          className="catalogue-benefits catalogue-promises"
          aria-label="Product support"
        >
          {CATALOGUE_PROMISES.map(({ icon: Icon, title, description }) => (
            <div key={title}>
              <Icon aria-hidden="true" />
              <div>
                <strong>{title}</strong>
                <span>{description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Comparison Bar */}
      {comparedItems.length > 0 && (
        <div className="sticky bottom-4 z-30 mx-auto max-w-4xl px-4 pb-4">
          <div className="sa-dark-radial-panel rounded-2xl border border-[#24C6D0]/60 text-white p-4 shadow-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="teal">Compare ({comparedItems.length}/4)</Badge>
              <div className="flex flex-wrap items-center gap-2">
                {comparedItems.map(({ item }) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleCompare(item.id)}
                    title={`Remove ${item.name}`}
                    className="inline-flex items-center gap-1.5 rounded bg-white/10 hover:bg-white/20 px-2.5 py-1 text-[11px] font-medium cursor-pointer"
                  >
                    <span className="max-w-[110px] truncate">{item.name}</span>
                    <X className="size-3" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearCompare}
                className="text-[#C6CAD5] hover:text-white hover:bg-white/10"
              >
                Clear
              </Button>
              <Button
                type="button"
                variant="teal"
                size="sm"
                onClick={() => setCompareModalOpen(true)}
              >
                Compare Specs <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Dialog + Table */}
      <Dialog
        open={compareModalOpen && comparedItems.length > 0}
        onOpenChange={setCompareModalOpen}
      >
        <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0 max-h-[88vh] flex flex-col">
          <DialogHeader className="border-b border-[#C6CAD5] bg-[#F4F6F9] px-6 py-4">
            <DialogTitle>Side-by-Side Technical Comparison</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto p-6">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="bg-transparent hover:bg-transparent">
                  <TableHead className="w-36">Specification</TableHead>
                  {comparedItems.map(({ item }) => (
                    <TableHead
                      key={item.id}
                      className="normal-case tracking-normal py-3"
                    >
                      <div className="relative h-24 w-24 rounded-lg bg-[#F4F6F9] border border-[#C6CAD5]/60 mb-2 p-2">
                        <Image
                          src={getProductImage(item.id, item.src)}
                          alt={item.name}
                          fill
                          sizes="96px"
                          className="object-contain p-1"
                        />
                      </div>
                      <Link
                        href={`/products/${item.id}`}
                        className="font-bold text-xs text-[#153C66] hover:text-[#12878F] hover:underline whitespace-normal"
                      >
                        {item.name}
                      </Link>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-bold">SKU</TableCell>
                  {comparedItems.map(({ item }) => (
                    <TableCell
                      key={item.id}
                      className="text-[#12878F] font-semibold"
                    >
                      {item.code ?? item.id.toUpperCase()}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-bold">Category</TableCell>
                  {comparedItems.map(({ item }) => (
                    <TableCell key={item.id} className="text-[#7B8896]">
                      {item.category}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-bold">Authorized Rate</TableCell>
                  {comparedItems.map(({ item, spec }) => {
                    const price =
                      getAuthorizedUnitPrice(item.id) ?? spec.verifiedPriceInr;
                    return (
                      <TableCell
                        key={item.id}
                        className="font-bold tabular-nums"
                      >
                        {price !== null ? formatInr(price) : "Quote on BOQ"}
                      </TableCell>
                    );
                  })}
                </TableRow>
                <TableRow>
                  <TableCell className="font-bold">Material</TableCell>
                  {comparedItems.map(({ item, spec }) => (
                    <TableCell key={item.id} className="text-[#7B8896]">
                      {spec.material}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-bold">Standard</TableCell>
                  {comparedItems.map(({ item, spec }) => (
                    <TableCell key={item.id} className="text-[#7B8896]">
                      {spec.gradeStandard}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-bold">Warranty</TableCell>
                  {comparedItems.map(({ item, spec }) => (
                    <TableCell key={item.id} className="text-[#7B8896]">
                      {spec.warrantyLabel}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <ProductQuickViewModal
        item={quickViewItem}
        onClose={() => setQuickViewItem(null)}
        returnFocusRef={quickViewTrigger}
      />
    </div>
  );
}
