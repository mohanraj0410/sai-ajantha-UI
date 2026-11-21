import { CanonicalPriceTier } from "@sai-ajanta/types";
import {
  inrToPaise,
  paiseToInr,
  MoneyBreakdown,
  computeOrderMoneyBreakdown,
} from "../lib/money";

export interface LinePricingResult {
  unitPricePaise: number;
  subtotalPaise: number;
  gstAmountPaise: number;
  totalPaise: number;
  unitPriceInr: number;
  totalInr: number;
}

export class PricingService {
  /**
   * Applies server-authoritative tier discounts:
   * - CUSTOMER: 0% discount (base public MRP)
   * - DEALER: Standard approved trade discount (e.g., 15%)
   * - DISTRIBUTOR: Wholesale partner discount (e.g., 25%)
   */
  static applyTierDiscount(
    basePricePaise: number,
    tier: CanonicalPriceTier,
    discountPercentOverride?: number | null
  ): number {
    if (basePricePaise <= 0) return 0;
    if (tier === "CUSTOMER") return basePricePaise;

    let discountPct = 0;
    if (discountPercentOverride !== undefined && discountPercentOverride !== null) {
      discountPct = Math.max(0, Math.min(100, discountPercentOverride));
    } else {
      discountPct = tier === "DISTRIBUTOR" ? 25 : 15;
    }

    const multiplier = 1 - discountPct / 100;
    return Math.round(basePricePaise * multiplier);
  }

  /**
   * Computes precise line price with integer paise arithmetic and GST.
   */
  static calculateLinePrice(
    basePriceInr: number | null,
    tier: CanonicalPriceTier,
    quantity: number,
    gstRatePercent = 18,
    discountPercentOverride?: number | null
  ): LinePricingResult {
    if (basePriceInr === null || basePriceInr <= 0 || quantity <= 0) {
      return {
        unitPricePaise: 0,
        subtotalPaise: 0,
        gstAmountPaise: 0,
        totalPaise: 0,
        unitPriceInr: 0,
        totalInr: 0,
      };
    }

    const basePaise = inrToPaise(basePriceInr);
    const discountedUnitPricePaise = this.applyTierDiscount(
      basePaise,
      tier,
      discountPercentOverride
    );

    const subtotalPaise = discountedUnitPricePaise * quantity;
    const gstAmountPaise = Math.round((subtotalPaise * gstRatePercent) / 100);
    const totalPaise = subtotalPaise + gstAmountPaise;

    return {
      unitPricePaise: discountedUnitPricePaise,
      subtotalPaise,
      gstAmountPaise,
      totalPaise,
      unitPriceInr: paiseToInr(discountedUnitPricePaise),
      totalInr: paiseToInr(totalPaise),
    };
  }

  /**
   * Computes authoritative order totals across multiple line items.
   */
  static computeOrderTotals(
    lines: { unitPricePaise: number; quantity: number }[]
  ): MoneyBreakdown {
    const totalSubtotalPaise = lines.reduce(
      (acc, l) => acc + l.unitPricePaise * l.quantity,
      0
    );
    return computeOrderMoneyBreakdown({
      subtotalPaise: totalSubtotalPaise,
    });
  }
}
