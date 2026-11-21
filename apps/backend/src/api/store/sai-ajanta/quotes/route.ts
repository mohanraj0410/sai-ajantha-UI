import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Authentication required to view your quotations.",
    });
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  // Fetch verified customer email and phone from customer
  const { rows: custRows } = await pg.raw(
    `SELECT c.id, c.email, c.phone
     FROM customer c
     WHERE c.id = ? OR c.id IN (SELECT customer_id FROM account_profile WHERE id = ?)`,
    [customerId, customerId]
  );

  const emails: string[] = [];
  const phones: string[] = [];

  for (const c of custRows) {
    if (c.email) emails.push(c.email.toLowerCase().trim());
    if (c.phone) phones.push(c.phone.trim());
  }

  const conditions: string[] = ["seller_id = ?"];
  const bindings: any[] = [customerId];

  if (emails.length > 0) {
    const placeholders = emails.map(() => "?").join(", ");
    conditions.push(`(lower(customer_email) IN (${placeholders}) AND customer_email <> '')`);
    bindings.push(...emails);
  }

  if (phones.length > 0) {
    const placeholders = phones.map(() => "?").join(", ");
    conditions.push(`(customer_phone IN (${placeholders}) AND customer_phone <> '')`);
    bindings.push(...phones);
  }

  // Return quotes that match verified customer identity or seller_id, excluding ARCHIVED
  const { rows: quotes } = await pg.raw(
    `SELECT *
     FROM dms_trade_quote
     WHERE (${conditions.join(" OR ")})
       AND status <> 'ARCHIVED'
       AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    bindings
  );

  return res.json({ quotes, count: quotes.length });
}
