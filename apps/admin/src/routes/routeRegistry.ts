import type { StaffPermission } from "../api/adminClient";

export type AdminNavGroup =
  | "Overview"
  | "Sales"
  | "Catalogue"
  | "Partners"
  | "Stock & System";

export interface AdminNavRouteItem {
  path: string;
  label: string;
  group: AdminNavGroup;
  permission?: StaffPermission;
  iconKey:
    | "dashboard"
    | "products"
    | "categories"
    | "import"
    | "inventory"
    | "orders"
    | "quotes"
    | "enquiries"
    | "customers"
    | "dealers"
    | "distributors"
    | "pricing"
    | "coverage"
    | "returns"
    | "reports"
    | "settings";
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  "Overview",
  "Sales",
  "Catalogue",
  "Partners",
  "Stock & System",
];

export const ADMIN_NAV_ROUTES: AdminNavRouteItem[] = [
  { path: "/dashboard", label: "Dashboard", group: "Overview", permission: "ANALYTICS_VIEW", iconKey: "dashboard" },

  { path: "/orders", label: "Orders", group: "Sales", permission: "ORDERS_MANAGE", iconKey: "orders" },
  { path: "/quotes", label: "Quotes", group: "Sales", permission: "ENQUIRIES_MANAGE", iconKey: "quotes" },
  { path: "/enquiries", label: "Enquiries", group: "Sales", permission: "ENQUIRIES_MANAGE", iconKey: "enquiries" },
  { path: "/returns", label: "Returns", group: "Sales", permission: "ORDERS_MANAGE", iconKey: "returns" },

  { path: "/products", label: "Products", group: "Catalogue", permission: "CATALOG_MANAGE", iconKey: "products" },
  { path: "/categories", label: "Categories", group: "Catalogue", permission: "CATALOG_MANAGE", iconKey: "categories" },
  { path: "/products/import", label: "Import Products", group: "Catalogue", permission: "CATALOG_MANAGE", iconKey: "import" },

  { path: "/customers", label: "Customers", group: "Partners", permission: "CUSTOMERS_MANAGE", iconKey: "customers" },
  { path: "/dealers", label: "Dealers", group: "Partners", permission: "CUSTOMERS_MANAGE", iconKey: "dealers" },
  { path: "/distributors", label: "Distributors", group: "Partners", permission: "CUSTOMERS_MANAGE", iconKey: "distributors" },
  { path: "/seller-coverage", label: "Seller Coverage", group: "Partners", permission: "SETTINGS_MANAGE", iconKey: "coverage" },

  { path: "/inventory", label: "Inventory", group: "Stock & System", permission: "CATALOG_MANAGE", iconKey: "inventory" },
  { path: "/pricing", label: "Pricing", group: "Stock & System", permission: "CATALOG_MANAGE", iconKey: "pricing" },
  { path: "/reports", label: "Reports", group: "Stock & System", permission: "ANALYTICS_VIEW", iconKey: "reports" },
  { path: "/settings", label: "Settings", group: "Stock & System", permission: "SETTINGS_MANAGE", iconKey: "settings" },
];

export interface BreadcrumbNode {
  label: string;
  to?: string;
}

export function resolveRouteKey(pathname: string): string {
  if (pathname.startsWith("/products/import")) return "/products/import";
  if (pathname.startsWith("/products")) return "/products";
  if (pathname.startsWith("/categories")) return "/categories";
  if (pathname.startsWith("/inventory")) return "/inventory";
  if (pathname.startsWith("/orders")) return "/orders";
  if (pathname.startsWith("/quotes")) return "/quotes";
  if (pathname.startsWith("/enquiries")) return "/enquiries";
  if (pathname.startsWith("/customers")) return "/customers";
  if (pathname.startsWith("/dealers")) return "/dealers";
  if (pathname.startsWith("/distributors")) return "/distributors";
  if (pathname.startsWith("/seller-coverage")) return "/seller-coverage";
  if (pathname.startsWith("/pricing") || pathname.startsWith("/promotions")) return "/pricing";
  if (pathname.startsWith("/returns")) return "/returns";
  if (pathname.startsWith("/reports")) return "/reports";
  if (pathname.startsWith("/settings")) return "/settings";
  return "/dashboard";
}

