import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminClient, adminFetch, getStoredAdminToken } from "./adminClient";
import { useEffect, useState } from "react";
import type { TableProps } from "antd";
import type { ProductItem } from "../types";

export const adminQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const adminQueryKeys = {
  dataset: (actorKey: string, dataset: string, params: Record<string, unknown>) =>
    ["admin", "dataset", dataset, actorKey, params] as const,
  portal: (actorKey: string) => ["admin", "portal", actorKey] as const,
  overview: (actorKey: string) => ["admin", "overview", actorKey] as const,
  analytics: (
    actorKey: string,
    opts: { fy?: string; onlySaiAjantaLogistics?: boolean; countPaidDistributorBulk?: boolean }
  ) => ["admin", "analytics", actorKey, opts] as const,
  orderDetail: (actorKey: string, orderId: string) =>
    ["admin", "order", actorKey, orderId] as const,
  auditLogs: (
    actorKey: string,
    params: {
      page?: number;
      pageSize?: number;
      action?: string;
      actor?: string;
      outcome?: string;
      resource?: string;
    }
  ) => ["admin", "audit-logs", actorKey, params] as const,
  staffDirectory: (actorKey: string) => ["admin", "staff", actorKey] as const,
  adminSettings: (actorKey: string) => ["admin", "settings", actorKey] as const,
  sellerCoverage: (actorKey: string, params: { pin?: string; category?: string }) =>
    ["admin", "seller-coverage", actorKey, params] as const,
  quotes: (actorKey: string) => ["admin", "quotes", actorKey] as const,
  inventoryLedger: (actorKey: string) => ["admin", "inventory-ledger", actorKey] as const,
  promotions: (actorKey: string) => ["admin", "promotions", actorKey] as const,
  productDetail: (actorKey: string, productId: string) =>
    ["admin", "product-detail", actorKey, productId] as const,
  enquiries: (actorKey: string) => ["admin", "enquiries", actorKey] as const,
  enquiryDetail: (actorKey: string, enquiryId: string) =>
    ["admin", "enquiry-detail", actorKey, enquiryId] as const,
  returns: (actorKey: string) => ["admin", "returns", actorKey] as const,
  orderDocuments: (actorKey: string, orderId: string) =>
    ["admin", "order-documents", actorKey, orderId] as const,
};

export interface AdminDatasetResponse<T> {
  items: T[];
  total: number;
  counts: Record<string, number>;
  page: number;
  pageSize: number;
  refreshedAt: string;
}

export function useAdminDataset<T extends object>(actorKey: string, dataset: string, filters: Record<string, string>) {
  const [sorting, setSorting] = useState({ sort: "created_at", direction: "descend" });
  filters = { ...filters, ...sorting };
  const signature = JSON.stringify(filters);
  const [paging, setPaging] = useState({ signature, page: 1, pageSize: 10 });
  const page = paging.signature === signature ? paging.page : 1;
  const params = { ...filters, page, pageSize: paging.pageSize };
  const query = useQuery({
    queryKey: adminQueryKeys.dataset(actorKey, dataset, params),
    queryFn: ({ signal }) => {
      const search = new URLSearchParams({ dataset, ...filters, page: String(page), pageSize: String(paging.pageSize) });
      return adminFetch<AdminDatasetResponse<T>>(`/admin/sai-ajanta/tab-data?${search}`, { signal });
    },
    enabled: Boolean(getStoredAdminToken()),
  });
  useEffect(() => {
    if (query.data && query.data.page !== page) setPaging({ signature, page: query.data.page, pageSize: paging.pageSize });
  }, [query.data, page, signature, paging.pageSize]);
  return {
    ...query,
    onTableChange: ((_pagination, _filters, sorter, extra) => {
      if (extra.action !== "sort") return;
      const active = Array.isArray(sorter) ? sorter[0] : sorter;
      setSorting(active.order ? { sort: String(active.columnKey), direction: active.order } : { sort: "created_at", direction: "descend" });
    }) as NonNullable<TableProps<T>["onChange"]>,
    getExportRows: async () => {
      const items: T[] = [];
      for (let next = 1; ; next++) {
        const search = new URLSearchParams({ dataset, ...filters, page: String(next), pageSize: "100" });
        const result = await adminFetch<AdminDatasetResponse<T>>(`/admin/sai-ajanta/tab-data?${search}`);
        items.push(...result.items);
        if (items.length >= result.total || result.items.length === 0) return items;
      }
    },
    pagination: {
      current: query.data?.page ?? page,
      pageSize: paging.pageSize,
      total: query.data?.total ?? 0,
      onChange: (next: number, size: number) => setPaging({ signature, page: size === paging.pageSize ? next : 1, pageSize: size }),
    },
  };
}

