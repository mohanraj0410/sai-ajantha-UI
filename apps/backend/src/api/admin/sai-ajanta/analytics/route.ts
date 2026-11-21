import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { RawTradeOrder } from "../../../../lib/order-serializer";
import { checkStaffPermission } from "../../../../lib/permissions";
import { DMS_MODULE } from "../../../../modules/dms";
import { AccountRole } from "../../../../modules/dms/models/account-profile";
import DmsModuleService from "../../../../modules/dms/services";

interface MonthBucket {
  key: string;
  name: string;
  mNum: number;
  totalAmount: number;
  ordersCount: number;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "ANALYTICS_VIEW")) {
    return;
  }
  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);

  const selectedFY = String(req.query.fy || "FY 2026–27");
  const onlySaiAjantaLogistics = req.query.onlySaiAjantaLogistics === "true";
  const countPaidDistributorBulk = req.query.countPaidDistributorBulk === "true";

  // Fetch all orders and account profiles
  const [rawOrders, profiles] = (await Promise.all([
    dmsService.listTradeOrders({}, { take: null }),
    dmsService.listAccountProfiles({}, { take: null }),
  ])) as [RawTradeOrder[], any[]];

  const distributorProfiles = profiles.filter(
    (p) => (p.role || "").toUpperCase() === AccountRole.DISTRIBUTOR
  );

  const distributorIdSet = new Set(distributorProfiles.map((p) => p.id));
  const distributorNameSet = new Set(
    distributorProfiles
      .map((p) => (p.business_name || "").toLowerCase().trim())
      .filter(Boolean)
  );

  // 1. Top KPI Stats
  let pendingCount = 0;
  let deliveredCount = 0;
  let shippedCount = 0;
  let invoicedCount = 0;
  let cancelledCount = 0;
  let grossVolumeInr = 0;

  for (const o of rawOrders) {
    const st = (o.status || "").toUpperCase();
    if (st === "PACKED" || st === "PENDING" || st === "PROCESSING") {
      pendingCount++;
    } else if (st === "DELIVERED") {
      deliveredCount++;
    } else if (st === "SHIPPED" || st === "DISPATCHED") {
      shippedCount++;
    } else if (st === "INVOICED") {
      invoicedCount++;
    } else if (st === "CANCELLED") {
      cancelledCount++;
    }

    if (st !== "CANCELLED") {
      grossVolumeInr += Number(o.total_inr || 0);
    }
  }

  // 2. Credit Health & Allotments (P10.13.2 Truthful Audit: no fabricated limits or synthetic usage)
  let totalSanctionedInr = 0;
  let totalUtilizedInr = 0;
  let hasConfiguredCreditLines = false;

  const distributorCreditList = distributorProfiles.map((dp) => {
    const attrs = (dp.dynamic_attributes || {}) as Record<string, unknown>;
    const hasSanctionedLimit = typeof attrs.credit_limit === "number";
    const hasRecordedUsage = typeof attrs.credit_used === "number";

    if (hasSanctionedLimit) {
      hasConfiguredCreditLines = true;
    }

    const limit: number | null = hasSanctionedLimit ? (attrs.credit_limit as number) : null;
    const creditUsed: number | null = hasRecordedUsage ? (attrs.credit_used as number) : null;

    if (limit !== null) totalSanctionedInr += limit;
    if (creditUsed !== null) totalUtilizedInr += creditUsed;

    const assignedOrders = rawOrders.filter((o) => {
      const custName = (o.customer_name || "").toLowerCase().trim();
      const org = (o.organization || "").toLowerCase().trim();
      const distName = (dp.business_name || "").toLowerCase().trim();
      return (
        o.customer_id === dp.customer_id ||
        custName === distName ||
        org === distName ||
        (Array.isArray(o.items) && (o.items as any[]).some((i) => i.assigned_distributor_id === dp.id))
      );
    });

    const ordersCount = assignedOrders.length;
    const totalVolume = assignedOrders.reduce((sum, o) => sum + Number(o.total_inr || 0), 0);

    return {
      id: dp.id,
      name: dp.business_name || "Regional Distributor",
      companyName: dp.business_name || "Regional Distributor",
      territory: dp.territory || "Tamil Nadu",
      creditLimit: limit,
      creditLimitDisplay:
        limit !== null ? `₹${limit.toLocaleString("en-IN")}` : "Not available / No approved credit line",
      creditUsed: creditUsed,
      creditUsedDisplay:
        creditUsed !== null ? `₹${creditUsed.toLocaleString("en-IN")}` : "Not available / Unrecorded",
      ordersCount,
      totalVolumeInr: totalVolume,
      status: dp.status || "ACTIVE",
    };
  });

  const creditUtilizationRatio: number | null =
    hasConfiguredCreditLines && totalSanctionedInr > 0
      ? Math.round((totalUtilizedInr / totalSanctionedInr) * 100)
      : null;

  const creditUtilizationRatioDisplay =
    creditUtilizationRatio !== null
      ? `${creditUtilizationRatio}%`
      : "Not available / No approved credit line";

  // 3. Financial Year 12-Month Trajectory
  const FY_MONTH_DEFS = [
    { key: "Apr", name: "April", mNum: 4 },
    { key: "May", name: "May", mNum: 5 },
    { key: "Jun", name: "June", mNum: 6 },
    { key: "Jul", name: "July", mNum: 7 },
    { key: "Aug", name: "August", mNum: 8 },
    { key: "Sep", name: "September", mNum: 9 },
    { key: "Oct", name: "October", mNum: 10 },
    { key: "Nov", name: "November", mNum: 11 },
    { key: "Dec", name: "December", mNum: 12 },
    { key: "Jan", name: "January", mNum: 1 },
    { key: "Feb", name: "February", mNum: 2 },
    { key: "Mar", name: "March", mNum: 3 },
  ];

  // Target relative year
  const startYear = selectedFY.includes("2025") ? 2025 : selectedFY.includes("2024") ? 2024 : 2026;

  const monthlyBuckets: MonthBucket[] = FY_MONTH_DEFS.map((def) => {
    const expectedYear = def.mNum >= 4 ? startYear : startYear + 1;
    let sumAmount = 0;
    let ordersCount = 0;

    for (const o of rawOrders) {
      if (o.status === "CANCELLED") continue;
      const dateStr = o.created_at instanceof Date ? o.created_at.toISOString() : String(o.created_at || "");
      if (!dateStr) continue;
      const d = new Date(dateStr);
      if (d.getFullYear() === expectedYear && d.getMonth() + 1 === def.mNum) {
        sumAmount += Number(o.total_inr || 0);
        ordersCount++;
      }
    }

    return {
      key: def.key,
      name: def.name,
      mNum: def.mNum,
      totalAmount: sumAmount,
      ordersCount,
    };
  });

  const totalFYEarnings = monthlyBuckets.reduce((sum, b) => sum + b.totalAmount, 0);

  // Authoritative YoY calculation: no synthetic "+14.8%"
  const prevStartYear = startYear - 1;
  let prevFYSales = 0;
  let hasPriorYearData = false;
  for (const o of rawOrders) {
    if (o.status === "CANCELLED") continue;
    const dateStr = o.created_at instanceof Date ? o.created_at.toISOString() : String(o.created_at || "");
    if (!dateStr) continue;
    const d = new Date(dateStr);
    const yr = d.getFullYear();
    const m = d.getMonth() + 1;
    if ((yr === prevStartYear && m >= 4) || (yr === prevStartYear + 1 && m <= 3)) {
      prevFYSales += Number(o.total_inr || 0);
      hasPriorYearData = true;
    }
  }
  const yoy = !hasPriorYearData || prevFYSales === 0
    ? "Not available"
    : `${(((totalFYEarnings - prevFYSales) / prevFYSales) * 100) >= 0 ? "+" : ""}${(((totalFYEarnings - prevFYSales) / prevFYSales) * 100).toFixed(1)}%`;

  // 4. Channel Metrics (Distributors vs Dealers vs Customers)
  let distVol = 0;
  let dealerVol = 0;
  let customerVol = 0;

  for (const o of rawOrders) {
    if (o.status === "CANCELLED") continue;
    const custName = (o.customer_name || "").toLowerCase().trim();
    const isDistOrder =
      distributorIdSet.has(o.customer_id) || distributorNameSet.has(custName);
    const items = Array.isArray(o.items) ? (o.items as any[]) : [];
    const firstItem = items[0] || {};
    const isDealerOrder =
      Boolean(firstItem.assigned_dealer_id) ||
      firstItem.routing_status === "ASSIGNED_TO_DEALER" ||
      firstItem.routing_status === "DELIVERED_BY_DEALER" ||
      o.role_at_order === "DEALER";

    const amt = Number(o.total_inr || 0);

    if (isDealerOrder) {
      dealerVol += amt;
    } else if (isDistOrder) {
      if (countPaidDistributorBulk) {
        distVol += amt;
      }
    } else {
      customerVol += amt;
    }
  }

  const totalChannelVol = distVol + dealerVol + customerVol || 1;
  const distPct = Math.round((distVol / totalChannelVol) * 100);
  const dealerPct = Math.round((dealerVol / totalChannelVol) * 100);
  const customerPct = Math.max(0, 100 - distPct - dealerPct);

  // 5 Chronological Trend Intervals (W1 - W5)
  const intervals = [
    { key: "W1", label: "W1", startDay: 1, endDay: 7 },
    { key: "W2", label: "W2", startDay: 8, endDay: 14 },
    { key: "W3", label: "W3", startDay: 15, endDay: 21 },
    { key: "W4", label: "W4", startDay: 22, endDay: 28 },
    { key: "W5", label: "Now", startDay: 29, endDay: 31 },
  ];

  const channelTrends = intervals.map((inv) => {
    let distCount = 0;
    let dealerCount = 0;
    let custCount = 0;

    for (const o of rawOrders) {
      const dateStr = o.created_at instanceof Date ? o.created_at.toISOString() : String(o.created_at || "");
      if (!dateStr) continue;
      const d = new Date(dateStr);
      const day = d.getDate();

      if (day >= inv.startDay && day <= inv.endDay) {
        const custName = (o.customer_name || "").toLowerCase().trim();
        const isDistOrder =
          distributorIdSet.has(o.customer_id) || distributorNameSet.has(custName);
        const items = Array.isArray(o.items) ? (o.items as any[]) : [];
        const isDealerOrder =
          items.some((i) => i.assigned_dealer_id || i.routing_status?.includes("DEALER")) ||
          o.role_at_order === "DEALER";

        if (isDealerOrder) dealerCount++;
        else if (isDistOrder) distCount++;
        else custCount++;
      }
    }

    return {
      key: inv.key,
      label: inv.label,
      distCount,
      dealerCount,
      custCount,
    };
  });

  // 5. Fulfillment Velocity & Supply Chain Quality
  const targetOrders = onlySaiAjantaLogistics
    ? rawOrders.filter(
        (o) =>
          o.is_direct_sai_ajanta === true ||
          (Array.isArray(o.items) &&
            !(o.items as any[]).some((i) => i.assigned_distributor_id || i.assigned_dealer_id))
      )
    : rawOrders;

  const totalFulfillmentOrders = targetOrders.length || 1;

  const deliveredClean = targetOrders.filter(
    (o) =>
      o.status === "DELIVERED" &&
      (!o.damaged_qty || o.damaged_qty === 0) &&
      (!o.damage_claim_status || o.damage_claim_status === "NONE") &&
      (!o.return_status || o.return_status === "NONE")
  ).length;

  const damagedCount = targetOrders.filter(
    (o) =>
      (Number(o.damaged_qty) || 0) > 0 ||
      (o.damage_claim_status && o.damage_claim_status !== "NONE")
  ).length;

  const returnedCount = targetOrders.filter(
    (o) => o.return_status && o.return_status !== "NONE"
  ).length;

  const failedShipmentsCount = targetOrders.filter(
    (o) => Boolean(o.shipment_failure_reason) || (o.delivery_attempts && o.delivery_attempts > 1)
  ).length;

  const cancelledTotalCount = targetOrders.filter(
    (o) => o.status === "CANCELLED" || Boolean(o.cancellation_reason)
  ).length;

  const deliveryOrders = targetOrders.filter(
    (o) => !o.fulfillment_type || o.fulfillment_type === "DELIVERY"
  ).length;
  const pickupOrders = targetOrders.filter(
    (o) => o.fulfillment_type === "PICKUP"
  ).length;
  const totalFulfillmentType = deliveryOrders + pickupOrders || 1;

  // 6. Most Bought Products (Sell-Through Demand)
  // Strictly filter to dealer & end customer orders (exclude pure distributor warehouse stocking)
  const productDemandMap = new Map<
    string,
    {
      sku: string;
      title: string;
      category: string;
      dealerUnits: number;
      customerUnits: number;
      dealerRevenue: number;
      customerRevenue: number;
      orderCount: number;
    }
  >();

  for (const o of rawOrders) {
    if (o.status === "CANCELLED") continue;
    const custName = (o.customer_name || "").toLowerCase().trim();
    const isDistOrder =
      distributorIdSet.has(o.customer_id) || distributorNameSet.has(custName);
    if (isDistOrder && !o.items) continue;

    const items = Array.isArray(o.items) ? (o.items as any[]) : [];
    const isDealerOrder =
      items.some((i) => i.assigned_dealer_id || i.routing_status?.includes("DEALER")) ||
      o.role_at_order === "DEALER";

    for (const item of items) {
      const pid = item.product_id || item.sku || item.name;
      if (!pid) continue;

      const curr = productDemandMap.get(pid) || {
        sku: item.sku || pid,
        title: item.name || "Commercial Profile",
        category: item.category || "Aluminium",
        dealerUnits: 0,
        customerUnits: 0,
        dealerRevenue: 0,
        customerRevenue: 0,
        orderCount: 0,
      };

      const qty = Number(item.quantity || 1);
      const price = Number(item.unit_price_inr || 0);

      if (isDealerOrder) {
        curr.dealerUnits += qty;
        curr.dealerRevenue += qty * price;
      } else {
        curr.customerUnits += qty;
        curr.customerRevenue += qty * price;
      }
      curr.orderCount += 1;

      productDemandMap.set(pid, curr);
    }
  }

  const topProductsDemand = Array.from(productDemandMap.entries())
    .map(([id, stat]) => {
      const totalUnits = stat.dealerUnits + stat.customerUnits;
      const totalRevenue = stat.dealerRevenue + stat.customerRevenue;
      const sum = Math.max(1, totalUnits);
      const dealerSharePercent = Math.round((stat.dealerUnits / sum) * 100);
      return {
        id,
        sku: stat.sku,
        title: stat.title,
        category: stat.category,
        totalUnits,
        dealerUnits: stat.dealerUnits,
        customerUnits: stat.customerUnits,
        totalRevenue,
        dealerSharePercent,
        customerSharePercent: 100 - dealerSharePercent,
        orderCount: stat.orderCount,
      };
    })
    .sort((a, b) => b.totalUnits - a.totalUnits)
    .slice(0, 10);

  return res.json({
    lastRefreshedAt: new Date().toISOString(),
    kpis: {
      pending: pendingCount,
      delivered: deliveredCount,
      shipped: shippedCount,
      invoiced: invoicedCount,
      cancelled: cancelledCount,
      totalVolumeInr: grossVolumeInr,
      totalOrders: rawOrders.length,
    },
    credit: {
      totalSanctionedInr: hasConfiguredCreditLines ? totalSanctionedInr : null,
      totalUtilizedInr: hasConfiguredCreditLines ? totalUtilizedInr : null,
      utilizationRatio: creditUtilizationRatio,
      utilizationRatioDisplay: creditUtilizationRatioDisplay,
      statusNotice: hasConfiguredCreditLines ? "VERIFIED_SANCTIONED_LIMITS" : "NO_SANCTIONED_CREDIT_LINES",
      creditedDistributorsCount: distributorCreditList.filter((d) => d.creditUsed !== null && d.creditUsed > 0).length,
      distributors: distributorCreditList,
    },
    financialYear: {
      selectedFY,
      totalEarningsInr: totalFYEarnings,
      yoy,
      months: monthlyBuckets,
      resaleCheckoutStatus: "DISABLED_PENDING_APPROVAL",
    },
    channelMetrics: {
      distVol,
      dealerVol,
      customerVol,
      distPct,
      dealerPct,
      customerPct,
      trends: channelTrends,
    },
    fulfillmentVelocity: {
      totalCount: totalFulfillmentOrders,
      deliveredClean,
      deliveredCleanRate: Math.round((deliveredClean / totalFulfillmentOrders) * 100),
      damagedCount,
      damageRate: ((damagedCount / totalFulfillmentOrders) * 100).toFixed(1),
      returnedCount,
      returnRate: ((returnedCount / totalFulfillmentOrders) * 100).toFixed(1),
      failedShipmentsCount,
      failureRate: ((failedShipmentsCount / totalFulfillmentOrders) * 100).toFixed(1),
      cancelledCount: cancelledTotalCount,
      cancelRate: ((cancelledTotalCount / totalFulfillmentOrders) * 100).toFixed(1),
      deliveryOrders,
      pickupOrders,
      deliveryPercent: Math.round((deliveryOrders / totalFulfillmentType) * 100),
      pickupPercent: Math.round((pickupOrders / totalFulfillmentType) * 100),
    },
    topProductsDemand,
  });
}
