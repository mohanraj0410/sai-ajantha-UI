import {
  PublicCatalogItemDto,
  TradeCatalogItemDto,
  CanonicalSellerRoute,
  validatePublicCatalogItemDto,
} from "@sai-ajanta/types";
import { SellerRoutingService } from "./seller-routing.service";

export class CatalogReadService {
  /**
   * Projects raw catalog products into the strictly allowlisted public B2C DTO.
   * Prohibits wholesale, dealer, or distributor price exposure.
   */
  static projectPublicCatalog(rawProducts: any[]): PublicCatalogItemDto[] {
    const list: PublicCatalogItemDto[] = [];

    for (const raw of rawProducts) {
      const category = String(raw.category || raw.category_name || "Hardware").trim();
      const route: CanonicalSellerRoute = SellerRoutingService.getRouteForCategory(category);

      const isQuoteOnly =
        Boolean(raw.isQuoteOnly || raw.is_quote_only) ||
        route === "ENQUIRY_ONLY" ||
        raw.verifiedPriceInr === null ||
        raw.customerPriceInr === null ||
        raw.price === null;

      let priceInr: number | null = null;
      let pricePaise: number | null = null;

      if (!isQuoteOnly) {
        const rawPrice =
          raw.publicPriceInr ??
          raw.verifiedPriceInr ??
          raw.customerPriceInr ??
          raw.price;

        if (rawPrice !== null && rawPrice !== undefined && !isNaN(Number(rawPrice))) {
          priceInr = Math.round(Number(rawPrice) * 100) / 100;
          pricePaise = Math.round(priceInr * 100);
        }
      }

      const candidate: PublicCatalogItemDto = {
        id: String(raw.id || raw._id || ""),
        sku: String(raw.sku || raw.code || ""),
        name: String(raw.name || raw.title || ""),
        category,
        subcategory: raw.subcategory ? String(raw.subcategory) : null,
        src: String(raw.src || raw.thumbnail || raw.publicSrc || ""),
        route,
        isQuoteOnly,
        publicPriceInr: priceInr,
        publicPricePaise: pricePaise,
        isManufactured: Boolean(raw.isManufactured || raw.is_manufactured),
        inStock: raw.inStock !== undefined ? Boolean(raw.inStock) : true,
        specifications:
          typeof raw.specifications === "object" && raw.specifications !== null
            ? raw.specifications
            : {},
      };

      const validation = validatePublicCatalogItemDto(candidate);
      if (validation.success) {
        list.push(validation.data);
      }
    }

    return list;
  }

  /**
   * Projects raw products for authenticated staff or verified trade sessions.
   */
  static projectTradeCatalog(
    rawProducts: any[],
    actorRole: "STAFF" | "DEALER" | "DISTRIBUTOR"
  ): TradeCatalogItemDto[] {
    const publicList = this.projectPublicCatalog(rawProducts);
    const tradeList: TradeCatalogItemDto[] = [];

    for (let i = 0; i < publicList.length; i++) {
      const pub = publicList[i];
      const raw = rawProducts[i];

      const dealerPrice = raw.dealerPriceInr ?? raw.dealer_price_inr ?? null;
      const distPrice = raw.distributorPriceInr ?? raw.distributor_price_inr ?? null;
      const landingCost = actorRole === "STAFF" ? (raw.baseLandingCost ?? raw.cost_price ?? null) : null;

      tradeList.push({
        ...pub,
        dealerPricePaise: dealerPrice !== null ? Math.round(Number(dealerPrice) * 100) : null,
        distributorPricePaise: distPrice !== null ? Math.round(Number(distPrice) * 100) : null,
        baseLandingCostPaise: landingCost !== null ? Math.round(Number(landingCost) * 100) : null,
        tradeDiscountPercent: raw.tradeDiscountPercent ?? (actorRole === "DISTRIBUTOR" ? 25 : 15),
        minimumOrderQuantity: raw.moq ? Number(raw.moq) : 1,
      });
    }

    return tradeList;
  }
}
