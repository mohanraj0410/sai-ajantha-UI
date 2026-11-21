import React, { useMemo } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { App as AntdApp, ConfigProvider } from "antd";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { buildAntdTheme } from "./theme/antdTheme";
import { adminQueryClient } from "./api/adminQueries";
import { AdminToastProvider } from "./components/common/AdminToastProvider";
import { AdminErrorBoundary } from "./components/common/AdminStateView";
import { RequireAuth, RequirePermission } from "./components/auth/RouteGuards";
import { AuthLayout } from "./layouts/AuthLayout";
import { AdminAppLayout } from "./layouts/AdminAppLayout";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { AccessDeniedPage } from "./pages/AccessDeniedPage";
import { NotFoundPage } from "./pages/NotFoundPage";

const DashboardPage = React.lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const ProductsPage = React.lazy(() =>
  import("./pages/ProductsPage").then((m) => ({ default: m.ProductsPage }))
);
const ProductDetailPage = React.lazy(() =>
  import("./pages/ProductDetailPage").then((m) => ({ default: m.ProductDetailPage }))
);
const ProductEditorPage = React.lazy(() =>
  import("./pages/ProductEditorPage").then((m) => ({ default: m.ProductEditorPage }))
);
const ProductImportPage = React.lazy(() =>
  import("./pages/ProductImportPage").then((m) => ({ default: m.ProductImportPage }))
);
const CategoriesPage = React.lazy(() =>
  import("./pages/CategoriesPage").then((m) => ({ default: m.CategoriesPage }))
);
const InventoryPage = React.lazy(() =>
  import("./pages/InventoryPage").then((m) => ({ default: m.InventoryPage }))
);
const OrdersPage = React.lazy(() =>
  import("./pages/OrdersPage").then((m) => ({ default: m.OrdersPage }))
);
const OrderDetailPage = React.lazy(() =>
  import("./pages/OrderDetailPage").then((m) => ({ default: m.OrderDetailPage }))
);
const PartnersPage = React.lazy(() =>
  import("./pages/PartnersPage").then((m) => ({ default: m.PartnersPage }))
);
const PartnerDetailPage = React.lazy(() =>
  import("./pages/PartnerDetailPage").then((m) => ({ default: m.PartnerDetailPage }))
);
const SellerCoveragePage = React.lazy(() =>
  import("./pages/SellerCoveragePage").then((m) => ({ default: m.SellerCoveragePage }))
);
const PricingPromotionsPage = React.lazy(() =>
  import("./pages/PricingPromotionsPage").then((m) => ({ default: m.PricingPromotionsPage }))
);
const EnquiriesPage = React.lazy(() =>
  import("./pages/EnquiriesPage").then((m) => ({ default: m.EnquiriesPage }))
);
const QuotesPage = React.lazy(() =>
  import("./pages/QuotesPage").then((m) => ({ default: m.QuotesPage }))
);
const ReturnsPage = React.lazy(() =>
  import("./pages/ReturnsPage").then((m) => ({ default: m.ReturnsPage }))
);
const ReportsPage = React.lazy(() =>
  import("./pages/ReportsPage").then((m) => ({ default: m.ReportsPage }))
);
const SettingsPage = React.lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AdminAppLayout />,
        children: [
          { path: "/", element: <Navigate to="/dashboard" replace /> },
          {
            path: "/dashboard",
            element: (
              <RequirePermission permission="ANALYTICS_VIEW">
                <DashboardPage />
              </RequirePermission>
            ),
          },
          {
            path: "/products",
            element: (
              <RequirePermission permission="CATALOG_MANAGE">
                <ProductsPage />
              </RequirePermission>
            ),
          },
          {
            path: "/products/new",
            element: (
              <RequirePermission permission="CATALOG_MANAGE">
                <ProductEditorPage />
              </RequirePermission>
            ),
          },
          {
            path: "/products/import",
            element: (
              <RequirePermission permission="CATALOG_MANAGE">
                <ProductImportPage />
              </RequirePermission>
            ),
          },
          {
            path: "/products/review",
            element: (
              <RequirePermission permission="CATALOG_MANAGE">
                <ProductsPage />
              </RequirePermission>
            ),
          },
          {
            path: "/products/:productId",
            element: (
              <RequirePermission permission="CATALOG_MANAGE">
                <ProductDetailPage />
              </RequirePermission>
            ),
          },
          {
            path: "/products/:productId/edit",
            element: (
              <RequirePermission permission="CATALOG_MANAGE">
                <ProductEditorPage />
              </RequirePermission>
            ),
          },
          {
            path: "/categories",
            element: (
              <RequirePermission permission="CATALOG_MANAGE">
                <CategoriesPage />
              </RequirePermission>
            ),
          },
          {
            path: "/inventory",
            element: (
              <RequirePermission permission="CATALOG_MANAGE">
                <InventoryPage />
              </RequirePermission>
            ),
          },
          {
            path: "/inventory/reservations",
            element: (
              <RequirePermission permission="CATALOG_MANAGE">
                <InventoryPage />
              </RequirePermission>
            ),
          },
          {
            path: "/inventory/adjustments",
            element: (
              <RequirePermission permission="CATALOG_MANAGE">
                <InventoryPage />
              </RequirePermission>
            ),
          },
          {
            path: "/orders",
            element: (
              <RequirePermission permission="ORDERS_MANAGE">
                <OrdersPage />
              </RequirePermission>
            ),
          },
          {
            path: "/orders/:orderId",
            element: (
              <RequirePermission permission="ORDERS_MANAGE">
                <OrderDetailPage />
              </RequirePermission>
            ),
          },
          {
            path: "/quotes",
            element: (
              <RequirePermission permission="ENQUIRIES_MANAGE">
                <QuotesPage />
              </RequirePermission>
            ),
          },
          {
            path: "/quotes/:quoteId",
            element: (
              <RequirePermission permission="ENQUIRIES_MANAGE">
                <QuotesPage />
              </RequirePermission>
            ),
          },
          {
            path: "/enquiries",
            element: (
              <RequirePermission permission="ENQUIRIES_MANAGE">
                <EnquiriesPage />
              </RequirePermission>
            ),
          },
          {
            path: "/enquiries/:enquiryId",
            element: (
              <RequirePermission permission="ENQUIRIES_MANAGE">
                <EnquiriesPage />
              </RequirePermission>
            ),
          },
          {
            path: "/customers",
            element: (
              <RequirePermission permission="CUSTOMERS_MANAGE">
                <PartnersPage scope="CUSTOMERS" />
              </RequirePermission>
            ),
          },
          {
            path: "/customers/:customerId",
            element: (
              <RequirePermission permission="CUSTOMERS_MANAGE">
                <PartnerDetailPage backPath="/customers" titlePrefix="Customer" />
              </RequirePermission>
            ),
          },
          {
            path: "/dealers",
            element: (
              <RequirePermission permission="CUSTOMERS_MANAGE">
                <PartnersPage scope="DEALERS" />
              </RequirePermission>
            ),
          },
          {
            path: "/dealers/approvals",
            element: (
              <RequirePermission permission="CUSTOMERS_MANAGE">
                <PartnersPage scope="DEALER_APPROVALS" />
              </RequirePermission>
            ),
          },
          {
            path: "/dealers/:dealerId",
            element: (
              <RequirePermission permission="CUSTOMERS_MANAGE">
                <PartnerDetailPage backPath="/dealers" titlePrefix="Dealer" />
              </RequirePermission>
            ),
          },
          {
            path: "/distributors",
            element: (
              <RequirePermission permission="CUSTOMERS_MANAGE">
                <PartnersPage scope="DISTRIBUTORS" />
              </RequirePermission>
            ),
          },
          {
            path: "/distributors/approvals",
            element: (
              <RequirePermission permission="CUSTOMERS_MANAGE">
                <PartnersPage scope="DISTRIBUTOR_APPROVALS" />
              </RequirePermission>
            ),
          },
          {
            path: "/distributors/:distributorId",
            element: (
              <RequirePermission permission="CUSTOMERS_MANAGE">
                <PartnerDetailPage backPath="/distributors" titlePrefix="Distributor" />
              </RequirePermission>
            ),
          },
          {
            path: "/seller-coverage",
            element: (
              <RequirePermission permission="SETTINGS_MANAGE">
                <SellerCoveragePage />
              </RequirePermission>
            ),
          },
          {
            path: "/pricing",
            element: (
              <RequirePermission permission="CATALOG_MANAGE">
                <PricingPromotionsPage />
              </RequirePermission>
            ),
          },
          {
            path: "/promotions",
            element: (
              <RequirePermission permission="CATALOG_MANAGE">
                <PricingPromotionsPage />
              </RequirePermission>
            ),
          },
          {
            path: "/returns",
            element: (
              <RequirePermission permission="ORDERS_MANAGE">
                <ReturnsPage />
              </RequirePermission>
            ),
          },
          {
            path: "/returns/:returnId",
            element: (
              <RequirePermission permission="ORDERS_MANAGE">
                <ReturnsPage />
              </RequirePermission>
            ),
          },
          {
            path: "/reports",
            element: (
              <RequirePermission permission="ANALYTICS_VIEW">
                <ReportsPage />
              </RequirePermission>
            ),
          },
          {
            path: "/settings",
            element: (
              <RequirePermission permission="SETTINGS_MANAGE">
                <SettingsPage />
              </RequirePermission>
            ),
          },
          {
            path: "/settings/staff",
            element: (
              <RequirePermission permission="SETTINGS_MANAGE">
                <SettingsPage />
              </RequirePermission>
            ),
          },
          {
            path: "/settings/roles",
            element: (
              <RequirePermission permission="SETTINGS_MANAGE">
                <SettingsPage />
              </RequirePermission>
            ),
          },
          {
            path: "/settings/audit-log",
            element: (
              <RequirePermission permission="SETTINGS_MANAGE">
                <SettingsPage />
              </RequirePermission>
            ),
          },
          { path: "/403", element: <AccessDeniedPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

const AdminThemedApp: React.FC = () => {
  const { themeMode } = useAuth();
  const themeConfig = useMemo(() => buildAntdTheme(themeMode), [themeMode]);

  return (
    <ConfigProvider theme={themeConfig}>
      <AntdApp>
        <QueryClientProvider client={adminQueryClient}>
          <AdminToastProvider>
            <AdminErrorBoundary>
              <RouterProvider router={router} />
            </AdminErrorBoundary>
          </AdminToastProvider>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AdminThemedApp />
    </AuthProvider>
  );
}
