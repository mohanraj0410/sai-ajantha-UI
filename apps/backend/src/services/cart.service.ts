import { Pool, PoolClient } from "pg";
import crypto from "node:crypto";
import {
  PersistentCartDto,
  CartLineItemDto,
  CartSellerGroupDto,
  AllowedNextAction,
  AddToCartInput,
  CanonicalSellerRoute,
  DEFAULT_COMMERCIAL_FEATURE_FLAGS,
  CommercialFeatureFlags,
  validateCombinedScreenMoq,
  ScreenOrderItemAreaInput,
} from "@sai-ajanta/types";
import { assertDisposableDbConnection } from "../lib/disposable-db-guard";
import { SellerResolutionService } from "./seller-resolution.service";

const MAX_CART_LINE_QTY = 10000;

export function isInsectScreenLine(line: { sku: string; title?: string; customConfiguration?: any }): boolean {
  const sku = (line.sku || "").toUpperCase();
  if (sku.startsWith("SA-IS-") || sku.includes("-SCREEN-") || sku.includes("-IS-")) return true;
  const config = line.customConfiguration;
  if (config && typeof config === "object") {
    if (config.isInsectScreen || config.isScreenItem) return true;
    const cat = String(config.category || "").toLowerCase();
    if (cat.includes("insect") || cat.includes("screen")) return true;
  }
  const title = (line.title || "").toLowerCase();
  if (title.includes("insect screen") || title.includes("window screen") || title.includes("magnetic window") || title.includes("box frame") || title.includes("center frame")) return true;
  return false;
}

export function extractScreenDimensionsInInches(customConfig: any): { widthInches: number; heightInches: number } {
  if (!customConfig || typeof customConfig !== "object") return { widthInches: 0, heightInches: 0 };
  let w = Number(customConfig.widthInches ?? customConfig.width ?? 0);
  let h = Number(customConfig.heightInches ?? customConfig.height ?? 0);
  const unit = String(customConfig.unit || customConfig.dimensionUnit || "inches").toLowerCase();
  if (unit === "mm" || unit === "millimeter" || unit === "millimeters") {
    w = w / 25.4;
    h = h / 25.4;
  } else if (unit === "ft" || unit === "feet" || unit === "foot") {
    w = w * 12;
    h = h * 12;
  } else if (unit === "cm" || unit === "centimeter") {
    w = w / 2.54;
  }
  return {
    widthInches: Number.isFinite(w) && w > 0 ? w : 0,
    heightInches: Number.isFinite(h) && h > 0 ? h : 0,
  };
}

async function withTransaction<T>(
  poolOrClient: Pool | PoolClient,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const isPool = "totalCount" in poolOrClient || "idleCount" in poolOrClient;
  const client = isPool ? await (poolOrClient as Pool).connect() : (poolOrClient as PoolClient);

  try {
    if (isPool) await client.query("BEGIN");
    const result = await fn(client);
    if (isPool) await client.query("COMMIT");
    return result;
  } catch (err) {
    if (isPool) await client.query("ROLLBACK");
    throw err;
  } finally {
    if (isPool) (client as PoolClient).release();
  }
}

export class CartService {
  /**
   * Resolves authoritative actor role from account_profile.
   * Suspended / pending / rejected trade accounts fail closed to CUSTOMER so trade pricing never leaks.
   */
  static async resolveActorRole(
    poolOrClient: Pool | PoolClient,
    customerId?: string
  ): Promise<"CUSTOMER" | "DEALER" | "DISTRIBUTOR" | "ANONYMOUS"> {
    if (!customerId) return "ANONYMOUS";
    const isPool = "totalCount" in poolOrClient || "idleCount" in poolOrClient;
    const client = isPool ? await (poolOrClient as Pool).connect() : (poolOrClient as PoolClient);
    try {
      const profRes = await client.query(
        `SELECT role, status FROM "account_profile"
         WHERE customer_id = $1 AND deleted_at IS NULL
         LIMIT 1`,
        [customerId]
      );
      if (profRes.rows.length === 0) return "CUSTOMER";
      const { role, status } = profRes.rows[0];
      if (String(status || "").toUpperCase() !== "ACTIVE") {
        return "CUSTOMER";
      }
      const upperRole = String(role || "").toUpperCase();
      if (upperRole === "DEALER" || upperRole === "DISTRIBUTOR") {
        return upperRole;
      }
      return "CUSTOMER";
    } finally {
      if (isPool) (client as PoolClient).release();
    }
  }

