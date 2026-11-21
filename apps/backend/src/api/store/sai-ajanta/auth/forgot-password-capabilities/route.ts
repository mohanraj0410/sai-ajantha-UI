import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const staffEmailResetConfigured = Boolean(
    process.env.RESEND_API_KEY ||
      (process.env.SMTP_HOST && process.env.SMTP_USER)
  );

  return res.json({
    staffEmailResetConfigured,
    nativeResetEndpoint: "/auth/user/emailpass/reset-password",
    nativeUpdateEndpoint: "/auth/user/emailpass/update",
    providerState: staffEmailResetConfigured
      ? "CONFIGURED"
      : "BLOCKED_EXTERNAL_PROVIDER",
  });
}
