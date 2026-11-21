import { checkStaffPermission, hasStaffPermission } from "../permissions";
import { logAuditEvent, redactAuditSummary } from "../audit-logger";

describe("Staff Permissions & Actor Audit Logging (Task 01.3)", () => {
  describe("hasStaffPermission", () => {
    it("returns false for undefined staff user", () => {
      expect(hasStaffPermission(undefined, "CUSTOMERS_MANAGE")).toBe(false);
    });

    it("allows standard admin role unrestricted access to all permissions", () => {
      const staffAdmin = {
        id: "usr_admin",
        email: "admin@sai-ajanta.com",
        metadata: { role: "admin" },
      };

      expect(hasStaffPermission(staffAdmin, "CUSTOMERS_MANAGE")).toBe(true);
      expect(hasStaffPermission(staffAdmin, "ORDERS_MANAGE")).toBe(true);
      expect(hasStaffPermission(staffAdmin, "CATALOG_MANAGE")).toBe(true);
      expect(hasStaffPermission(staffAdmin, "ENQUIRIES_MANAGE")).toBe(true);
    });

    it("allows restricted staff member with specific permission", () => {
      const restrictedStaff = {
        id: "usr_sales",
        email: "sales@sai-ajanta.com",
        metadata: {
          role: "sales_rep",
          permissions: ["ENQUIRIES_MANAGE", "ORDERS_MANAGE"],
        },
      };

      expect(hasStaffPermission(restrictedStaff, "ENQUIRIES_MANAGE")).toBe(true);
      expect(hasStaffPermission(restrictedStaff, "ORDERS_MANAGE")).toBe(true);
      expect(hasStaffPermission(restrictedStaff, "CATALOG_MANAGE")).toBe(false);
      expect(hasStaffPermission(restrictedStaff, "CUSTOMERS_MANAGE")).toBe(false);
    });

    it("allows wildcard permission '*'", () => {
      const wildcardStaff = {
        id: "usr_ops",
        email: "ops@sai-ajanta.com",
        metadata: {
          role: "ops_lead",
          permissions: ["*"],
        },
      };

      expect(hasStaffPermission(wildcardStaff, "CATALOG_MANAGE")).toBe(true);
    });

    it("denies all permissions fail-closed if metadata marks staff suspended or inactive", () => {
      expect(
        hasStaffPermission(
          { id: "u1", email: "x@sai-ajanta.com", metadata: { role: "admin", active: false } },
          "CATALOG_MANAGE"
        )
      ).toBe(false);
      expect(
        hasStaffPermission(
          { id: "u2", email: "y@sai-ajanta.com", metadata: { role: "super_admin", suspended: true } },
          "SETTINGS_MANAGE"
        )
      ).toBe(false);
    });
  });

  describe("checkStaffPermission (HTTP Guard)", () => {
    it("emits 401 when req.staff_user is missing", () => {
      const req: any = {};
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const result = checkStaffPermission(req, res, "CUSTOMERS_MANAGE");

      expect(result).toBe(false);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "UNAUTHORIZED" })
      );
    });

    it("emits 403 when req.staff_user lacks required permission", () => {
      const req: any = {
        staff_user: {
          id: "usr_catalog",
          email: "catalog@sai-ajanta.com",
          metadata: {
            role: "catalog_specialist",
            permissions: ["CATALOG_MANAGE"],
          },
        },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const result = checkStaffPermission(req, res, "CUSTOMERS_MANAGE");

      expect(result).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "FORBIDDEN",
          message: expect.stringContaining("CUSTOMERS_MANAGE"),
        })
      );
    });

    it("returns true and does not emit error when staff has permission", () => {
      const req: any = {
        staff_user: {
          id: "usr_admin",
          email: "admin@sai-ajanta.com",
          metadata: { role: "admin" },
        },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const result = checkStaffPermission(req, res, "CUSTOMERS_MANAGE");

      expect(result).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("logAuditEvent", () => {
    it("formats and returns structured audit log entry with actor details", () => {
      const mockInfo = jest.fn();
      const req: any = {
        staff_user: {
          id: "usr_staff_1",
          email: "staff@sai-ajanta.com",
        },
        scope: {
          resolve: jest.fn().mockReturnValue({ info: mockInfo }),
        },
      };

      const entry = logAuditEvent(req, "ORDER_UPDATE", "order:ord_123", {
        status: "CONFIRMED",
      });

      expect(entry.actor_id).toBe("usr_staff_1");
      expect(entry.email).toBe("staff@sai-ajanta.com");
      expect(entry.action).toBe("ORDER_UPDATE");
      expect(entry.resource).toBe("order:ord_123");
      expect(entry.details?.status).toBe("CONFIRMED");
      expect(entry.timestamp).toBeDefined();
      expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining("[STAFF_AUDIT]"));
    });

    it("redacts passwords, tokens, internal_notes, and raw PII from audit details", () => {
      const redacted = redactAuditSummary({
        action: "UPDATE",
        password: "secret-value",
        razorpay_signature: "sig-xyz",
        internal_notes: "confidential margin",
        phone: "9842100000",
        nested: { jwt: "abc.def.ghi", safeCount: 4 },
      }) as Record<string, any>;

      expect(redacted.action).toBe("UPDATE");
      expect(redacted.password).toBe("[REDACTED]");
      expect(redacted.razorpay_signature).toBe("[REDACTED]");
      expect(redacted.internal_notes).toBe("[REDACTED]");
      expect(redacted.phone).toBe("[REDACTED]");
      expect(redacted.nested.jwt).toBe("[REDACTED]");
      expect(redacted.nested.safeCount).toBe(4);
    });
  });
});