  /**
   * P8.3 Security: Enforces strict cart ownership before read or mutation.
   * Rejects forged cart IDs, cross-customer access, and unauthenticated access to owned guest carts.
   */
  static async assertCartOwnership(
    poolOrClient: Pool | PoolClient,
    cartId: string,
    caller: { customerId?: string; sessionToken?: string }
  ): Promise<{ id: string; session_token: string | null; customer_id: string | null; postal_code: string | null }> {
    const isPool = "totalCount" in poolOrClient || "idleCount" in poolOrClient;
    const client = isPool ? await (poolOrClient as Pool).connect() : (poolOrClient as PoolClient);
    try {
      const res = await client.query(
        `SELECT id, session_token, customer_id, postal_code
         FROM "dms_cart"
         WHERE id = $1 AND deleted_at IS NULL
         LIMIT 1`,
        [cartId]
      );
      if (res.rows.length === 0) {
        const err: any = new Error(`Cart '${cartId}' not found.`);
        err.code = "CART_NOT_FOUND";
        err.statusCode = 404;
        throw err;
      }

      const cart = res.rows[0];
      if (cart.customer_id) {
        if (!caller.customerId || caller.customerId !== cart.customer_id) {
          const err: any = new Error("Forbidden: Cart belongs to a different customer account.");
          err.code = "FORBIDDEN_CART_ACCESS";
          err.statusCode = 403;
          throw err;
        }
      } else if (cart.session_token) {
        if (!caller.sessionToken || caller.sessionToken !== cart.session_token) {
          const err: any = new Error("Forbidden: Valid guest session token required for this cart.");
          err.code = "FORBIDDEN_CART_ACCESS";
          err.statusCode = 403;
          throw err;
        }
      }

      return cart;
    } finally {
      if (isPool) (client as PoolClient).release();
    }
  }

  /**
   * P8.3: Finds or creates an active persistent cart for a guest session token or authenticated customer.
   */
  static async getOrCreateCart(
    poolOrClient: Pool | PoolClient,
    input: {
      sessionToken?: string;
      customerId?: string;
      postalCode?: string;
    }
  ): Promise<{ id: string; sessionToken?: string; customerId?: string; postalCode?: string }> {
    const isPool = "totalCount" in poolOrClient || "idleCount" in poolOrClient;
    const client = isPool ? await (poolOrClient as Pool).connect() : (poolOrClient as PoolClient);

    try {
      await assertDisposableDbConnection(client);

      // 1. Look up existing active cart by customer ID if authenticated
      if (input.customerId) {
        const custCartRes = await client.query(
          `SELECT id, session_token, customer_id, postal_code
           FROM "dms_cart"
           WHERE customer_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
           ORDER BY updated_at DESC LIMIT 1`,
          [input.customerId]
        );
        if (custCartRes.rows.length > 0) {
          const c = custCartRes.rows[0];
          return {
            id: c.id,
            sessionToken: c.session_token || undefined,
            customerId: c.customer_id,
            postalCode: c.postal_code || undefined,
          };
        }
      }

      // 2. Look up existing active cart by guest session token
      if (input.sessionToken) {
        const sessCartRes = await client.query(
          `SELECT id, session_token, customer_id, postal_code
           FROM "dms_cart"
           WHERE session_token = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
           ORDER BY updated_at DESC LIMIT 1`,
          [input.sessionToken]
        );
        if (sessCartRes.rows.length > 0) {
          const c = sessCartRes.rows[0];
          return {
            id: c.id,
            sessionToken: c.session_token,
            customerId: c.customer_id || undefined,
            postalCode: c.postal_code || undefined,
          };
        }
      }

      // 3. Create a new cart
      const cartId = `cart_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      const sessToken = input.sessionToken || `gst_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;

      await client.query(
        `INSERT INTO "dms_cart" (id, session_token, customer_id, postal_code, status, currency_code)
         VALUES ($1, $2, $3, $4, 'ACTIVE', 'INR')`,
        [cartId, input.customerId ? null : sessToken, input.customerId || null, input.postalCode || null]
      );

      return {
        id: cartId,
        sessionToken: input.customerId ? undefined : sessToken,
        customerId: input.customerId,
        postalCode: input.postalCode,
      };
    } finally {
      if (isPool) (client as PoolClient).release();
    }
  }

