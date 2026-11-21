import type {
  LineTaxDetailDto,
  CalculatedOrderTotalsDto,
} from "@sai-ajanta/types";

export interface TaxCalculationInputLine {
  sku: string;
  quantity: number;
  unitPricePaise: number | null;
  gstRatePercent: number | null;
  hsnCode?: string | null;
}

export interface TaxCalculationContext {
  sellerStateCode?: string; // Default '33' (Tamil Nadu)
  buyerPostalCode?: string;
  buyerStateCode?: string;
  shippingPaise?: number;
  discountPaise?: number;
}

export class TaxEngineService {
  /**
   * Resolves 2-digit Indian State Code from 6-digit postal code.
   * Tamil Nadu: 600xxx - 643xxx -> '33'
   * Karnataka: 560xxx - 591xxx -> '29'
   * Kerala: 670xxx - 695xxx -> '32'
   * Andhra Pradesh: 515xxx - 535xxx -> '37'
   * Telangana: 500xxx - 509xxx -> '36'
   * Maharashtra: 400xxx - 445xxx -> '27'
   * Delhi: 110xxx -> '07'
   * Returns null if unassigned, invalid, or unrecognized (Safety Rule: No tax guesswork).
   */
  static resolveStateCodeFromPostalCode(postalCode?: string): string | null {
    if (!postalCode || !/^\d{6}$/.test(postalCode.trim())) {
      return null;
    }
    const pin = parseInt(postalCode.trim().substring(0, 3), 10);
    if (pin >= 600 && pin <= 643) return "33"; // Tamil Nadu
    if (pin >= 560 && pin <= 591) return "29"; // Karnataka
    if (pin >= 670 && pin <= 695) return "32"; // Kerala
    if (pin >= 515 && pin <= 535) return "37"; // Andhra Pradesh
    if (pin >= 500 && pin <= 509) return "36"; // Telangana
    if (pin >= 400 && pin <= 445) return "27"; // Maharashtra
    if (pin === 110) return "07"; // Delhi
    return null;
  }

  /**
   * P9.2: Calculates verified line-item and order totals in exact integer paise.
   * Safety Rule 6: Never defaults missing GST to 18%; forces TAX_UNVERIFIED.
   */
  static calculateOrderTaxes(
    lines: TaxCalculationInputLine[],
    context: TaxCalculationContext = {}
  ): CalculatedOrderTotalsDto & { lineTaxDetails: LineTaxDetailDto[] } {
    const sellerState = (context.sellerStateCode || "33").trim();
    const resolvedBuyerState =
      context.buyerStateCode?.trim() ||
      (context.buyerPostalCode ? TaxEngineService.resolveStateCodeFromPostalCode(context.buyerPostalCode) : null);

    const isPlaceOfSupplyUnverified = !resolvedBuyerState;
    const buyerState = resolvedBuyerState || "UNKNOWN";
    const isIntraState = !isPlaceOfSupplyUnverified && sellerState === buyerState;
    const lineTaxDetails: LineTaxDetailDto[] = [];
    const unverifiedReasons: string[] = [];

    let subtotalPaise = 0;
    let cgstTotalPaise = 0;
    let sgstTotalPaise = 0;
    let igstTotalPaise = 0;

    let isTaxFullyVerified = !isPlaceOfSupplyUnverified;
    let requiresQuotation = isPlaceOfSupplyUnverified;

    if (isPlaceOfSupplyUnverified) {
      unverifiedReasons.push(
        `Place of supply state could not be verified from postal code '${context.buyerPostalCode || "missing"}' (Safety Rule: No tax guesswork allowed)`
      );
    }

    for (const line of lines) {
      const isPriceMissing = line.unitPricePaise === null || line.unitPricePaise <= 0;
      const isGstMissing = line.gstRatePercent === null || isNaN(Number(line.gstRatePercent));

      if (isPriceMissing || isGstMissing) {
        isTaxFullyVerified = false;
        requiresQuotation = true;
        const reason = isPriceMissing
          ? `SKU '${line.sku}' has unverified/missing price`
          : `SKU '${line.sku}' has unverified/missing GST rate (Safety Rule 6: No 18% default allowed)`;
        unverifiedReasons.push(reason);

        lineTaxDetails.push({
          sku: line.sku,
          hsnCode: line.hsnCode || null,
          taxableValuePaise: 0,
          gstRatePercent: null,
          taxType: "UNVERIFIED",
          cgstRatePercent: 0,
          cgstAmountPaise: 0,
          sgstRatePercent: 0,
          sgstAmountPaise: 0,
          igstRatePercent: 0,
          igstAmountPaise: 0,
          totalTaxPaise: 0,
          isTaxVerified: false,
        });
        continue;
      }

      const taxableValue = (line.unitPricePaise || 0) * line.quantity;
      subtotalPaise += taxableValue;

      const rate = Number(line.gstRatePercent);
      if (isIntraState) {
        const halfRate = rate / 2;
        const cgst = Math.round(taxableValue * (halfRate / 100));
        const sgst = Math.round(taxableValue * (halfRate / 100));
        cgstTotalPaise += cgst;
        sgstTotalPaise += sgst;

        lineTaxDetails.push({
          sku: line.sku,
          hsnCode: line.hsnCode || null,
          taxableValuePaise: taxableValue,
          gstRatePercent: rate,
          taxType: "INTRA_STATE",
          cgstRatePercent: halfRate,
          cgstAmountPaise: cgst,
          sgstRatePercent: halfRate,
          sgstAmountPaise: sgst,
          igstRatePercent: 0,
          igstAmountPaise: 0,
          totalTaxPaise: cgst + sgst,
          isTaxVerified: true,
        });
      } else {
        const igst = Math.round(taxableValue * (rate / 100));
        igstTotalPaise += igst;

        lineTaxDetails.push({
          sku: line.sku,
          hsnCode: line.hsnCode || null,
          taxableValuePaise: taxableValue,
          gstRatePercent: rate,
          taxType: "INTER_STATE",
          cgstRatePercent: 0,
          cgstAmountPaise: 0,
          sgstRatePercent: 0,
          sgstAmountPaise: 0,
          igstRatePercent: rate,
          igstAmountPaise: igst,
          totalTaxPaise: igst,
          isTaxVerified: true,
        });
      }
    }

    const shippingPaise = Math.max(0, context.shippingPaise || 0);
    // Shipping tax follows standard rate if applicable (18% only if verified, else 0)
    const shippingTaxPaise = 0; // Configurable per owner shipping policy
    const discountPaise = Math.max(0, context.discountPaise || 0);

    const totalTaxPaise = cgstTotalPaise + sgstTotalPaise + igstTotalPaise + shippingTaxPaise;
    const grandTotalPaise = Math.max(
      0,
      subtotalPaise + totalTaxPaise + shippingPaise - discountPaise
    );

    const resolvedTaxType = !isTaxFullyVerified
      ? "UNVERIFIED"
      : isIntraState
      ? "INTRA_STATE"
      : "INTER_STATE";

    return {
      subtotalPaise,
      cgstTotalPaise,
      sgstTotalPaise,
      igstTotalPaise,
      cgstPaise: cgstTotalPaise,
      sgstPaise: sgstTotalPaise,
      igstPaise: igstTotalPaise,
      totalTaxPaise,
      shippingPaise,
      shippingTaxPaise,
      discountPaise,
      grandTotalPaise,
      taxType: resolvedTaxType as any,
      isTaxVerified: isTaxFullyVerified,
      isTaxFullyVerified,
      requiresQuotation,
      unverifiedReasons,
      lineTaxDetails,
    };
  }
}
