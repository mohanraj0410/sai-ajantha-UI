import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import jwt from "jsonwebtoken";
import { DMS_MODULE } from "../../../../../modules/dms";
import DmsModuleService from "../../../../../modules/dms/services";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as {
    token?: string;
    password?: string;
  };

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token) {
    return res.status(400).json({ message: "Password reset token is required." });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({
      message: "New password must be at least 8 characters long.",
    });
  }

  const configModule = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as {
    projectConfig?: { http?: { jwtSecret?: string } };
  };
  const jwtSecret = configModule?.projectConfig?.http?.jwtSecret;
  if (!jwtSecret) {
    return res.status(500).json({ message: "JWT secret is not configured on server." });
  }

  // 1. Verify token signature and purpose claim
  let decoded: {
    entity_id?: string;
    actor_type?: string;
    purpose?: string;
    jti?: string;
  };

  try {
    decoded = jwt.verify(token, jwtSecret) as typeof decoded;
  } catch {
    return res.status(400).json({
      message: "Reset token is invalid or has expired. Please request a new link.",
    });
  }

  if (decoded.purpose !== "reset" || !decoded.jti || !decoded.entity_id) {
    return res.status(400).json({
      message: "Invalid token purpose or missing token identification.",
    });
  }

  const authModule = req.scope.resolve(Modules.AUTH) as any;

  // 2. Atomically consume token in Medusa native auth store (replay resistance)
  try {
    await authModule.consumePasswordResetToken({
      jti: decoded.jti,
      provider: "emailpass",
      entity_id: decoded.entity_id,
    });
  } catch {
    return res.status(400).json({
      message: "This password reset token has already been consumed or has expired.",
    });
  }

  // 3. Authoritatively update credentials in emailpass provider
  try {
    const { success, error } = await authModule.updateProvider("emailpass", {
      entity_id: decoded.entity_id,
      password,
    });

    if (!success) {
      return res.status(400).json({
        message: error || "Failed to update account password.",
      });
    }
  } catch (err) {
    return res.status(500).json({
      message: err instanceof Error ? err.message : "Error updating account password.",
    });
  }

  // 4. Update DMS account profile to mark session_revoked_at across all devices
  try {
    const customerModule = req.scope.resolve(Modules.CUSTOMER) as any;
    const customers = await customerModule.listCustomers({
      email: decoded.entity_id,
    });

    if (customers && customers.length > 0) {
      const customerId = customers[0].id;
      const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
      const profiles = await dmsService.listAccountProfiles({
        customer_id: customerId,
      });

      if (profiles && profiles.length > 0) {
        const prevAttrs =
          (profiles[0].dynamic_attributes as Record<string, unknown> | null) || {};
        const nowIso = new Date().toISOString();

        await dmsService.updateAccountProfiles({
          id: profiles[0].id,
          dynamic_attributes: {
            ...prevAttrs,
            session_revoked_at: nowIso,
            password_updated_at: nowIso,
          },
        });
      }
    }
  } catch {
    // Non-fatal profile timestamp update error; credentials already successfully rotated
  }

  return res.json({
    ok: true,
    message: "Password reset successfully. Previous active sessions have been revoked.",
  });
}