export function usePortalData(actorKey: string, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.portal(actorKey),
    queryFn: ({ signal }) => adminClient.fetchPortal(signal),
    enabled: enabled && Boolean(getStoredAdminToken()),
  });
}

export function useOverviewData(actorKey: string, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.overview(actorKey),
    queryFn: ({ signal }) => adminClient.fetchOverview(signal),
    enabled: enabled && Boolean(getStoredAdminToken()),
  });
}

export function useAnalyticsData(
  actorKey: string,
  opts: { fy?: string; onlySaiAjantaLogistics?: boolean; countPaidDistributorBulk?: boolean },
  enabled = true
) {
  return useQuery({
    queryKey: adminQueryKeys.analytics(actorKey, opts),
    queryFn: ({ signal }) => adminClient.fetchAnalytics(opts, signal),
    enabled: enabled && Boolean(getStoredAdminToken()),
  });
}

export function useOrderDetail(actorKey: string, orderId: string | undefined) {
  return useQuery({
    queryKey: adminQueryKeys.orderDetail(actorKey, orderId || ""),
    queryFn: ({ signal }) => adminClient.fetchOrderDetail(orderId!, signal),
    enabled: Boolean(orderId) && Boolean(getStoredAdminToken()),
  });
}

export function useAuditLogs(
  actorKey: string,
  params: {
    page?: number;
    pageSize?: number;
    action?: string;
    actor?: string;
    outcome?: string;
    resource?: string;
  },
  enabled = true
) {
  return useQuery({
    queryKey: adminQueryKeys.auditLogs(actorKey, params),
    queryFn: ({ signal }) => adminClient.fetchAuditLogs(params, signal),
    enabled: enabled && Boolean(getStoredAdminToken()),
  });
}

export function useStaffDirectory(actorKey: string, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.staffDirectory(actorKey),
    queryFn: ({ signal }) => adminClient.fetchStaffUsers(signal),
    enabled: enabled && Boolean(getStoredAdminToken()),
  });
}

export function useAdminSettings(actorKey: string, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.adminSettings(actorKey),
    queryFn: ({ signal }) => adminClient.fetchAdminSettings(signal),
    enabled: enabled && Boolean(getStoredAdminToken()),
  });
}

export function useSellerCoverage(
  actorKey: string,
  params: { pin?: string; category?: string },
  enabled = true
) {
  return useQuery({
    queryKey: adminQueryKeys.sellerCoverage(actorKey, params),
    queryFn: ({ signal }) => adminClient.fetchSellerCoverage(params, signal),
    enabled: enabled && Boolean(getStoredAdminToken()),
  });
}

export function useTradeQuotes(actorKey: string, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.quotes(actorKey),
    queryFn: ({ signal }) => adminClient.fetchTradeQuotes(signal),
    enabled: enabled && Boolean(getStoredAdminToken()),
  });
}

export function useInventoryLedger(actorKey: string, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.inventoryLedger(actorKey),
    queryFn: ({ signal }) => adminClient.fetchInventoryLedger(signal),
    enabled: enabled && Boolean(getStoredAdminToken()),
  });
}

export function usePromotionDrafts(actorKey: string, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.promotions(actorKey),
    queryFn: ({ signal }) => adminClient.fetchPromotionDrafts(signal),
    enabled: enabled && Boolean(getStoredAdminToken()),
  });
}

