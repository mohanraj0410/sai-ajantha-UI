import fs from "node:fs";
import path from "node:path";
import { MedusaError } from "@medusajs/framework/utils";

export interface NasCatalogProduct {
  id: string;
  productNumber: string;
  sku: string;
  name: string;
  rawName?: string;
  category: string;
  categorySlug: string;
  sheet: string;
  brand: string;
  model: string;
  size: string;
  measurements: string;
  material: string;
  variantsNote: string;
  description: string;
  buyingHighlights: string;
  features: string;
  customerBenefits: string;
  specificationSummary: string;
  billingUnit: string;
  gstRate: string | number | null;
  gstMode: string;
  moq: string;
  availability: string;
  deliveryTime: string;
  warranty: string;
  buyingOption: string;
  approvalStatus: string;
  approved: boolean;
  customerPriceInr: number | null;
  contractorPriceInr: number | null;
  dealerPriceInr: number | null;
  distributorPriceInr: number | null;
  publicSrc: string;
  nasRelativePath: string;
  nasUrl: string;
  matchMethod: string;
}

export interface NasCatalogManifest {
  generatedAt: string;
  sourceWorkbook: string;
  nasRoot: string;
  medusaStaticBaseUrl: string;
  totalProducts: number;
  matchedImagesCount: number;
  missingImagesCount: number;
  categories: string[];
  products: NasCatalogProduct[];
}

export function resolveLocalNasRoot(): string {
  const envDir = process.env.NAS_PUBLIC_MEDIA_ROOT || process.env.LOCAL_NAS_DIR;
  const candidates = [
    envDir ? path.resolve(process.cwd(), envDir) : null,
    path.resolve(process.cwd(), "../../../local-nas"),
    path.resolve(process.cwd(), "../../../../local-nas"),
    path.resolve(__dirname, "../../../../../local-nas"),
    path.resolve(__dirname, "../../../../../../local-nas"),
    path.resolve(__dirname, "../../../../local-nas"),
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

export function loadNasCatalogManifest(): NasCatalogManifest {
  const nasRoot = resolveLocalNasRoot();
  const manifestPath = path.join(nasRoot, "catalog-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Local NAS manifest not found at ${manifestPath}. Run "python ../../scripts/build-workbook-catalog.py" first.`
    );
  }
  const raw = fs.readFileSync(manifestPath, "utf8");
  return JSON.parse(raw) as NasCatalogManifest;
}

function normalizeTokenText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

/**
 * Matches a Medusa product against the Sai Ajantha workbook Local NAS manifest.
 */
export function matchProductInNasManifest(
  manifest: NasCatalogManifest,
  candidate: {
    handle?: string | null;
    legacyId?: string | null;
    sku?: string | null;
    category?: string | null;
    title?: string | null;
  }
): NasCatalogProduct | null {
  const legacyId = candidate.legacyId?.trim();
  if (legacyId) {
    const byId = manifest.products.find((p) => p.id === legacyId);
    if (byId) return byId;
  }

  const sku = candidate.sku?.trim();
  if (sku) {
    const skuNorm = normalizeTokenText(sku);
    const bySku = manifest.products.find(
      (p) =>
        normalizeTokenText(p.sku) === skuNorm ||
        normalizeTokenText(p.productNumber) === skuNorm
    );
    if (bySku) return bySku;
  }

  const handle = candidate.handle?.trim();
  if (handle) {
    const handleNorm = normalizeTokenText(handle);
    const byHandle = manifest.products.find(
      (p) =>
        p.id === handle ||
        normalizeTokenText(p.sku) === handleNorm ||
        normalizeTokenText(p.name) === handleNorm
    );
    if (byHandle) return byHandle;
  }

  const title = candidate.title?.trim();
  if (title) {
    const titleTokens = new Set(tokenize(title));
    const categoryNorm = candidate.category
      ? normalizeTokenText(candidate.category)
      : "";
    let best: { item: NasCatalogProduct; score: number } | null = null;

    for (const item of manifest.products) {
      let score = 0;
      if (categoryNorm && normalizeTokenText(item.category) === categoryNorm) {
        score += 3;
      }
      for (const token of tokenize(item.name)) {
        if (titleTokens.has(token)) score += 2;
      }
      if (!best || score > best.score) {
        best = { item, score };
      }
    }

    if (best && best.score >= 4) {
      return best.item;
    }
  }

  return null;
}
