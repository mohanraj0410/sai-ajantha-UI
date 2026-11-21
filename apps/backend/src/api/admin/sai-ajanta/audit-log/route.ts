import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { redactAuditSummary } from "../../../../lib/audit-logger";
import { checkStaffPermission } from "../../../../lib/permissions";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

interface RawStaffAuditRow {
  id: string;
  actor_id: string;
  actor_email?: string | null;
  actor_role?: string | null;
  action: string;
  resource: string;
  outcome?: string | null;
  reason?: string | null;
  correlation_id?: string | null;
  summary?: Record<string, unknown> | null;
  occurred_at?: Date | string;
  created_at?: Date | string;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "SETTINGS_MANAGE")) {
    return;
  }

  const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(String(req.query.pageSize || "25"), 10) || 25)
  );
  const actionFilter = req.query.action ? String(req.query.action).trim().toUpperCase() : "";
  const actorFilter = req.query.actor ? String(req.query.actor).trim().toLowerCase() : "";
  const outcomeFilter = req.query.outcome ? String(req.query.outcome).trim().toUpperCase() : "";
  const resourceFilter = req.query.resource ? String(req.query.resource).trim().toLowerCase() : "";
  const fromDate = req.query.from ? Date.parse(String(req.query.from)) : NaN;
  const toDate = req.query.to ? Date.parse(String(req.query.to)) : NaN;

  const conditions = ["deleted_at IS NULL"];
  const bindings: (string | number)[] = [];
  const add = (condition: string, value: string | number) => { conditions.push(condition); bindings.push(value); };
  if (actionFilter) add("strpos(upper(action), ?) > 0", actionFilter);
  if (actorFilter) { conditions.push("(strpos(lower(COALESCE(actor_email,'')), ?) > 0 OR strpos(lower(actor_id), ?) > 0)"); bindings.push(actorFilter, actorFilter); }
  if (outcomeFilter && outcomeFilter !== "ALL") add("upper(COALESCE(outcome,'SUCCESS')) = ?", outcomeFilter);
  if (resourceFilter) add("strpos(lower(resource), ?) > 0", resourceFilter);
  if (!Number.isNaN(fromDate)) add("COALESCE(occurred_at,created_at) >= ?::timestamptz", new Date(fromDate).toISOString());
  if (!Number.isNaN(toDate)) add("COALESCE(occurred_at,created_at) <= ?::timestamptz", new Date(toDate).toISOString());
  const connection = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const { rows: [result] } = await connection.raw(
    `WITH scoped AS (SELECT * FROM dms_staff_audit_event WHERE ${conditions.join(" AND ")}),
      totals AS (SELECT count(*)::int AS total FROM scoped),
      paging AS (SELECT total, LEAST(?::int,GREATEST(1,CEIL(total::numeric / ?::int)::int)) AS page FROM totals)
      SELECT total,page,COALESCE((SELECT jsonb_agg(event) FROM (SELECT * FROM scoped ORDER BY COALESCE(occurred_at,created_at) DESC,id LIMIT ? OFFSET (paging.page-1)*?) event),'[]'::jsonb) AS events FROM paging`,
    [...bindings,page,pageSize,pageSize,pageSize]);
  const rawEvents = result.events as RawStaffAuditRow[];

  const filtered = rawEvents
    .map((ev) => {
      const occurredIso =
        ev.occurred_at instanceof Date
          ? ev.occurred_at.toISOString()
          : String(ev.occurred_at || ev.created_at || new Date().toISOString());
      return {
        id: ev.id,
        actor_id: ev.actor_id,
        actor_email: ev.actor_email || null,
        actor_role: ev.actor_role || "staff",
        action: ev.action,
        resource: ev.resource,
        outcome: (ev.outcome || "SUCCESS").toUpperCase(),
        reason: ev.reason || null,
        correlation_id: ev.correlation_id || null,
        summary: ev.summary ? redactAuditSummary(ev.summary) : null,
        occurred_at: occurredIso,
      };
    })
    ;

  return res.json({
    events: filtered,
    total: result.total,
    page: result.page,
    pageSize,
    immutableLedger: true,
  });
}
