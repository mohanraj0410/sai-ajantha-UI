import { GET as getCatalog } from "../route";

describe("Confidential Public Catalog DTOs (BE-07 / SF-01)", () => {
  const mockProducts = [
    {
      id: "prod_1",
      title: "Commercial Floor Spring Heavy",
      handle: "commercial-floor-spring-heavy",
      status: "published",
      thumbnail: "/images/fs1.jpg",
      categories: [{ id: "cat_1", name: "Door Closer & Floor Spring", handle: "floor-springs" }],
      metadata: {
        customer_price_inr: 5000,
        dealer_price_inr: 3500,
        distributor_price_inr: 2800,
        contractor_price_inr: 4200,
        supplier_cost: 1800,
        sku: "FS-HD-01",
      },
      variants: [
        {
          id: "var_1",
          prices: [{ amount: 5000, currency_code: "inr" }],
          inventory_items: [{ inventory: { location_levels: [{ stocked_quantity: 25, reserved_quantity: 0 }] } }],
        },
      ],
    },
  ];

  it("strictly redacts dealer and distributor prices from anonymous public visitors", async () => {
    const mockQuery = {
      graph: jest.fn().mockResolvedValue({ data: mockProducts }),
    };

    const req: any = {
      auth_context: undefined,
      scope: {
        resolve: jest.fn().mockReturnValue(mockQuery),
      },
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await getCatalog(req, res);

    expect(res.json).toHaveBeenCalled();
    const result = res.json.mock.calls[0][0];
    expect(result.products).toHaveLength(1);

    const product = result.products[0];
    expect(product.customerPriceInr).toBe(5000);
    // Confidential trade prices must be strictly null
    expect(product.dealerPriceInr).toBeNull();
    expect(product.distributorPriceInr).toBeNull();
    expect(product.contractorPriceInr).toBeNull();

    // Metadata must not leak trade prices or supplier costs
    expect(product.metadata.dealer_price_inr).toBeUndefined();
    expect(product.metadata.distributor_price_inr).toBeUndefined();
    expect(product.metadata.contractor_price_inr).toBeUndefined();
    expect(product.metadata.supplier_cost).toBeUndefined();
  });

  it("strictly redacts distributor prices from verified DEALER accounts", async () => {
    const mockQuery = {
      graph: jest.fn().mockResolvedValue({ data: mockProducts }),
    };

    const mockDmsService = {
      listAccountProfiles: jest.fn().mockResolvedValue([
        { customer_id: "cus_dealer", role: "DEALER", status: "ACTIVE" },
      ]),
    };

    const req: any = {
      auth_context: { actor_id: "cus_dealer", actor_type: "customer" },
      scope: {
        resolve: jest.fn((key: string) => {
          if (key === "query") return mockQuery;
          return mockDmsService;
        }),
      },
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await getCatalog(req, res);

    const result = res.json.mock.calls[0][0];
    const product = result.products[0];

    expect(product.customerPriceInr).toBe(5000);
    expect(product.dealerPriceInr).toBe(3500);
    // Dealer must NEVER see distributor price or contractor price
    expect(product.distributorPriceInr).toBeNull();
    expect(product.contractorPriceInr).toBeNull();
    expect(product.metadata.distributor_price_inr).toBeUndefined();
    expect(product.metadata.supplier_cost).toBeUndefined();
  });

  it("exposes distributor pricing only to verified DISTRIBUTOR accounts", async () => {
    const mockQuery = {
      graph: jest.fn().mockResolvedValue({ data: mockProducts }),
    };

    const mockDmsService = {
      listAccountProfiles: jest.fn().mockResolvedValue([
        { customer_id: "cus_dist", role: "DISTRIBUTOR", status: "ACTIVE" },
      ]),
    };

    const req: any = {
      auth_context: { actor_id: "cus_dist", actor_type: "customer" },
      scope: {
        resolve: jest.fn((key: string) => {
          if (key === "query") return mockQuery;
          return mockDmsService;
        }),
      },
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await getCatalog(req, res);

    const result = res.json.mock.calls[0][0];
    const product = result.products[0];

    expect(product.customerPriceInr).toBe(5000);
    expect(product.dealerPriceInr).toBe(3500);
    expect(product.distributorPriceInr).toBe(2800);
    // Supplier cost is never exposed to anyone outside backend admin
    expect(product.metadata.supplier_cost).toBeUndefined();
  });
});