  /**
   * P8.3 & P8.4: Fetches cart with full lines and seller decomposition groups.
   */
  static async getCartWithDetails(
    poolOrClient: Pool | PoolClient,
    cartId: string,
    options: {
      actorRole?: "CUSTOMER" | "DEALER" | "DISTRIBUTOR" | "ANONYMOUS";
      flags?: CommercialFeatureFlags;
    } = {}
  ): Promise<PersistentCartDto> {
    const isPool = "totalCount" in poolOrClient || "idleCount" in poolOrClient;
    const client = isPool ? await (poolOrClient as Pool).connect() : (poolOrClient as PoolClient);

    try {
      await assertDisposableDbConnection(client);

      const cartRes = await client.query(
        `SELECT id, session_token, customer_id, postal_code, status, currency_code, created_at, updated_at
         FROM "dms_cart"
         WHERE id = $1 AND deleted_at IS NULL`,
        [cartId]
      );

      if (cartRes.rows.length === 0) {
        const err: any = new Error(`Cart '${cartId}' not found.`);
        err.code = "CART_NOT_FOUND";
        err.statusCode = 404;
        throw err;
      }

      const cart = cartRes.rows[0];

      // Fetch active lines
      const linesRes = await client.query(
        `SELECT id, cart_id, product_id, variant_id, sku, title, quantity,
                seller_route, seller_id, seller_name, warehouse_id, is_quote_only,
                unit_price_paise, total_price_paise, tax_rate_percent, custom_configuration,
                created_at, updated_at
         FROM "dms_cart_line"
         WHERE cart_id = $1 AND deleted_at IS NULL
         ORDER BY created_at ASC`,
        [cartId]
      );

      const lines: CartLineItemDto[] = linesRes.rows.map((r) => ({
        id: r.id,
        cartId: r.cart_id,
        productId: r.product_id,
        variantId: r.variant_id || undefined,
        sku: r.sku,
        title: r.title,
        quantity: r.quantity,
        sellerRoute: r.seller_route as CanonicalSellerRoute,
        sellerId: r.seller_id,
        sellerName: r.seller_name,
        warehouseId: r.warehouse_id,
        isQuoteOnly: r.is_quote_only,
        unitPricePaise: r.unit_price_paise,
        totalPricePaise: r.total_price_paise,
        taxRatePercent: r.tax_rate_percent ? Number(r.tax_rate_percent) : null,
        customConfiguration: r.custom_configuration,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
      }));

      // P8.4: Decompose lines into independent seller groups
      const groupMap = new Map<string, CartSellerGroupDto>();

      for (const line of lines) {
        const groupKey = `${line.sellerId}__${line.sellerRoute}__${line.warehouseId}`;
        let group = groupMap.get(groupKey);

        if (!group) {
          const isDirect = line.sellerRoute === "SAI_AJANTHA_DIRECT";
          const isResale = line.sellerRoute === "DISTRIBUTOR_RESALE";

          let nextAction: AllowedNextAction = "REQUEST_QUOTE";
          let canCheckout = false;
          let reason = "";

          if (isDirect) {
            nextAction = line.isQuoteOnly ? "REQUEST_QUOTE" : "READY_FOR_TEST_CHECKOUT";
            canCheckout = !line.isQuoteOnly;
            reason = line.isQuoteOnly
              ? "Contains items requiring quotation verification"
              : "Eligible for test checkout intent (live payments disabled per DEC-002)";
          } else if (isResale) {
            nextAction = "REQUEST_QUOTE";
            canCheckout = false;
            reason = "Regional distributor resale online checkout disabled per DEC-002: quotation only";
          } else {
            nextAction = "REQUEST_QUOTE";
            canCheckout = false;
            reason = "Hydraulic Floor Springs / custom items require formal BOQ quotation";
          }

          group = {
            groupKey,
            sellerId: line.sellerId,
            sellerName: line.sellerName,
            sellerRoute: line.sellerRoute,
            warehouseId: line.warehouseId,
            currency: cart.currency_code,
            fulfilmentPolicy: isDirect ? "CENTRAL_WAREHOUSE_DIRECT" : "DISTRIBUTOR_RESALE_TERRITORY",
            items: [],
            itemCount: 0,
            subtotalPaise: 0,
            gstAmountPaise: 0,
            totalPaise: 0,
            isQuoteOnly: line.isQuoteOnly,
            checkoutEligibility: {
              canCheckout,
              nextAction,
              reason,
            },
          };
          groupMap.set(groupKey, group);
        }

        group.items.push(line);
        group.itemCount += line.quantity;
        const lineTotal = line.totalPricePaise || 0;
        group.subtotalPaise += lineTotal;
        // Safety Rule 6: NEVER invent a synthetic 18% GST default when taxRatePercent is null/unverified.
        const hasVerifiedTax = line.taxRatePercent !== null && line.taxRatePercent !== undefined;
        const lineTax = hasVerifiedTax ? Math.round(lineTotal * (Number(line.taxRatePercent) / 100)) : 0;
        group.gstAmountPaise += lineTax;
        group.totalPaise += lineTotal + lineTax;
        if (line.isQuoteOnly || !hasVerifiedTax || line.unitPricePaise === null || line.unitPricePaise <= 0) {
          group.isQuoteOnly = true;
          group.checkoutEligibility.canCheckout = false;
          group.checkoutEligibility.nextAction = "REQUEST_QUOTE";
          if (!hasVerifiedTax && line.sellerRoute === "SAI_AJANTHA_DIRECT") {
            group.checkoutEligibility.reason = "Unverified GST/tax rate requires formal quotation before payment";
          }
        }
      }

      // DEC-004 & B4: Check Finished Frame Insect Screen combined 50 sq.ft MOQ across eligible cart lines
      for (const group of groupMap.values()) {
        const screenLines = group.items.filter((l) => isInsectScreenLine(l));
        if (screenLines.length > 0) {
          const areaInputs: ScreenOrderItemAreaInput[] = screenLines.map((l) => {
            const dims = extractScreenDimensionsInInches(l.customConfiguration);
            return {
              widthInches: dims.widthInches,
              heightInches: dims.heightInches,
              quantity: l.quantity,
            };
          });
          const moqResult = validateCombinedScreenMoq(areaInputs);
          (group as any).screenAreaSummary = moqResult;

          if (!moqResult.isValid) {
            group.checkoutEligibility.canCheckout = false;
            group.checkoutEligibility.nextAction = "REQUEST_QUOTE";
            group.checkoutEligibility.reason = `Combined Finished Frame Insect Screen area (${moqResult.totalAreaSqFt.toFixed(2)} sq.ft) is below the 50.00 sq.ft minimum order threshold (shortfall: ${moqResult.shortfallSqFt.toFixed(2)} sq.ft). Request a quote or increase opening measurements / quantity.`;
          }
        }
      }

      const groups = Array.from(groupMap.values());
      const totalItemCount = lines.reduce((acc, l) => acc + l.quantity, 0);
      const isMixedSeller = groups.length > 1;

      return {
        id: cart.id,
        sessionToken: cart.session_token || undefined,
        customerId: cart.customer_id || undefined,
        postalCode: cart.postal_code || undefined,
        status: cart.status,
        currencyCode: cart.currency_code,
        groups,
        lines,
        totalItemCount,
        isMixedSeller,
        createdAt: cart.created_at.toISOString(),
        updatedAt: cart.updated_at.toISOString(),
      };
    } finally {
      if (isPool) (client as PoolClient).release();
    }
  }