export function useProductDetail(actorKey: string, productId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.productDetail(actorKey, productId || ""),
    queryFn: ({ signal }) => adminClient.fetchProductDetail(productId!, signal),
    enabled: enabled && Boolean(productId) && Boolean(getStoredAdminToken()),
  });
}

export function useEnquiriesData(actorKey: string, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.enquiries(actorKey),
    queryFn: ({ signal }) => adminClient.fetchEnquiries(undefined, signal),
    enabled: enabled && Boolean(getStoredAdminToken()),
  });
}

export function useEnquiryDetail(actorKey: string, enquiryId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.enquiryDetail(actorKey, enquiryId || ""),
    queryFn: ({ signal }) => adminClient.fetchEnquiryDetail(enquiryId!, signal),
    enabled: enabled && Boolean(enquiryId) && Boolean(getStoredAdminToken()),
  });
}

export function useReturnsData(actorKey: string, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.returns(actorKey),
    queryFn: ({ signal }) => adminClient.fetchReturns(signal),
    enabled: enabled && Boolean(getStoredAdminToken()),
  });
}

export function useOrderDocuments(actorKey: string, orderId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: adminQueryKeys.orderDocuments(actorKey, orderId || ""),
    queryFn: ({ signal }) => adminClient.fetchOrderDocuments(orderId!, signal),
    enabled: enabled && Boolean(orderId) && Boolean(getStoredAdminToken()),
  });
}

