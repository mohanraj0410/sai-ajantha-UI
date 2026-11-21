import { model } from "@medusajs/framework/utils";

const WebhookInbox = model
  .define("dms_webhook_inbox", {
    id: model.id({ prefix: "wkinb" }).primaryKey(),
    provider: model.text().default("RAZORPAY"),
    provider_event_id: model.text().index(),
    event_type: model.text().nullable(),
    provider_order_id: model.text().index().nullable(),
    provider_payment_id: model.text().nullable(),
    payload_hash: model.text(),
    status: model.text().default("RECEIVED"),
    retry_count: model.number().default(0),
    last_attempt_at: model.dateTime().nullable(),
    processed_at: model.dateTime().nullable(),
    error_message: model.text().nullable(),
  })
  .indexes([
    {
      on: ["provider", "provider_event_id"],
      unique: true,
    },
  ]);

export default WebhookInbox;
