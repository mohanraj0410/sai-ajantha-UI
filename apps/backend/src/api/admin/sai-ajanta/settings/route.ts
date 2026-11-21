import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { recordDurableAuditEvent } from "../../../../lib/audit-logger";
import { getCommercialFeatureFlags } from "../../../../lib/feature-flags";
import { checkStaffPermission } from "../../../../lib/permissions";
import { DMS_MODULE } from "../../../../modules/dms";
import type DmsModuleService from "../../../../modules/dms/services";

const SETTING_KEY = "ops_ui_defaults";

const UpdateAdminSettingsSchema = z
  .object({
    display_locale: z.enum(["en-IN", "en-US"]).optional(),
    timezone: z.enum(["Asia/Kolkata", "UTC"]).optional(),
    default_page_size: z
      .number()
      .int()
      .refine((n) => [10, 25, 50, 100].includes(n), {
        message: "default_page_size must be 10, 25, 50, or 100",
      })
      .optional(),
    enquiry_alert_email_enabled: z.boolean().optional(),
    order_dispatch_alert_enabled: z.boolean().optional(),
    low_stock_threshold: z.number().int().min(1).max(1000).optional(),
    expectedVersion: z.number().int().min(0).optional(),
  })
  .strict();

interface RawAdminSetting {
  id: string;
  setting_key: string;
  display_locale: string;
  timezone: string;
  default_page_size: number;
  enquiry_alert_email_enabled: boolean;
  order_dispatch_alert_enabled: boolean;
  low_stock_threshold: number;
  version: number;
  updated_by_id?: string | null;
  updated_by_email?: string | null;
  updated_at?: Date | string;
}

const DEFAULT_SETTINGS = {
  setting_key: SETTING_KEY,
  display_locale: "en-IN",
  timezone: "Asia/Kolkata",
  default_page_size: 25,
  enquiry_alert_email_enabled: true,
  order_dispatch_alert_enabled: true,
  low_stock_threshold: 10,
  version: 0,
  updated_by_email: null,
};

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "SETTINGS_MANAGE")) {
    return;
  }

  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const rows = (await dmsService.listAdminSettings({
    setting_key: SETTING_KEY,
  })) as unknown as RawAdminSetting[];

  const current = rows[0] || DEFAULT_SETTINGS;

  return res.json({
    settings: {
      setting_key: current.setting_key,
      display_locale: current.display_locale,
      timezone: current.timezone,
      default_page_size: current.default_page_size,
      enquiry_alert_email_enabled: Boolean(current.enquiry_alert_email_enabled),
      order_dispatch_alert_enabled: Boolean(current.order_dispatch_alert_enabled),
      low_stock_threshold: current.low_stock_threshold,
      version: current.version ?? 0,
      updated_by_email: current.updated_by_email || null,
    },
    lockedCommercialFlags: getCommercialFeatureFlags(),
  });
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "SETTINGS_MANAGE")) {
    return;
  }

  const parsed = UpdateAdminSettingsSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "),
    });
  }

  const body = parsed.data;
  const dmsService = req.scope.resolve<DmsModuleService>(DMS_MODULE);
  const rows = (await dmsService.listAdminSettings({
    setting_key: SETTING_KEY,
  })) as unknown as RawAdminSetting[];

  const existing = rows[0];
  const currentVersion = existing?.version ?? 0;

  if (body.expectedVersion !== undefined && body.expectedVersion !== currentVersion) {
    return res.status(409).json({
      code: "VERSION_CONFLICT",
      message: `Settings updated by another administrator (expected version ${body.expectedVersion}, server version ${currentVersion}). Reload and retry.`,
    });
  }

  const payload = {
    display_locale: body.display_locale ?? existing?.display_locale ?? DEFAULT_SETTINGS.display_locale,
    timezone: body.timezone ?? existing?.timezone ?? DEFAULT_SETTINGS.timezone,
    default_page_size:
      body.default_page_size ?? existing?.default_page_size ?? DEFAULT_SETTINGS.default_page_size,
    enquiry_alert_email_enabled:
      body.enquiry_alert_email_enabled ??
      existing?.enquiry_alert_email_enabled ??
      DEFAULT_SETTINGS.enquiry_alert_email_enabled,
    order_dispatch_alert_enabled:
      body.order_dispatch_alert_enabled ??
      existing?.order_dispatch_alert_enabled ??
      DEFAULT_SETTINGS.order_dispatch_alert_enabled,
    low_stock_threshold:
      body.low_stock_threshold ?? existing?.low_stock_threshold ?? DEFAULT_SETTINGS.low_stock_threshold,
    version: currentVersion + 1,
    updated_by_id: req.staff_user?.id || null,
    updated_by_email: req.staff_user?.email || null,
  };

  let saved: RawAdminSetting;
  if (existing) {
    saved = (await dmsService.updateAdminSettings({
      id: existing.id,
      ...payload,
    })) as unknown as RawAdminSetting;
  } else {
    saved = (await dmsService.createAdminSettings({
      setting_key: SETTING_KEY,
      ...payload,
    })) as unknown as RawAdminSetting;
  }

  await recordDurableAuditEvent(
    req,
    "ADMIN_SETTINGS_UPDATE",
    `settings:${SETTING_KEY}`,
    {
      version: saved.version,
      display_locale: saved.display_locale,
      timezone: saved.timezone,
      default_page_size: saved.default_page_size,
      low_stock_threshold: saved.low_stock_threshold,
    },
    { required: true }
  );

  return res.json({
    settings: {
      setting_key: saved.setting_key,
      display_locale: saved.display_locale,
      timezone: saved.timezone,
      default_page_size: saved.default_page_size,
      enquiry_alert_email_enabled: Boolean(saved.enquiry_alert_email_enabled),
      order_dispatch_alert_enabled: Boolean(saved.order_dispatch_alert_enabled),
      low_stock_threshold: saved.low_stock_threshold,
      version: saved.version,
      updated_by_email: saved.updated_by_email || null,
    },
    lockedCommercialFlags: getCommercialFeatureFlags(),
  });
}