export function useAdminMutations() {
  const qc = useQueryClient();

  const invalidate = (...resources: string[]) => async () => {
    const keys = new Set([...resources, "audit-logs"]);
    await qc.invalidateQueries({ predicate: query => query.queryKey[0] === "admin" &&
      keys.has(String(query.queryKey[1] === "dataset" ? query.queryKey[2] : query.queryKey[1])) });
  };

  const createProduct = useMutation({
    mutationFn: adminClient.createProduct,
    onSuccess: invalidate("products", "product-detail", "portal", "overview", "analytics", "inventory-ledger"),
  });

  const batchImportProducts = useMutation({
    mutationFn: (products: ProductItem[]) => adminClient.createProductBatch(products),
    onSuccess: invalidate("products", "product-detail", "portal", "overview", "analytics", "inventory-ledger"),
  });

  const stageImport = useMutation({
    mutationFn: (payload: Parameters<typeof adminClient.stageProductImport>[0]) =>
      adminClient.stageProductImport(payload),
    onSuccess: invalidate("import-jobs"),
  });

  const publishImport = useMutation({
    mutationFn: (jobId: string) => adminClient.publishProductImport(jobId),
    onSuccess: invalidate("import-jobs", "products", "product-detail", "portal", "overview", "analytics", "inventory-ledger"),
  });

  const updateProduct = useMutation({
    mutationFn: ({
      productId,
      payload,
    }: {
      productId: string;
      payload: Parameters<typeof adminClient.updateProduct>[1];
    }) => adminClient.updateProduct(productId, payload),
    onSuccess: invalidate("products", "product-detail", "portal", "overview", "analytics", "inventory-ledger"),
  });

  const updateOrder = useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: string;
      payload: Parameters<typeof adminClient.updateOrder>[1];
    }) => adminClient.updateOrder(orderId, payload),
    onSuccess: invalidate("orders", "order", "returns", "portal", "analytics", "inventory-ledger", "overview", "order-documents", "products", "product-detail"),
  });

  const createCustomer = useMutation({
    mutationFn: adminClient.createCustomerAccount,
    onSuccess: invalidate("partners", "portal", "overview", "analytics", "seller-coverage"),
  });

  const updateCustomerProfile = useMutation({
    mutationFn: ({
      customerId,
      payload,
    }: {
      customerId: string;
      payload: Parameters<typeof adminClient.updateCustomerProfile>[1];
    }) => adminClient.updateCustomerProfile(customerId, payload),
    onSuccess: invalidate("partners", "portal", "overview", "analytics", "seller-coverage"),
  });

  const updateEnquiryStatus = useMutation({
    mutationFn: ({
      enquiryId,
      status,
    }: {
      enquiryId: string;
      status: Parameters<typeof adminClient.updateEnquiryStatus>[1];
    }) => adminClient.updateEnquiryStatus(enquiryId, status),
    onSuccess: invalidate("enquiries", "enquiry-detail", "portal"),
  });

  const executeEnquiryAction = useMutation({
    mutationFn: ({
      enquiryId,
      payload,
    }: {
      enquiryId: string;
      payload: Parameters<typeof adminClient.executeEnquiryAction>[1];
    }) => adminClient.executeEnquiryAction(enquiryId, payload),
    onSuccess: invalidate("enquiries", "enquiry-detail", "portal", "quotes"),
  });

  const convertQuoteToOrder = useMutation({
    mutationFn: (quoteId: string) => adminClient.convertQuoteToOrder(quoteId),
    onSuccess: invalidate("quotes", "enquiries", "enquiry-detail", "orders", "portal"),
  });

  const syncNas = useMutation({
    mutationFn: adminClient.syncNasMedia,
    onSuccess: invalidate("products", "product-detail", "portal", "overview"),
  });

  const createStaffUser = useMutation({
    mutationFn: adminClient.createStaffUser,
    onSuccess: invalidate("staff"),
  });

  const updateStaffUser = useMutation({
    mutationFn: ({
      staffId,
      payload,
    }: {
      staffId: string;
      payload: Parameters<typeof adminClient.updateStaffUser>[1];
    }) => adminClient.updateStaffUser(staffId, payload),
    onSuccess: invalidate("staff"),
  });

  const updateAdminSettings = useMutation({
    mutationFn: adminClient.updateAdminSettings,
    onSuccess: invalidate("settings"),
  });

  const createTradeQuote = useMutation({
    mutationFn: adminClient.createTradeQuote,
    onSuccess: invalidate("quotes"),
  });

  const updateTradeQuote = useMutation({
    mutationFn: ({
      quoteId,
      payload,
    }: {
      quoteId: string;
      payload: Parameters<typeof adminClient.updateTradeQuote>[1];
    }) => adminClient.updateTradeQuote(quoteId, payload),
    onSuccess: invalidate("quotes"),
  });

  const updateReturnInspection = useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: string;
      payload: Parameters<typeof adminClient.updateReturnInspection>[1];
    }) => adminClient.updateReturnInspection(orderId, payload),
    onSuccess: invalidate("returns", "orders", "order", "portal"),
  });

  const createPromotionDraft = useMutation({
    mutationFn: adminClient.createPromotionDraft,
    onSuccess: invalidate("promotions"),
  });

  const transitionOrder = useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: string;
      payload: Parameters<typeof adminClient.transitionOrder>[1];
    }) => adminClient.transitionOrder(orderId, payload),
    onSuccess: invalidate("orders", "order", "returns", "portal", "analytics", "inventory-ledger", "overview", "order-documents", "products", "product-detail"),
  });

  const generateOrderDocument = useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: string;
      payload: Parameters<typeof adminClient.generateOrderDocument>[1];
    }) => adminClient.generateOrderDocument(orderId, payload),
    onSuccess: invalidate("order-documents", "order"),
  });

  const inspectOrderReturn = useMutation({
    mutationFn: ({
      returnId,
      payload,
    }: {
      returnId: string;
      payload: Parameters<typeof adminClient.inspectOrderReturn>[1];
    }) => adminClient.inspectOrderReturn(returnId, payload),
    onSuccess: invalidate("returns", "orders", "order", "portal", "inventory-ledger", "overview", "products", "product-detail"),
  });

  return {
    createProduct,
    batchImportProducts,
    stageImport,
    publishImport,
    updateProduct,
    updateOrder,
    transitionOrder,
    generateOrderDocument,
    inspectOrderReturn,
    createCustomer,
    updateCustomerProfile,
    updateEnquiryStatus,
    executeEnquiryAction,
    convertQuoteToOrder,
    syncNas,
    createStaffUser,
    updateStaffUser,
    updateAdminSettings,
    createTradeQuote,
    updateTradeQuote,
    updateReturnInspection,
    createPromotionDraft,
  };
}