  /**
   * P8.3: Adds an item to the cart with server-authoritative seller and price resolution.
   */
  static async addItem(
    poolOrClient: Pool | PoolClient,
    cartId: string,
    input: AddToCartInput,
    options: {
      actorRole?: "CUSTOMER" | "DEALER" | "DISTRIBUTOR" | "ANONYMOUS";
      actorId?: string;
      flags?: CommercialFeatureFlags;
    } = {}
  ): Promise<PersistentCartDto> {
    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);

      if (!Number.isInteger(input.quantity) || input.quantity <= 0 || input.quantity > MAX_CART_LINE_QTY) {
        const err: any = new Error(`Quantity must be a positive integer between 1 and ${MAX_CART_LINE_QTY}.`);
        err.code = "VALIDATION_FAILED";
        err.statusCode = 400;
        throw err;
      }

      // 1. Verify cart exists and fetch postal code
      const cartRes = await client.query(
        `SELECT id, postal_code, customer_id FROM "dms_cart" WHERE id = $1 AND deleted_at IS NULL`,
        [cartId]
      );
      if (cartRes.rows.length === 0) {
        const err: any = new Error(`Cart '${cartId}' not found.`);
        err.code = "CART_NOT_FOUND";
        err.statusCode = 404;
        throw err;
      }

      const cartRow = cartRes.rows[0];
      const postalCode = input.postalCode || cartRow.postal_code || undefined;
      const actorId = options.actorId || cartRow.customer_id || undefined;
      if (input.postalCode && input.postalCode !== cartRow.postal_code) {
        await client.query(
          `UPDATE "dms_cart" SET postal_code = $1, updated_at = now() WHERE id = $2`,
          [input.postalCode, cartId]
        );
      }

      // 2. Authoritative Server-Side Seller Resolution
      const resolution = await SellerResolutionService.resolveCanonicalSeller(client, {
        sku: input.sku,
        postalCode,
        actorRole: options.actorRole,
        actorId,
        flags: options.flags,
      });

      const unitPricePaise = resolution.unitPricePaise;
      const taxRatePercent = resolution.taxRatePercent;
      const skuUpper = input.sku.toUpperCase();

