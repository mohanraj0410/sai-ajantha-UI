import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { RawTradeOrder, serializeTradeOrder } from "../../../../lib/order-serializer";
import { checkStaffPermission } from "../../../../lib/permissions";
import { DMS_MODULE } from "../../../../modules/dms";
import DmsModuleService from "../../../../modules/dms/services";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "ORDERS_MANAGE")) {
    return;
  }
  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const orders = (await dmsService.listTradeOrders({}, { take: null })) as unknown as RawTradeOrder[];
  const returns = orders
    .filter(
      (o) =>
        (o.return_status && o.return_status !== "NONE") ||
        (o.damage_claim_status && o.damage_claim_status !== "NONE")
    )
    .map((o) => serializeTradeOrder(o, []));
  return res.json({ returns, count: returns.length });
}
