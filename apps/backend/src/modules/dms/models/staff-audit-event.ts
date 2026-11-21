import { model } from "@medusajs/framework/utils";

const StaffAuditEvent = model.define("dms_staff_audit_event", {
  id: model.id({ prefix: "aud" }).primaryKey(),
  actor_id: model.text().index(),
  actor_email: model.text().nullable(),
  actor_role: model.text().default("staff"),
  action: model.text().index(),
  resource: model.text().index(),
  outcome: model.text().default("SUCCESS"), // SUCCESS | FAILURE | DENIED
  reason: model.text().nullable(),
  correlation_id: model.text().index().nullable(),
  summary: model.json().nullable(),
  occurred_at: model.dateTime().index(),
});

export default StaffAuditEvent;
