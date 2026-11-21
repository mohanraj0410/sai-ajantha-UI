import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BackendErrorState } from "@/components/BackendErrorState";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductDetailView } from "@/components/ProductDetailView";
import { ScrollProgressBar } from "@/components/ScrollProgressBar";
import { BRAND_CONTACT } from "@/lib/brand";
import { getProductSpecData, getRelatedProducts } from "@/lib/productSpecs";
import { serializeJsonLd } from "@/lib/security";
import {
  fetchMedusaCatalogStrict,
  medusaCatalogProductToProductItem,
} from "@/lib/server/medusa";
import "./product-detail.css";

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  await connection();
  const { id } = await params;
  const catalogRes = await fetchMedusaCatalogStrict();

  if (!catalogRes.ok) {
    return {
      title: "Product Catalogue Unavailable | Sai Ajantha",
    };
  }

  const mp = catalogRes.products.find(
    (product) =>
      product.id === id ||
      product.medusaId === id ||
      product.handle === id ||
      product.sku === id ||
      product.sku.toLowerCase() === id.toLowerCase()
  );

  if (!mp) {
    return {
      title: "Product Specification Not Found | Sai Ajantha",
    };
  }

  const item = medusaCatalogProductToProductItem(mp, mp.customerPriceInr);
  const skuCode = item.code ?? item.id.toUpperCase();

  return {
    title: `${item.name} (${skuCode}) | ${item.category}`,
    description: `Technical specifications, material grade, finishes, and BOQ procurement details for ${item.name} (${skuCode}) in ${item.category} from ${BRAND_CONTACT.companyName}.`,
    alternates: { canonical: `/products/${item.id}` },
  };
}

async function ProductSpecsContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const catalogRes = await fetchMedusaCatalogStrict();

  if (!catalogRes.ok) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-8 lg:px-12">
        <BackendErrorState
          title="Unable to Load Product Specification"
          message={catalogRes.error}
        />
      </div>
    );
  }

  const mappedCatalog = catalogRes.products.map((mp) =>
    medusaCatalogProductToProductItem(mp, mp.customerPriceInr)
  );
  const item = mappedCatalog.find(
    (product) =>
      product.id === id ||
      product.medusaId === id ||
      product.handle === id ||
      product.code === id ||
      (product.code || "").toLowerCase() === id.toLowerCase()
  );

  if (!item) {
    notFound();
  }

  const spec = getProductSpecData(item);
  const related = getRelatedProducts(item, mappedCatalog, 4);
  const skuCode = item.code ?? item.id.toUpperCase();
  const schemaImage = item.src.startsWith("http")
    ? item.src
    : `${BRAND_CONTACT.websiteUrl}${item.src}`;

  const isFloorSpringProduct =
    item.category === "Door Closer & Floor Spring" &&
    (item.name.toLowerCase().includes("floor") || (item.code || "").toUpperCase().includes("FS"));
  const isQuoteOnlyProduct = Boolean(item.isQuoteOnly) || isFloorSpringProduct;

  const availabilityUrl = isQuoteOnlyProduct
    ? "https://schema.org/LimitedAvailability"
    : (item.stockQty !== undefined && item.stockQty <= 0)
      ? "https://schema.org/OutOfStock"
      : "https://schema.org/InStock";

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${item.name} (${skuCode})`,
    sku: skuCode,
    category: item.category,
    description: spec.overviewSummary,
    image: schemaImage,
    brand: {
      "@type": "Brand",
      name: BRAND_CONTACT.companyName,
    },
    ...(spec.verifiedPriceInr !== null && !isQuoteOnlyProduct
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: spec.verifiedPriceInr,
            availability: availabilityUrl,
          },
        }
      : {
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            availability: availabilityUrl,
          },
        }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productSchema) }}
      />
      <ProductDetailView
        key={item.id}
        item={item}
        spec={spec}
        relatedItems={related}
      />
    </>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="sa-pdp sa-content-width pb-12" role="status">
      <span className="sr-only">Loading product details</span>
      <div className="sa-pdp-trail" aria-hidden="true">
        <div className="h-4 w-48 max-w-full rounded bg-[#e2eaf1]" />
      </div>
      <div className="sa-pdp-layout" aria-hidden="true">
        <div className="sa-pdp-heading space-y-3">
          <div className="h-4 w-24 rounded bg-[#e2eaf1]" />
          <div className="h-10 w-3/4 rounded bg-[#e2eaf1]" />
          <div className="h-12 w-full rounded bg-[#e2eaf1]" />
        </div>
        <div className="sa-pdp-gallery">
          <div className="sa-pdp-stage rounded-[18px]" />
        </div>
        <div className="sa-pdp-buy h-64 bg-[#eef3f7]" />
      </div>
    </div>
  );
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  return (
    <StorefrontSurface family="product">
      <div className="min-h-screen flex flex-col bg-white">
        <ScrollProgressBar />
        <Suspense fallback={<div className="h-[74px] border-b border-[#C6CAD5] bg-white" />}>
          <Header />
        </Suspense>
        <main id="main-content" className="flex-1">
          <Suspense fallback={<ProductDetailSkeleton />}>
            <ProductSpecsContent params={params} />
          </Suspense>
        </main>
        <Footer />
      </div>
    </StorefrontSurface>
  );
}
