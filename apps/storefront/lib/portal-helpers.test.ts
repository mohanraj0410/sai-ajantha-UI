import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeOpeningStockProgress,
  filterDealerCatalog,
  filterDistributorBuyStockCatalog,
  formatInr,
  getApprovalStatusMeta,
  getOrderStatusMeta,
  isDistributorBuyStockEligible,
  isFloorSpringProduct,
  summarizeOrders,
  type PortalOrderRecord,
} from "./portal-helpers";
import type { ProductItem } from "./products";

function makeProduct(overrides: Partial<ProductItem>): ProductItem {
  return {
    id: "p1",
    code: "SA-ALU-001",
    filename: "sample.jpg",
    name: "Aluminium 2-Track Profile",
    category: "Aluminium",
    subcategory: "2 Track",
    src: "/products/sample.jpg",
    customerPriceInr: 450,
    dealerPriceInr: 360,
    distributorPriceInr: 310,
    unitPriceInr: 360,
    billingUnit: "12 ft",
    gstRate: 0.18,
    gstMode: "Excluded",
    stockQty: 100,
    approved: true,
    sellerRoute: "SAI_AJANTHA",
    ...overrides,
  };
}

describe("portal-helpers", () => {
  it("identifies Floor Springs as Enquiry Only and excludes them from Distributor Buy Stock", () => {
    const floorSpring = makeProduct({
      id: "fs1",
      code: "SA-I-FS-TON90-007",
      name: "TON 90 Hydraulic Floor Spring",
      category: "Door Closer & Floor Spring",
      sellerRoute: "ENQUIRY_ONLY",
    });
    const doorCloser = makeProduct({
      id: "dc1",
      code: "SA-M-DC-80-002",
      name: "Heavy Duty Door Closer 80kg",
      category: "Door Closer & Floor Spring",
      sellerRoute: "DISTRIBUTOR",
    });
    const basket = makeProduct({
      id: "kb1",
      code: "SA-T-KB-001",
      name: "SS-304 Thali Kitchen Basket",
      category: "Kitchen Basket",
      sellerRoute: "DISTRIBUTOR",
    });
    const aluminium = makeProduct({ id: "al1" });

    assert.equal(isFloorSpringProduct(floorSpring), true);
    assert.equal(isDistributorBuyStockEligible(floorSpring), false);
    assert.equal(isDistributorBuyStockEligible(doorCloser), true);
    assert.equal(isDistributorBuyStockEligible(basket), true);
    assert.equal(isDistributorBuyStockEligible(aluminium), false);

    const buyStockList = filterDistributorBuyStockCatalog(
      [floorSpring, doorCloser, basket, aluminium],
      { query: "", category: "ALL" }
    );
    assert.deepEqual(
      buyStockList.map((p) => p.id),
      ["dc1", "kb1"]
    );
  });

  it("filters Dealer catalog accurately by search, category, and channel route", () => {
    const items = [
      makeProduct({ id: "al1", name: "Aluminium Track", category: "Aluminium", code: "SA-A-01" }),
      makeProduct({
        id: "dc1",
        name: "Hydraulic Door Closer",
        category: "Door Closer & Floor Spring",
        code: "SA-M-DC-80",
        sellerRoute: "DISTRIBUTOR",
      }),
      makeProduct({
        id: "fs1",
        name: "Floor Spring 110kg",
        category: "Door Closer & Floor Spring",
        code: "SA-I-FS-110",
        sellerRoute: "ENQUIRY_ONLY",
      }),
    ];

    assert.equal(
      filterDealerCatalog(items, { query: "", category: "ALL", routeFilter: "DIRECT" }).length,
      1
    );
    assert.equal(
      filterDealerCatalog(items, { query: "", category: "ALL", routeFilter: "HOUSE_OF_AJANTHA" }).length,
      1
    );
    assert.equal(
      filterDealerCatalog(items, { query: "", category: "ALL", routeFilter: "ENQUIRY_ONLY" }).length,
      1
    );
    assert.equal(
      filterDealerCatalog(items, { query: "sa-m-dc", category: "ALL", routeFilter: "ALL" })[0]?.id,
      "dc1"
    );
  });

  it("computes opening stock target progress cleanly", () => {
    const partial = computeOpeningStockProgress(150000, 300000);
    assert.equal(partial.percent, 50);
    assert.equal(partial.remainingInr, 150000);
    assert.equal(partial.meetsThreshold, false);

    const complete = computeOpeningStockProgress(350000, 300000);
    assert.equal(complete.percent, 100);
    assert.equal(complete.remainingInr, 0);
    assert.equal(complete.meetsThreshold, true);
  });

  it("formats statuses and summarizes orders without counting cancelled totals", () => {
    assert.equal(getApprovalStatusMeta("PENDING_APPROVAL").tone, "warning");
    assert.equal(getApprovalStatusMeta("SUSPENDED").tone, "danger");
    assert.equal(getOrderStatusMeta("CONFIRMED_TRADE_PO").label, "Trade PO Confirmed");
    assert.equal(formatInr(125000), "₹1,25,000");
    assert.equal(formatInr(null), "Quote on request");

    const orders: PortalOrderRecord[] = [
      {
        id: "1",
        order_number: "SA-2026-0001",
        status: "CONFIRMED_TRADE_PO",
        payment_status: "PENDING_OFFLINE_SETTLEMENT",
        payment_method: "Trade PO",
        price_tier_applied: "DEALER",
        customer_name: "Test",
        customer_email: "a@b.com",
        customer_phone: "9876543210",
        organization: "Firm",
        shipping_address: "Trichy",
        subtotal_inr: 10000,
        gst_amount_inr: 1800,
        total_inr: 11800,
        created_at: new Date().toISOString(),
        items: [],
      },
      {
        id: "2",
        order_number: "SA-2026-0002",
        status: "QUOTE_REQUESTED",
        payment_status: "PENDING",
        payment_method: "BOQ Quote",
        price_tier_applied: "CUSTOMER",
        customer_name: "Test",
        customer_email: "a@b.com",
        customer_phone: "9876543210",
        organization: "",
        shipping_address: "Trichy",
        subtotal_inr: 5000,
        gst_amount_inr: 900,
        total_inr: 5900,
        created_at: new Date().toISOString(),
        items: [],
      },
      {
        id: "3",
        order_number: "SA-2026-0003",
        status: "CANCELLED",
        payment_status: "NOT_APPLICABLE",
        payment_method: "Trade PO",
        price_tier_applied: "DEALER",
        customer_name: "Test",
        customer_email: "a@b.com",
        customer_phone: "9876543210",
        organization: "Firm",
        shipping_address: "Trichy",
        subtotal_inr: 20000,
        gst_amount_inr: 3600,
        total_inr: 23600,
        created_at: new Date().toISOString(),
        items: [],
      },
    ];

    const summary = summarizeOrders(orders);
    assert.equal(summary.totalCount, 3);
    assert.equal(summary.activeCount, 1);
    assert.equal(summary.quoteCount, 1);
    assert.equal(summary.deliveredCount, 0);
    assert.equal(summary.totalValueInr, 17700);
  });
});
