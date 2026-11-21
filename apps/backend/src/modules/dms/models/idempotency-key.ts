import { model } from "@medusajs/framework/utils";

const IdempotencyKey = model
  .define("dms_idempotency_key", {
    id: model.id({ prefix: "idemp" }).primaryKey(),
    idempotency_key: model.text().index(),
    actor_or_scope: model.text().default("system"),
    operation: model.text(),
    fingerprint: model.text(),
    status: model.text().default("IN_PROGRESS"),
    response_status: model.number().nullable(),
    response_body: model.json().nullable(),
    expires_at: model.dateTime(),
  })
  .indexes([
    {
      on: ["actor_or_scope", "operation", "idempotency_key"],
      unique: true,
    },
    {
      on: ["expires_at"],
    },
  ]);

export default IdempotencyKey;
