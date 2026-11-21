import { Pool } from "pg";
import {
  CanonicalOrderType,
  CanonicalOrderStatus,
  OrderLineItemDto,
  CanonicalOrderDto,
} from "@sai-ajanta/types";
import { SellerRoutingService } from "./seller-routing.service";
import { InventoryReservationService } from "./inventory-reservation.service";
import { AggregatedStockRequirement } from "../lib/inventory";
import { getPaymentProvider } from "../lib/payment/razorpay-provider";

export interface CreateOrderParams {
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  checkoutIntentId: string;
  items: OrderLineItemDto[];
  notes?: string | null;
  organization?: string;
  gstin?: string | null;
}

export class QuoteOrderService {
  /**
   * Evaluates order type based on items:
   * - If ANY item is quote-only or route is ENQUIRY_ONLY -> "BOQ_ENQUIRY"
   * - If verified trade PO -> "VERIFIED_TRADE_PO"
   * - Otherwise -> "DIRECT_SALE"
   */
  static determineOrderType(items: OrderLineItemDto[]): CanonicalOrderType {
    for (const item of items) {
      if (item.isQuoteItem) {
        return "BOQ_ENQUIRY";
      }
      const route = SellerRoutingService.getRouteForCategory(item.category);
      if (route === "ENQUIRY_ONLY") {
        return "BOQ_ENQUIRY";
      }
    }
    return "DIRECT_SALE";
  }

  /**
   * Processes order creation with atomic transaction safety and zero orphan holds.
   */
  static async createOrder(
    pool: Pool,
    params: CreateOrderParams
  ): Promise<{
    order: CanonicalOrderDto;
    requiresPayment: boolean;
    razorpayOrderId?: string;
  }> {
    const orderType = this.determineOrderType(params.items);
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const orderNumber = `SA-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    let subtotalPaise = 0;
    let gstAmountPaise = 0;
    let totalPaise = 0;

    const hasQuoteItems = orderType === "BOQ_ENQUIRY";

    if (!hasQuoteItems) {
      for (const item of params.items) {
        const lineTotal = item.lineTotalPaise ?? (item.unitPricePaise ?? 0) * item.quantity;
        subtotalPaise += lineTotal;
        const rate = (item as any).taxRatePercent ?? (item as any).gstRate ?? null;
        if (rate !== null && !isNaN(Number(rate))) {
          gstAmountPaise += Math.round((lineTotal * Number(rate)) / 100);
        }
      }
      totalPaise = subtotalPaise + gstAmountPaise;
    }

    const initialStatus: CanonicalOrderStatus = hasQuoteItems
      ? "BOQ_QUOTE_REQUESTED"
      : "PENDING_PAYMENT";

    const client = await pool.connect();
    try {
      await client.query("BEGIN;");

      // 1. Stock Reservation (ONLY for payable direct sale items; NEVER for quote-only)
      if (!hasQuoteItems && totalPaise > 0) {
        const stockRequirements: AggregatedStockRequirement[] = params.items.map((item) => ({
          aggregationKey: `${item.inventoryItemId}::${item.locationId}::${item.sellerId}`,
          productId: item.productId,
          variantId: item.productId,
          inventoryItemId: item.inventoryItemId,
          locationId: item.locationId,
          sellerId: item.sellerId,
          sku: item.sku,
          name: item.name,
          totalUnits: item.quantity,
          lineItemsCount: 1,
        }));

        await InventoryReservationService.reserveStock(client, stockRequirements, {
          orderId,
          timeoutMinutes: 15,
        });
      }

      // 2. Persist dms_trade_order inside same transaction
      await client.query(
        `INSERT INTO dms_trade_order (
          id, order_number, customer_id, customer_name, customer_email, customer_phone,
          shipping_address, organization, gstin, status, payment_status, payment_method,
          subtotal_inr, gst_amount_inr, total_inr, subtotal_paise, gst_amount_paise, total_paise,
          has_quote_items, notes, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', $11,
          $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW()
        );`,
        [
          orderId,
          orderNumber,
          params.customerId,
          params.customerName,
          params.customerEmail,
          params.customerPhone,
          params.shippingAddress,
          params.organization || "Direct Customer",
          params.gstin || null,
          initialStatus,
          hasQuoteItems ? "offline_quote" : "razorpay",
          subtotalPaise / 100,
          gstAmountPaise / 100,
          totalPaise / 100,
          subtotalPaise,
          gstAmountPaise,
          totalPaise,
          hasQuoteItems,
          params.notes || null,
        ]
      );

      // 3. Persist order line items
      for (const item of params.items) {
        const itemId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await client.query(
          `INSERT INTO dms_trade_order_item (
            id, order_id, product_id, sku, name, category, quantity,
            unit_price_inr, line_total_inr, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW());`,
          [
            itemId,
            orderId,
            item.productId,
            item.sku,
            item.name,
            item.category,
            item.quantity,
            (item.unitPricePaise ?? 0) / 100,
            (item.lineTotalPaise ?? 0) / 100,
          ]
        );
      }

      await client.query("COMMIT;");
    } catch (err) {
      await client.query("ROLLBACK;");
      throw err;
    } finally {
      client.release();
    }

    // 4. Outside DB transaction: Initialize Razorpay order if payable
    let razorpayOrderId: string | undefined;
    if (!hasQuoteItems && totalPaise > 0) {
      try {
        const provider = getPaymentProvider();
        const rpOrder = await provider.createOrder({
          amountPaise: totalPaise,
          currency: "INR",
          receipt: orderNumber,
          notes: { orderId, checkoutIntentId: params.checkoutIntentId },
        });
        razorpayOrderId = rpOrder.id;

        // Update trade order with provider order ID
        await pool.query(
          `UPDATE dms_trade_order SET razorpay_order_id = $1 WHERE id = $2;`,
          [razorpayOrderId, orderId]
        );
      } catch (err) {
        // Compensating release of reservation if gateway call fails
        await InventoryReservationService.releaseOrderReservations(
          pool,
          orderId,
          "GATEWAY_INITIALIZATION_FAILED"
        );
        throw err;
      }
    }

    const canonicalOrder: CanonicalOrderDto = {
      id: orderId,
      orderNumber,
      orderType,
      customerId: params.customerId,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      organization: params.organization,
      gstin: params.gstin,
      shippingAddress: params.shippingAddress,
      status: initialStatus,
      paymentStatus: "PENDING",
      subtotalPaise,
      gstAmountPaise,
      totalPaise,
      hasQuoteItems,
      checkoutIntentId: params.checkoutIntentId,
      createdAt: new Date().toISOString(),
      items: params.items,
    };

    return {
      order: canonicalOrder,
      requiresPayment: !hasQuoteItems && totalPaise > 0,
      razorpayOrderId,
    };
  }
}