      // 3. Upsert line item atomically
      const lineId = `line_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      const existingLineRes = await client.query(
        `SELECT id, quantity FROM "dms_cart_line" 
         WHERE cart_id = $1 AND UPPER(sku) = $2 AND deleted_at IS NULL`,
        [cartId, skuUpper]
      );

      if (existingLineRes.rows.length > 0) {
        const newQty = existingLineRes.rows[0].quantity + input.quantity;
        if (newQty > MAX_CART_LINE_QTY) {
          const err: any = new Error(`Line quantity cannot exceed ${MAX_CART_LINE_QTY}.`);
          err.code = "VALIDATION_FAILED";
          err.statusCode = 400;
          throw err;
        }
        const totalPaise = unitPricePaise !== null ? unitPricePaise * newQty : null;

        await client.query(
          `UPDATE "dms_cart_line" 
           SET quantity = $1,
               seller_route = $2,
               seller_id = $3,
               seller_name = $4,
               warehouse_id = $5,
               is_quote_only = $6,
               unit_price_paise = $7,
               total_price_paise = $8,
               tax_rate_percent = $9,
               custom_configuration = $10,
               updated_at = now()
           WHERE id = $11`,
          [
            newQty,
            resolution.resolvedRoute,
            resolution.sellerId,
            resolution.sellerName,
            resolution.warehouseId,
            resolution.isQuoteOnly,
            unitPricePaise,
            totalPaise,
            taxRatePercent,
            input.customConfiguration ? JSON.stringify(input.customConfiguration) : null,
            existingLineRes.rows[0].id,
          ]
        );
      } else {
        const totalPaise = unitPricePaise !== null ? unitPricePaise * input.quantity : null;
        await client.query(
          `INSERT INTO "dms_cart_line" (
            id, cart_id, sku, title, quantity, seller_route, seller_id, seller_name, warehouse_id,
            is_quote_only, unit_price_paise, total_price_paise, tax_rate_percent, custom_configuration
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            lineId,
            cartId,
            skuUpper,
            resolution.title,
            input.quantity,
            resolution.resolvedRoute,
            resolution.sellerId,
            resolution.sellerName,
            resolution.warehouseId,
            resolution.isQuoteOnly,
            unitPricePaise,
            totalPaise,
            taxRatePercent,
            input.customConfiguration ? JSON.stringify(input.customConfiguration) : null,
          ]
        );
      }

      await client.query(`UPDATE "dms_cart" SET updated_at = now() WHERE id = $1`, [cartId]);
      return CartService.getCartWithDetails(client, cartId, options);
    });
  }

  /**
   * P8.3: Updates quantity of an existing cart line item.
   */
  static async updateLineQuantity(
    poolOrClient: Pool | PoolClient,
    cartId: string,
    lineId: string,
    quantity: number,
    options: {
      actorRole?: "CUSTOMER" | "DEALER" | "DISTRIBUTOR" | "ANONYMOUS";
      flags?: CommercialFeatureFlags;
    } = {}
  ): Promise<PersistentCartDto> {
    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);

      if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_CART_LINE_QTY) {
        const err: any = new Error(`Quantity must be an integer between 0 and ${MAX_CART_LINE_QTY}.`);
        err.code = "VALIDATION_FAILED";
        err.statusCode = 400;
        throw err;
      }

      if (quantity <= 0) {
        await client.query(
          `UPDATE "dms_cart_line" SET deleted_at = now(), updated_at = now()
           WHERE id = $1 AND cart_id = $2`,
          [lineId, cartId]
        );
      } else {
        await client.query(
          `UPDATE "dms_cart_line" 
           SET quantity = $1,
               total_price_paise = CASE WHEN unit_price_paise IS NOT NULL THEN unit_price_paise * $1 ELSE NULL END,
               updated_at = now()
           WHERE id = $2 AND cart_id = $3 AND deleted_at IS NULL`,
          [quantity, lineId, cartId]
        );
      }

      await client.query(`UPDATE "dms_cart" SET updated_at = now() WHERE id = $1`, [cartId]);
      return CartService.getCartWithDetails(client, cartId, options);
    });
  }

  /**
   * P8.3: Removes a line item from the cart.
   */
  static async removeLine(
    poolOrClient: Pool | PoolClient,
    cartId: string,
    lineId: string,
    options: {
      actorRole?: "CUSTOMER" | "DEALER" | "DISTRIBUTOR" | "ANONYMOUS";
      flags?: CommercialFeatureFlags;
    } = {}
  ): Promise<PersistentCartDto> {
    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);
      await client.query(
        `UPDATE "dms_cart_line" SET deleted_at = now(), updated_at = now()
         WHERE id = $1 AND cart_id = $2`,
        [lineId, cartId]
      );
      await client.query(`UPDATE "dms_cart" SET updated_at = now() WHERE id = $1`, [cartId]);
      return CartService.getCartWithDetails(client, cartId, options);
    });
  }

  /**
   * P8.3: Updates delivery postal code and re-resolves all items in the cart.
   */
  static async updatePostalCode(
    poolOrClient: Pool | PoolClient,
    cartId: string,
    postalCode: string,
    options: {
      actorRole?: "CUSTOMER" | "DEALER" | "DISTRIBUTOR" | "ANONYMOUS";
      actorId?: string;
      flags?: CommercialFeatureFlags;
    } = {}
  ): Promise<PersistentCartDto> {
    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);

      const cartRes = await client.query(
        `SELECT id, customer_id FROM "dms_cart" WHERE id = $1 AND deleted_at IS NULL`,
        [cartId]
      );
      const actorId = options.actorId || cartRes.rows[0]?.customer_id || undefined;

      const pin = (postalCode || "").trim();
      await client.query(
        `UPDATE "dms_cart" SET postal_code = $1, updated_at = now() WHERE id = $2`,
        [pin, cartId]
      );

      // Re-resolve all lines under the new postal code
      const linesRes = await client.query(
        `SELECT id, sku, quantity, custom_configuration FROM "dms_cart_line" WHERE cart_id = $1 AND deleted_at IS NULL`,
        [cartId]
      );

      for (const line of linesRes.rows) {
        const resolution = await SellerResolutionService.resolveCanonicalSeller(client, {
          sku: line.sku,
          postalCode: pin,
          actorRole: options.actorRole,
          actorId,
          flags: options.flags,
        });

        const unitPrice = resolution.unitPricePaise;
        const totalPaise = unitPrice !== null ? unitPrice * line.quantity : null;

        await client.query(
          `UPDATE "dms_cart_line"
           SET seller_route = $1,
               seller_id = $2,
               seller_name = $3,
               warehouse_id = $4,
               is_quote_only = $5,
               unit_price_paise = $6,
               total_price_paise = $7,
               tax_rate_percent = $8,
               updated_at = now()
           WHERE id = $9`,
          [
            resolution.resolvedRoute,
            resolution.sellerId,
            resolution.sellerName,
            resolution.warehouseId,
            resolution.isQuoteOnly,
            unitPrice,
            totalPaise,
            resolution.taxRatePercent,
            line.id,
          ]
        );
      }

      return CartService.getCartWithDetails(client, cartId, options);
    });
  }

  /**
   * P8.3: Idempotent Guest-to-Customer Cart Merge on Login / Registration.
   */
  static async mergeGuestCart(
    poolOrClient: Pool | PoolClient,
    input: {
      guestSessionToken: string;
      customerId: string;
      actorRole?: "CUSTOMER" | "DEALER" | "DISTRIBUTOR" | "ANONYMOUS";
      flags?: CommercialFeatureFlags;
    }
  ): Promise<PersistentCartDto> {
    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);

      // 1. Find guest cart
      const guestRes = await client.query(
        `SELECT id, postal_code FROM "dms_cart" 
         WHERE session_token = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`,
        [input.guestSessionToken]
      );

      // If no guest cart, just return customer cart or create one
      if (guestRes.rows.length === 0) {
        const targetCart = await CartService.getOrCreateCart(client, { customerId: input.customerId });
        return CartService.getCartWithDetails(client, targetCart.id, input);
      }

      const guestCart = guestRes.rows[0];

      // 2. Find or create customer cart
      let customerCart: { id: string; postal_code?: string };
      const custRes = await client.query(
        `SELECT id, postal_code FROM "dms_cart" 
         WHERE customer_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
         ORDER BY updated_at DESC LIMIT 1`,
        [input.customerId]
      );

      if (custRes.rows.length > 0) {
        customerCart = custRes.rows[0];
      } else {
        const created = await CartService.getOrCreateCart(client, {
          customerId: input.customerId,
          postalCode: guestCart.postal_code || undefined,
        });
        customerCart = { id: created.id, postal_code: created.postalCode };
      }

      // If guest cart and customer cart are the exact same cart, no merge needed
      if (guestCart.id === customerCart.id) {
        return CartService.getCartWithDetails(client, customerCart.id, input);
      }

      // 3. Merge lines from guest cart into customer cart
      const guestLines = await client.query(
        `SELECT * FROM "dms_cart_line" WHERE cart_id = $1 AND deleted_at IS NULL`,
        [guestCart.id]
      );

      for (const gLine of guestLines.rows) {
        const custLineRes = await client.query(
          `SELECT id, quantity FROM "dms_cart_line" 
           WHERE cart_id = $1 AND UPPER(sku) = $2 AND deleted_at IS NULL`,
          [customerCart.id, gLine.sku.toUpperCase()]
        );

        if (custLineRes.rows.length > 0) {
          // Merge quantities
          const newQty = custLineRes.rows[0].quantity + gLine.quantity;
          await client.query(
            `UPDATE "dms_cart_line" SET quantity = $1, updated_at = now() WHERE id = $2`,
            [newQty, custLineRes.rows[0].id]
          );
        } else {
          // Insert line into customer cart
          const newLineId = `line_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
          await client.query(
            `INSERT INTO "dms_cart_line" (
              id, cart_id, sku, title, quantity, seller_route, seller_id, seller_name, warehouse_id,
              is_quote_only, unit_price_paise, total_price_paise, tax_rate_percent, custom_configuration
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              newLineId,
              customerCart.id,
              gLine.sku,
              gLine.title,
              gLine.quantity,
              gLine.seller_route,
              gLine.seller_id,
              gLine.seller_name,
              gLine.warehouse_id,
              gLine.is_quote_only,
              gLine.unit_price_paise,
              gLine.total_price_paise,
              gLine.tax_rate_percent,
              gLine.custom_configuration,
            ]
          );
        }
      }

      // Mark guest cart as merged and retire it
      await client.query(
        `UPDATE "dms_cart" SET status = 'MERGED', deleted_at = now(), updated_at = now() WHERE id = $1`,
        [guestCart.id]
      );

      // Re-resolve all lines under customer's trade tier and postal code (even if no PIN is set)
      const effectivePin = customerCart.postal_code || guestCart.postal_code || undefined;
      if (effectivePin && effectivePin !== customerCart.postal_code) {
        await client.query(
          `UPDATE "dms_cart" SET postal_code = $1, updated_at = now() WHERE id = $2`,
          [effectivePin, customerCart.id]
        );
      }

      const mergedLinesRes = await client.query(
        `SELECT id, sku, quantity FROM "dms_cart_line" WHERE cart_id = $1 AND deleted_at IS NULL`,
        [customerCart.id]
      );
      for (const mLine of mergedLinesRes.rows) {
        const resolution = await SellerResolutionService.resolveCanonicalSeller(client, {
          sku: mLine.sku,
          postalCode: effectivePin,
          actorRole: input.actorRole,
          flags: input.flags,
        });
        const unitPrice = resolution.unitPricePaise;
        const totalPaise = unitPrice !== null ? unitPrice * mLine.quantity : null;
        await client.query(
          `UPDATE "dms_cart_line"
           SET seller_route = $1,
               seller_id = $2,
               seller_name = $3,
               warehouse_id = $4,
               is_quote_only = $5,
               unit_price_paise = $6,
               total_price_paise = $7,
               tax_rate_percent = $8,
               updated_at = now()
           WHERE id = $9`,
          [
            resolution.resolvedRoute,
            resolution.sellerId,
            resolution.sellerName,
            resolution.warehouseId,
            resolution.isQuoteOnly,
            unitPrice,
            totalPaise,
            resolution.taxRatePercent,
            mLine.id,
          ]
        );
      }

      return CartService.getCartWithDetails(client, customerCart.id, input);
    });
  }

  /**
   * P8.4: Mixed-Seller Checkout Intent Scaffold.
   * Separates Direct items (test intent) from Distributor Resale (quote only).
   */
  static async createMixedSellerCheckoutIntent(
    poolOrClient: Pool | PoolClient,
    cartId: string,
    customer: { customerId?: string; customerEmail: string; idempotencyKey?: string }
  ): Promise<{
    correlationId: string;
    directGroup?: { orderDraftId: string; totalPaise: number };
    distributorGroups: { sellerId: string; quoteNumber: string }[];
    status: string;
    isReplay?: boolean;
  }> {
    return withTransaction(poolOrClient, async (client) => {
      await assertDisposableDbConnection(client);

      const idemScope = customer.customerId || `guest_cart:${cartId}`;
      const idemOp = "CREATE_MIXED_SELLER_CHECKOUT_INTENT";
      const fingerprint = crypto
        .createHash("sha256")
        .update(JSON.stringify({ cartId, customerEmail: customer.customerEmail.toLowerCase() }))
        .digest("hex");

      if (customer.idempotencyKey) {
        const existingIdem = await client.query(
          `SELECT fingerprint, status, response_body
           FROM "dms_idempotency_key"
           WHERE actor_or_scope = $1 AND operation = $2 AND idempotency_key = $3 AND deleted_at IS NULL
           FOR UPDATE`,
          [idemScope, idemOp, customer.idempotencyKey]
        );
        if (existingIdem.rows.length > 0) {
          const row = existingIdem.rows[0];
          if (row.fingerprint !== fingerprint) {
            const err: any = new Error("Idempotency key reused with a different checkout payload.");
            err.code = "IDEMPOTENCY_CONFLICT";
            err.statusCode = 409;
            throw err;
          }
          if (row.status === "COMPLETED" && row.response_body) {
            return { ...row.response_body, isReplay: true };
          }
        }
      }

      const cart = await CartService.getCartWithDetails(client, cartId);
      if (cart.lines.length === 0) {
        const err: any = new Error("Cannot checkout an empty cart.");
        err.code = "EMPTY_CART";
        err.statusCode = 400;
        throw err;
      }

      // DEC-004 & B4: Reject checkout intent if cart contains Finished Frame Insect Screen lines below 50.00 sq.ft MOQ
      const allScreenLines = cart.lines.filter((l) => isInsectScreenLine(l));
      if (allScreenLines.length > 0) {
        const areaInputs = allScreenLines.map((l) => {
          const dims = extractScreenDimensionsInInches(l.customConfiguration);
          return { widthInches: dims.widthInches, heightInches: dims.heightInches, quantity: l.quantity };
        });
        const moq = validateCombinedScreenMoq(areaInputs);
        if (!moq.isValid) {
          const err: any = new Error(
            `Finished Frame Insect Screen minimum combined area of 50.00 sq.ft not met (current: ${moq.totalAreaSqFt.toFixed(2)} sq.ft, shortfall: ${moq.shortfallSqFt.toFixed(2)} sq.ft).`
          );
          err.code = "SCREEN_MOQ_NOT_MET";
          err.statusCode = 400;
          throw err;
        }
      }

      const correlationId = `CORR-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const distributorGroups: { sellerId: string; quoteNumber: string }[] = [];
      let directGroup: { orderDraftId: string; totalPaise: number } | undefined;

      for (const group of cart.groups) {
        if (
          group.sellerRoute === "SAI_AJANTHA_DIRECT" &&
          !group.isQuoteOnly &&
          group.checkoutEligibility.canCheckout
        ) {
          const directScreenLines = group.items.filter((l) => isInsectScreenLine(l));
          if (directScreenLines.length > 0) {
            const areaInputs = directScreenLines.map((l) => {
              const dims = extractScreenDimensionsInInches(l.customConfiguration);
              return { widthInches: dims.widthInches, heightInches: dims.heightInches, quantity: l.quantity };
            });
            const moq = validateCombinedScreenMoq(areaInputs);
            if (!moq.isValid) {
              const err: any = new Error(
                `Finished Frame Insect Screen minimum combined area of 50.00 sq.ft not met (current: ${moq.totalAreaSqFt.toFixed(2)} sq.ft, shortfall: ${moq.shortfallSqFt.toFixed(2)} sq.ft).`
              );
              err.code = "SCREEN_MOQ_NOT_MET";
              err.statusCode = 400;
              throw err;
            }
          }
          // Direct Central Warehouse order draft (DEC-002: live payment disabled)
          const draftId = `draft_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
          directGroup = {
            orderDraftId: draftId,
            totalPaise: group.totalPaise,
          };
        } else {
          // Distributor Resale, Floor Springs, or Quote-Only Direct items -> Creates Quote Request ONLY (DEC-002)
          const quoteNumber = `RSQ-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
          distributorGroups.push({
            sellerId: group.sellerId,
            quoteNumber,
          });
        }
      }

      // Persist mixed-seller intent correlation
      await client.query(
        `INSERT INTO "dms_mixed_seller_checkout_intent" 
         (id, cart_id, correlation_id, customer_id, customer_email, groups, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT')`,
        [
          `msci_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
          cartId,
          correlationId,
          customer.customerId || null,
          customer.customerEmail,
          JSON.stringify(cart.groups),
        ]
      );

      const responsePayload = {
        correlationId,
        directGroup,
        distributorGroups,
        status: "INTENT_CREATED",
      };

      if (customer.idempotencyKey) {
        await client.query(
          `INSERT INTO "dms_idempotency_key"
           (id, idempotency_key, actor_or_scope, operation, fingerprint, status, response_status, response_body, expires_at)
           VALUES ($1, $2, $3, $4, $5, 'COMPLETED', 201, $6, now() + interval '24 hours')
           ON CONFLICT (actor_or_scope, operation, idempotency_key) WHERE deleted_at IS NULL
           DO UPDATE SET status = 'COMPLETED', response_status = 201, response_body = EXCLUDED.response_body, updated_at = now()`,
          [
            `idem_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
            customer.idempotencyKey,
            idemScope,
            idemOp,
            fingerprint,
            JSON.stringify(responsePayload),
          ]
        );
      }

      return responsePayload;
    });
  }
}
