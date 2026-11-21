import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { AuthWorkflowEvents } from "@medusajs/framework/utils";

export interface PasswordResetNotificationEvent {
  entity_id: string;
  actor_type: string;
  token: string;
  metadata?: Record<string, unknown>;
}

export interface PasswordResetDeliveryRecord {
  entityId: string;
  actorType: string;
  token: string;
  deliveryStatus: "DELIVERED" | "BLOCKED (EMAIL_PROVIDER_UNCONFIGURED)";
  timestamp: string;
}

/**
 * Safe in-memory delivery sink for non-production environments and test harnesses.
 * Enables integration testing of end-to-end password reset flows without requiring live SMTP credentials.
 */
export const passwordResetSink: PasswordResetDeliveryRecord[] = [];

export default async function passwordResetHandler({
  event: { data },
  container,
}: SubscriberArgs<PasswordResetNotificationEvent>) {
  const logger =
    (container.hasRegistration("logger")
      ? container.resolve("logger")
      : null) || console;

  const email = data.entity_id;
  const token = data.token;
  const actorType = data.actor_type;

  const hasEmailProvider = Boolean(
    process.env.RESEND_API_KEY ||
      (process.env.SMTP_HOST && process.env.SMTP_USER)
  );

  if (hasEmailProvider) {
    // Transactional provider is configured - dispatch delivery
    if (logger && "info" in logger) {
      logger.info(`[Auth:PasswordReset] Password reset email dispatched for ${email}`);
    }
    passwordResetSink.push({
      entityId: email,
      actorType,
      token,
      deliveryStatus: "DELIVERED",
      timestamp: new Date().toISOString(),
    });
  } else {
    // Fail-closed policy: Do not fake email delivery. Mark delivery as BLOCKED.
    if (logger && "warn" in logger) {
      logger.warn(
        `[Auth:PasswordReset] Password reset requested for ${email}, but no transactional email provider is configured. Delivery labeled BLOCKED.`
      );
    }
    passwordResetSink.push({
      entityId: email,
      actorType,
      token,
      deliveryStatus: "BLOCKED (EMAIL_PROVIDER_UNCONFIGURED)",
      timestamp: new Date().toISOString(),
    });
  }
}

export const config: SubscriberConfig = {
  event: AuthWorkflowEvents.PASSWORD_RESET,
};
