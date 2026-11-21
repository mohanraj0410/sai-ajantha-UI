import middlewaresConfig from "../../middlewares";

describe("Admin Route Middleware Security Configuration (BE-01 / ADM-01)", () => {
  it("should have a security middleware route protecting /admin/sai-ajanta and /admin/custom", () => {
    expect(middlewaresConfig).toBeDefined();
    expect(middlewaresConfig.routes).toBeDefined();

    const adminRouteMiddleware = middlewaresConfig.routes?.find((r) => {
      if (r.matcher instanceof RegExp) {
        return (
          r.matcher.test("/admin/sai-ajanta/products") &&
          r.matcher.test("/admin/sai-ajanta/orders") &&
          r.matcher.test("/admin/sai-ajanta/customers") &&
          r.matcher.test("/admin/sai-ajanta/analytics") &&
          r.matcher.test("/admin/custom")
        );
      }
      return false;
    });

    expect(adminRouteMiddleware).toBeDefined();
    expect(adminRouteMiddleware?.middlewares).toBeDefined();
    expect(adminRouteMiddleware?.middlewares?.length).toBeGreaterThanOrEqual(2);
  });

  it("should match all 12 custom admin API route paths and reject path bypasses", () => {
    const adminRouteMiddleware = middlewaresConfig.routes?.find((r) =>
      r.matcher instanceof RegExp && r.matcher.test("/admin/sai-ajanta/overview")
    );
    const matcher = adminRouteMiddleware!.matcher as RegExp;

    // All custom admin endpoints must match the guard
    const protectedPaths = [
      "/admin/custom",
      "/admin/sai-ajanta/analytics",
      "/admin/sai-ajanta/customers",
      "/admin/sai-ajanta/customers/cus_01M7",
      "/admin/sai-ajanta/enquiries/enq_01M7",
      "/admin/sai-ajanta/orders",
      "/admin/sai-ajanta/orders/ord_01M7",
      "/admin/sai-ajanta/overview",
      "/admin/sai-ajanta/portal",
      "/admin/sai-ajanta/products",
      "/admin/sai-ajanta/products/prod_01M7",
      "/admin/sai-ajanta/sync-nas",
    ];

    for (const p of protectedPaths) {
      expect(matcher.test(p)).toBe(true);
    }

    // Public / store / static paths must NOT match admin guard
    const publicPaths = [
      "/store/products",
      "/store/sai-ajanta/orders",
      "/static/catalog/images/ALM-001.jpg",
      "/health",
    ];

    for (const p of publicPaths) {
      expect(matcher.test(p)).toBe(false);
    }
  });
});
