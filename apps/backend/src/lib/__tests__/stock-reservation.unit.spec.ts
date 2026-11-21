import {
  aggregateCartLines,
  resolveAndAggregateOrderItems,
  InsufficientStockError,
  CommercialPolicyViolationError,
  CartLineReservationInput,
} from "../inventory";

describe("Inventory Aggregation and Reservation Unit Tests (BE-05, RB-04)", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Cart Line Aggregation (BE-05)", () => {
    it("aggregates multiple identical cart lines into a single stock reservation demand", () => {
      const items: CartLineReservationInput[] = [
        {
          productId: "prod_handle_1",
          sku: "SKU-H1-BLK",
          name: "Black Lever Handle",
          quantity: 5,
          packMultiplier: 1,
        },
        {
          productId: "prod_handle_1",
          sku: "SKU-H1-BLK",
          name: "Black Lever Handle",
          quantity: 6,
          packMultiplier: 1,
        },
      ];

      const aggregated = aggregateCartLines(items);

      expect(aggregated.size).toBe(1);
      const entry = Array.from(aggregated.values())[0];
      expect(entry.totalUnits).toBe(11); // 5 + 6 = 11 units
      expect(entry.lineCount).toBe(2);
    });

    it("correctly applies pack multipliers during aggregation (e.g. 2 boxes of 10 = 20 units)", () => {
      const items: CartLineReservationInput[] = [
        {
          productId: "prod_hinge_1",
          sku: "SKU-HN-SS",
          name: "SS Butt Hinge",
          quantity: 2,
          packMultiplier: 10, // 20 units
        },
        {
          productId: "prod_hinge_1",
          sku: "SKU-HN-SS",
          name: "SS Butt Hinge",
          quantity: 5,
          packMultiplier: 1, // 5 units
        },
      ];

      const aggregated = aggregateCartLines(items);

      expect(aggregated.size).toBe(1);
      const entry = Array.from(aggregated.values())[0];
      expect(entry.totalUnits).toBe(25); // 20 + 5 = 25 units
      expect(entry.lineCount).toBe(2);
    });

    it("segregates different variants of the same product into distinct demands", () => {
      const items: CartLineReservationInput[] = [
        {
          productId: "prod_handle_1",
          variantId: "var_black",
          sku: "SKU-H1-BLK",
          name: "Lever Handle (Matt Black)",
          quantity: 3,
          packMultiplier: 1,
        },
        {
          productId: "prod_handle_1",
          variantId: "var_silver",
          sku: "SKU-H1-SLV",
          name: "Lever Handle (Satin Silver)",
          quantity: 4,
          packMultiplier: 1,
        },
      ];

      const aggregated = aggregateCartLines(items);

      expect(aggregated.size).toBe(2);
      const values = Array.from(aggregated.values());
      expect(values.find((v) => v.item.variantId === "var_black")?.totalUnits).toBe(3);
      expect(values.find((v) => v.item.variantId === "var_silver")?.totalUnits).toBe(4);
    });

    it("segregates different stock locations and sellers", () => {
      const items: CartLineReservationInput[] = [
        {
          productId: "prod_1",
          sku: "SKU-1",
          quantity: 5,
          sellerId: "sai-ajantha-central",
          locationId: "sloc_trichy",
        },
        {
          productId: "prod_1",
          sku: "SKU-1",
          quantity: 5,
          sellerId: "distributor_madurai",
          locationId: "sloc_madurai",
        },
      ];

      const aggregated = aggregateCartLines(items);
      expect(aggregated.size).toBe(2);
    });
  });

  describe("Commercial Policy and Seller/Location Boundaries", () => {
    const mockContainer = (mockProduct: any) => ({
      resolve: jest.fn().mockImplementation((key: string) => {
        if (key === "query") {
          return {
            graph: jest.fn().mockImplementation(({ entity }: { entity: string }) => {
              if (entity === "product") {
                return Promise.resolve({ data: [mockProduct] });
              }
              if (entity === "stock_location") {
                return Promise.resolve({
                  data: [{ id: "sloc_01M7HKTTVP6J72Y042MEEFPT6Z" }],
                });
              }
              return Promise.resolve({ data: [] });
            }),
          };
        }
        return null;
      }),
    });

    it("rejects floor springs when floorSpringsRouteConfirmed is false", async () => {
      delete process.env.FEATURE_FLOOR_SPRINGS_CONFIRMED;

      const container = mockContainer({
        id: "prod_fs1",
        title: "Heavy Duty Floor Spring Double Cylinder",
        variants: [{ id: "var_fs1", sku: "FS-100" }],
      });

      const items: CartLineReservationInput[] = [
        {
          productId: "prod_fs1",
          name: "Heavy Duty Floor Spring Double Cylinder",
          category: "Floor Springs",
          quantity: 1,
        },
      ];

      await expect(
        resolveAndAggregateOrderItems(container as any, items)
      ).rejects.toThrow(CommercialPolicyViolationError);
    });

    it("rejects distributor online checkout when distributorOnlineCheckoutEnabled is false", async () => {
      delete process.env.FEATURE_DISTRIBUTOR_ONLINE_CHECKOUT;

      const container = mockContainer({
        id: "prod_1",
        title: "Standard Handle",
        variants: [
          {
            id: "var_1",
            sku: "HND-1",
            inventory_items: [{ inventory_item_id: "iitem_1" }],
          },
        ],
      });

      const items: CartLineReservationInput[] = [
        {
          productId: "prod_1",
          sku: "HND-1",
          name: "Standard Handle",
          category: "Handles",
          quantity: 10,
        },
      ];

      await expect(
        resolveAndAggregateOrderItems(container as any, items, {
          userRole: "DISTRIBUTOR",
          paymentMethod: "Razorpay Online Checkout",
        })
      ).rejects.toThrow(CommercialPolicyViolationError);
    });

    it("rejects unauthorized seller attempting to consume central warehouse stock", async () => {
      const container = mockContainer({
        id: "prod_1",
        title: "Standard Handle",
        variants: [
          {
            id: "var_1",
            sku: "HND-1",
            inventory_items: [{ inventory_item_id: "iitem_1" }],
          },
        ],
      });

      const items: CartLineReservationInput[] = [
        {
          productId: "prod_1",
          sku: "HND-1",
          name: "Standard Handle",
          quantity: 5,
          sellerId: "unverified_dealer_456",
          locationId: "sloc_01M7HKTTVP6J72Y042MEEFPT6Z", // Trying to consume Trichy central stock
        },
      ];

      await expect(
        resolveAndAggregateOrderItems(container as any, items)
      ).rejects.toThrow("Unauthorized seller \"unverified_dealer_456\" cannot allocate stock");
    });

    it("requires exact variantId or sku when product has multiple variants (never defaults to variants[0])", async () => {
      const container = mockContainer({
        id: "prod_multi",
        title: "Architectural Pull Handle",
        variants: [
          {
            id: "var_blk",
            sku: "PULL-BLK",
            inventory_items: [{ inventory_item_id: "iitem_blk" }],
          },
          {
            id: "var_gld",
            sku: "PULL-GLD",
            inventory_items: [{ inventory_item_id: "iitem_gld" }],
          },
        ],
      });

      // No variantId or sku passed
      const ambiguousItems: CartLineReservationInput[] = [
        {
          productId: "prod_multi",
          name: "Architectural Pull Handle",
          quantity: 2,
        },
      ];

      await expect(
        resolveAndAggregateOrderItems(container as any, ambiguousItems)
      ).rejects.toThrow("Multiple variants exist for product \"Architectural Pull Handle\"; exact variantId or sku is required");
    });

    it("resolves exact variant when variantId is specified", async () => {
      const container = mockContainer({
        id: "prod_multi",
        title: "Architectural Pull Handle",
        variants: [
          {
            id: "var_blk",
            sku: "PULL-BLK",
            inventory_items: [{ inventory_item_id: "iitem_blk" }],
          },
          {
            id: "var_gld",
            sku: "PULL-GLD",
            inventory_items: [{ inventory_item_id: "iitem_gld" }],
          },
        ],
      });

      const specificItems: CartLineReservationInput[] = [
        {
          productId: "prod_multi",
          variantId: "var_gld",
          name: "Architectural Pull Handle",
          quantity: 2,
        },
      ];

      const res = await resolveAndAggregateOrderItems(container as any, specificItems);
      expect(res.aggregatedRequirements.length).toBe(1);
      expect(res.aggregatedRequirements[0].variantId).toBe("var_gld");
      expect(res.aggregatedRequirements[0].inventoryItemId).toBe("iitem_gld");
    });

    it("aggregates multiple distinct variants into a single physical requirement when they share the exact same physical inventory item (P3.4.1 - A.1)", async () => {
      // Both variants (e.g. Finish A and Finish B) point to the same physical extrusion inventory item
      const container = mockContainer({
        id: "prod_extrusion",
        title: "Sliding Profile Extrusion",
        variants: [
          {
            id: "var_finish_silver",
            sku: "EXT-SLV",
            inventory_items: [{ inventory_item_id: "iitem_shared_extrusion" }],
          },
          {
            id: "var_finish_bronze",
            sku: "EXT-BRZ",
            inventory_items: [{ inventory_item_id: "iitem_shared_extrusion" }],
          },
        ],
      });

      const items: CartLineReservationInput[] = [
        {
          productId: "prod_extrusion",
          variantId: "var_finish_silver",
          quantity: 4,
          packMultiplier: 1,
        },
        {
          productId: "prod_extrusion",
          variantId: "var_finish_bronze",
          quantity: 7,
          packMultiplier: 1,
        },
      ];

      const res = await resolveAndAggregateOrderItems(container as any, items);
      // Both variants map to iitem_shared_extrusion, so demand must be summed to 4 + 7 = 11 units
      expect(res.aggregatedRequirements).toHaveLength(1);
      expect(res.aggregatedRequirements[0].inventoryItemId).toBe("iitem_shared_extrusion");
      expect(res.aggregatedRequirements[0].totalUnits).toBe(11);
      expect(res.aggregatedRequirements[0].lineItemsCount).toBe(2);
    });

    it("keeps separate physical requirements when variants map to distinct inventory items", async () => {
      const container = mockContainer({
        id: "prod_extrusion",
        title: "Sliding Profile Extrusion",
        variants: [
          {
            id: "var_10ft",
            sku: "EXT-10FT",
            inventory_items: [{ inventory_item_id: "iitem_ext_10ft" }],
          },
          {
            id: "var_12ft",
            sku: "EXT-12FT",
            inventory_items: [{ inventory_item_id: "iitem_ext_12ft" }],
          },
        ],
      });

      const items: CartLineReservationInput[] = [
        {
          productId: "prod_extrusion",
          variantId: "var_10ft",
          quantity: 3,
        },
        {
          productId: "prod_extrusion",
          variantId: "var_12ft",
          quantity: 5,
        },
      ];

      const res = await resolveAndAggregateOrderItems(container as any, items);
      expect(res.aggregatedRequirements).toHaveLength(2);
      expect(res.aggregatedRequirements.find((r) => r.inventoryItemId === "iitem_ext_10ft")?.totalUnits).toBe(3);
      expect(res.aggregatedRequirements.find((r) => r.inventoryItemId === "iitem_ext_12ft")?.totalUnits).toBe(5);
    });
  });
});
