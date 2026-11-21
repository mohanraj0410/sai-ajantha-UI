export type ActiveTab =
  | "DASHBOARD"
  | "DISTRIBUTORS"
  | "PRODUCTS"
  | "IMPORT"
  | "ORDERS"
  | "CUSTOMERS"
  | "PRICING"
  | "SETTINGS"
  | "REPORTS";

export interface ProductItem {
  id: string;
  sku: string;
  title: string;
  name?: string;
  category: string;
  subcategory: string;
  brand: string;
  model?: string;
  productNumber?: string;
  size: string;
  measurementsAndUnits?: string;
  material: string;
  customerPriceInr: number;
  contractorPriceInr?: number;
  dealerPriceInr: number;
  distributorPriceInr: number;
  unit: string;
  billingUnit?: string;
  stockQty: number;
  gstRate: number;
  isManufactured: boolean;
  thumbnail?: string;
  src?: string;
  description?: string;
  cmsStatus?: "DRAFT" | "REVIEW" | "APPROVED" | "PUBLISHED";
  internalNotes?: string;
  highlights?: string[];
  benefits?: string[];
  features?: string[];
  customerBenefits?: string[];
  variants?: string[];
  deliveryInfo?: string;
  images?: string[];
  otherDocumentLinks?: string[];
  warrantyInfo?: string;
  referenceSellingPriceInr?: number | null;
  faq?: string[] | { question: string; answer?: string }[];
  productSpecification?: Record<string, unknown>;
  saleRoute?: string;
  isQuoteOnly?: boolean;
  minOrderQty?: string | number | null;
  maxOrderQty?: number | null;
  installationEligible?: boolean;
  hsnCode?: string | null;
  deliveryPriceInr?: number | null;
  technicalVerificationStatus?: string;
  contentVerificationStatus?: string;
  specFields?: Record<string, string>;
}

export interface DistributorItem {
  id: string;
  name: string;
  companyName: string;
  gstin: string;
  phone: string;
  email: string;
  territory: "South Zone" | "Central Zone" | "West Zone" | "North Zone";
  creditLimit: number;
  creditUsed: number;
  status: "ACTIVE" | "PENDING" | "SUSPENDED";
  ordersCount: number;
  totalVolumeInr: number;
}

export interface DealerItem {
  id: string;
  name: string;
  companyName: string;
  distributorId: string;
  phone: string;
  email: string;
  city: string;
  status: "ACTIVE" | "PENDING";
}

export type OrderRoutingStatus =
  | "DIRECT_FULFILLMENT"
  | "PENDING_DISTRIBUTOR"
  | "ROUTED_TO_DISTRIBUTOR"
  | "ASSIGNED_TO_DEALER"
  | "DELIVERED_BY_DEALER";

export type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "INVOICED"
  | "CANCELLED";

export interface OrderItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerCity?: string;
  distributorId?: string;
  type: "MANUFACTURED_ALUMINIUM" | "MANUFACTURED_FRAMES" | "GENERAL_HARDWARE";
  itemsSummary: string;
  totalAmount: number;
  status: OrderStatus;
  date: string;
  isManufactured: boolean;
  routingStatus?: OrderRoutingStatus;
  assignedDistributorId?: string;
  assignedDistributorName?: string;
  assignedDealerId?: string;
  assignedDealerName?: string;
  // Logistics, Quality & Incident Tracking
  fulfillmentType?: "DELIVERY" | "PICKUP";
  isDirectSaiAjanta?: boolean;
  cancellationReason?: string | null;
  returnStatus?: "NONE" | "REQUESTED" | "RETURNED" | "INSPECTED";
  isDamaged?: boolean;
  damageClaimStatus?: "NONE" | "REPORTED" | "VERIFIED" | "REPLACED";
  damagedQty?: number;
  shipmentFailureReason?: string | null;
  deliveryAttempts?: number;
}

export interface CustomerItem {
  id: string;
  name: string;
  companyName: string;
  gstin: string;
  phone: string;
  email: string;
  pricingGroup: "RETAIL" | "DEALER" | "DISTRIBUTOR";
  totalOrders: number;
  totalSpentInr: number;
}

export interface PromoCodeItem {
  id: string;
  code: string;
  description: string;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: number;
  minOrderInr: number;
  validUntil: string;
  isActive: boolean;
}

export interface ParsedImportRow {
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  model?: string;
  product_number?: string;
  size: string;
  measurements_and_units?: string;
  material: string;
  billing_unit: string;
  customer_price_inr: number | null;
  contractor_price_inr?: number | null;
  dealer_price_inr: number | null;
  distributor_price_inr: number | null;
  cms_status?: "DRAFT" | "REVIEW" | "APPROVED" | "PUBLISHED";
  is_sample_row?: boolean;
  gst_rate: number;
  stock_qty: number | null;
  is_manufactured: boolean;
  src: string;
  description: string;
  features?: string[];
  customer_benefits?: string[];
  variants?: string[];
  delivery_info?: string;
  images?: string[];
  other_document_links?: string[];
  warranty_info?: string;
  reference_selling_price_inr?: number | null;
  faq?: string[] | { question: string; answer?: string }[];
  product_specification?: Record<string, unknown>;
  sale_route?: string;
  is_quote_only?: boolean;
  min_order_qty?: string | number | null;
  max_order_qty?: number | null;
  installation_eligible?: boolean;
  hsn_code?: string | null;
  delivery_price_inr?: number | null;
  technical_verification_status?: string;
  content_verification_status?: string;
  proposed_action?: string;
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}
