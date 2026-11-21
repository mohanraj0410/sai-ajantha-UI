export type ProductCategory =
  | "Aluminium"
  | "Clip"
  | "Door Closer & Floor Spring"
  | "FGM Fittings"
  | "Frames & Channels"
  | "Hardware"
  | "Insect Screens"
  | "Kitchen Basket"
  | "Ladder"
  | "Mesh"
  | "Rubber & PVC";

export interface ProductItem {
  id: string;
  medusaId?: string;
  handle?: string;
  filename: string;
  src: string;
  images?: string[];
  category: ProductCategory;
  subcategory: string | null;
  code: string | null;
  name: string;
  productNumber?: string | null;
  brand?: string | null;
  model?: string | null;
  size?: string | null;
  measurements?: string | null;
  material?: string | null;
  variantsNote?: string | null;
  description?: string | null;
  buyingHighlights?: string | null;
  features?: string | null;
  customerBenefits?: string | null;
  specificationSummary?: string | null;
  warranty?: string | null;
  moq?: string | null;
  availability?: string | null;
  deliveryTime?: string | null;
  unitPriceInr?: number | null;
  customerPriceInr?: number | null;
  contractorPriceInr?: number | null;
  dealerPriceInr?: number | null;
  distributorPriceInr?: number | null;
  billingUnit?: string;
  gstRate?: number;
  gstMode?: string;
  stockQty?: number;
  approved?: boolean;
  isQuoteOnly?: boolean;
  sellerRoute?: string | null;
  metadata?: Record<string, unknown>;
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  "Hardware",
  "Aluminium",
  "Insect Screens",
  "Door Closer & Floor Spring",
  "Kitchen Basket",
  "FGM Fittings",
  "Rubber & PVC",
  "Ladder",
  "Mesh",
  "Clip",
  "Frames & Channels"
];

export const PRODUCTS: ProductItem[] = [];
