import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { checkStaffPermission } from "../../../../../lib/permissions";
import { DMS_MODULE } from "../../../../../modules/dms";
import type DmsModuleService from "../../../../../modules/dms/services";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "CATALOG_MANAGE")) {
    return;
  }

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const [reservations, movements, { data: locations }] = await Promise.all([
    dmsService.listStockReservations({}, { take: null }) as Promise<Record<string, any>[]>,
    dmsService.listInventoryMovements({}, { take: null }) as Promise<Record<string, any>[]>,
    query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
    }) as Promise<{ data: { id: string; name: string }[] }>,
  ]);

  reservations.sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
  movements.sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  return res.json({
    readOnlyPhase03Protected: true,
    stockLocations: locations,
    reservations: reservations.slice(0, 200),
    movements: movements.slice(0, 200),
    activeHoldsCount: reservations.filter((r) => r.status === "RESERVED").length,
    expiredCount: reservations.filter((r) => r.status === "EXPIRED").length,
  });
}
