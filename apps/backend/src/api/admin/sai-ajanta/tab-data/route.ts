import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { ADMIN_DATASETS, buildAdminDatasetQuery, type AdminDataset } from "../../../../lib/admin-tab-datasets";
import { checkStaffPermission } from "../../../../lib/permissions";
import { DMS_MODULE } from "../../../../modules/dms";
import type DmsModuleService from "../../../../modules/dms/services";
import { loadPortalSnapshot } from "../portal/route";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const dataset = String(req.query.dataset || "") as AdminDataset;
  if (!Object.prototype.hasOwnProperty.call(ADMIN_DATASETS, dataset)) return res.status(400).json({ message: "Unsupported dataset" });
  if (!checkStaffPermission(req, res, ADMIN_DATASETS[dataset].permission)) return;
  let statement: ReturnType<typeof buildAdminDatasetQuery>;
  try { statement = buildAdminDatasetQuery(dataset, req.query); }
  catch (error) { return res.status(400).json({ message: (error as Error).message }); }
  const connection = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const { rows: [result] } = await connection.raw(statement.sql, statement.bindings);
  const ids: string[] = result.ids;
  let items: unknown[] = [];
  if (ids.length) {
    if (dataset === "quotes") {
      const service = req.scope.resolve<DmsModuleService>(DMS_MODULE);
      items = await service.listTradeQuotes({ id: ids }, { take: ids.length });
    } else {
      const selection = dataset === "partners" ? { customerIds: ids } : dataset === "products" ? { productIds: ids }
        : dataset === "enquiries" ? { enquiryIds: ids } : { orderIds: ids };
      const snapshot = await loadPortalSnapshot(req, selection);
      items = dataset === "partners" ? snapshot.users : dataset === "products" ? snapshot.products
        : dataset === "enquiries" ? snapshot.enquiries : snapshot.orders;
    }
  }
  const order = new Map(ids.map((id, index) => [id, index]));
  items.sort((a: any, b: any) => (order.get(a.medusa_id || a.id) ?? 0) - (order.get(b.medusa_id || b.id) ?? 0));
  return res.json({ ...result, ids: undefined, items, countPolicy: "Facets respect search and non-tab filters; pagination and the selected tab do not change facets.", refreshedAt: new Date().toISOString() });
}