export function resolveBreadcrumbTrail(pathname: string): {
  iconKey: AdminNavRouteItem["iconKey"];
  group: AdminNavGroup;
  trail: BreadcrumbNode[];
} {
  const key = resolveRouteKey(pathname);
  const base = ADMIN_NAV_ROUTES.find((r) => r.path === key) || ADMIN_NAV_ROUTES[0];

  if (pathname === "/dashboard" || pathname === "/") {
    return {
      iconKey: "dashboard",
      group: "Overview",
      trail: [{ label: "Dashboard" }],
    };
  }

  const trail: BreadcrumbNode[] = [{ label: "Home", to: "/dashboard" }];

  // Sub-routes
  if (pathname === "/products/new") {
    trail.push({ label: "Products", to: "/products" }, { label: "Add Product" });
  } else if (pathname === "/products/review") {
    trail.push({ label: "Products", to: "/products" }, { label: "Pending Review" });
  } else if (pathname === "/products/import") {
    trail.push({ label: "Products", to: "/products" }, { label: "Import Products" });
  } else if (/^\/products\/[^/]+\/edit$/.test(pathname)) {
    const id = pathname.split("/")[2];
    trail.push(
      { label: "Products", to: "/products" },
      { label: decodeURIComponent(id), to: `/products/${id}` },
      { label: "Edit" }
    );
  } else if (/^\/products\/[^/]+$/.test(pathname)) {
    trail.push({ label: "Products", to: "/products" }, { label: "Product Details" });
  } else if (/^\/orders\/[^/]+$/.test(pathname)) {
    trail.push({ label: "Orders", to: "/orders" }, { label: "Order Details" });
  } else if (pathname === "/dealers/approvals") {
    trail.push({ label: "Dealers", to: "/dealers" }, { label: "Pending Approvals" });
  } else if (/^\/dealers\/[^/]+$/.test(pathname)) {
    trail.push({ label: "Dealers", to: "/dealers" }, { label: "Dealer Profile" });
  } else if (pathname === "/distributors/approvals") {
    trail.push({ label: "Distributors", to: "/distributors" }, { label: "Pending Approvals" });
  } else if (/^\/distributors\/[^/]+$/.test(pathname)) {
    trail.push({ label: "Distributors", to: "/distributors" }, { label: "Distributor Profile" });
  } else if (/^\/customers\/[^/]+$/.test(pathname)) {
    trail.push({ label: "Customers", to: "/customers" }, { label: "Customer Profile" });
  } else if (pathname === "/inventory/reservations") {
    trail.push({ label: "Inventory", to: "/inventory" }, { label: "Reservations" });
  } else if (pathname === "/inventory/adjustments") {
    trail.push({ label: "Inventory", to: "/inventory" }, { label: "Movement History" });
  } else if (pathname === "/promotions") {
    trail.push({ label: "Pricing", to: "/pricing" }, { label: "Promotions" });
  } else if (pathname === "/settings/roles") {
    trail.push({ label: "Settings", to: "/settings" }, { label: "Role Permissions" });
  } else if (pathname === "/settings/staff") {
    trail.push({ label: "Settings", to: "/settings" }, { label: "Staff Directory" });
  } else if (pathname === "/settings/audit-log") {
    trail.push({ label: "Settings", to: "/settings" }, { label: "Audit Log" });
  } else if (pathname === "/403") {
    trail.push({ label: "Access Denied" });
  } else if (
    ADMIN_NAV_ROUTES.some((r) => pathname === r.path || pathname.startsWith(`${r.path}/`))
  ) {
    trail.push({ label: base.label });
  } else {
    trail.push({ label: "Page Not Found" });
  }

  return {
    iconKey: base.iconKey,
    group: base.group,
    trail,
  };
}

export function resolveDocumentTitle(pathname: string): string {
  if (pathname === "/login") return "Sign In — Sai Ajantha Admin Portal";
  if (pathname === "/forgot-password") return "Reset Password — Sai Ajantha Admin Portal";
  const { trail } = resolveBreadcrumbTrail(pathname);
  const current = trail[trail.length - 1]?.label || "Dashboard";
  return `${current} — Sai Ajantha Admin Portal`;
}
