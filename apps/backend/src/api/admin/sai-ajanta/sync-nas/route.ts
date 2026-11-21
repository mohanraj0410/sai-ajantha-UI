import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { recordDurableAuditEvent } from "../../../../lib/audit-logger";
import { checkStaffPermission } from "../../../../lib/permissions";
import syncNasImages from "../../../../scripts/sync-nas-images";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "SETTINGS_MANAGE")) {
    return;
  }
  await syncNasImages({
    container: req.scope,
    args: [],
  });
  await recordDurableAuditEvent(req, "CATALOG_NAS_SYNC", "catalog:nas", { status: "SUCCESS" });
  return res.json({
    ok: true,
    message: "Synchronized product thumbnails and images from local NAS.",
  });
}
