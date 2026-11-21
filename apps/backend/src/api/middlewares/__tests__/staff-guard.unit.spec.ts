import { requireStaffAdmin } from "../staff-guard";
import { Modules } from "@medusajs/framework/utils";

describe("Staff Admin Authentication & Authorization Guard (BE-01 / ADM-01)", () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    mockReq = {
      scope: {
        resolve: jest.fn(),
      },
    };
  });

  it("should return 401 Unauthorized for anonymous requests without auth_context", async () => {
    mockReq.auth_context = undefined;

    await requireStaffAdmin(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "UNAUTHORIZED",
        message: expect.stringContaining("Authentication required"),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should return 401 Unauthorized if auth_context exists but actor_id is missing", async () => {
    mockReq.auth_context = { actor_type: "user" };

    await requireStaffAdmin(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "UNAUTHORIZED" })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should return 403 Forbidden for customer/dealer/distributor tokens", async () => {
    mockReq.auth_context = {
      actor_id: "cus_12345",
      actor_type: "customer",
    };

    await requireStaffAdmin(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "FORBIDDEN",
        message: expect.stringContaining("Customer and trade accounts cannot access"),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should return 401 Unauthorized if staff user account is deactivated (deleted_at is set)", async () => {
    mockReq.auth_context = {
      actor_id: "usr_deactivated",
      actor_type: "user",
    };

    const mockUserModule = {
      retrieveUser: jest.fn().mockResolvedValue({
        id: "usr_deactivated",
        email: "deactivated@sai-ajanta.com",
        deleted_at: new Date(),
      }),
    };

    mockReq.scope.resolve.mockImplementation((key: string) => {
      if (key === Modules.USER) return mockUserModule;
      return undefined;
    });

    await requireStaffAdmin(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "UNAUTHORIZED",
        message: expect.stringContaining("deactivated"),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should return 401 Unauthorized when staff metadata marks active=false or suspended=true", async () => {
    mockReq.auth_context = {
      actor_id: "usr_suspended",
      actor_type: "user",
    };

    const mockUserModule = {
      retrieveUser: jest.fn().mockResolvedValue({
        id: "usr_suspended",
        email: "suspended@sai-ajanta.com",
        deleted_at: null,
        metadata: { role: "admin", active: false },
      }),
    };

    mockReq.scope.resolve.mockImplementation((key: string) => {
      if (key === Modules.USER) return mockUserModule;
      return undefined;
    });

    await requireStaffAdmin(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "UNAUTHORIZED",
        message: expect.stringContaining("deactivated"),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should return 401 Unauthorized if staff user is not found in database", async () => {
    mockReq.auth_context = {
      actor_id: "usr_nonexistent",
      actor_type: "user",
    };

    const mockUserModule = {
      retrieveUser: jest.fn().mockResolvedValue(null),
    };

    mockReq.scope.resolve.mockImplementation((key: string) => {
      if (key === Modules.USER) return mockUserModule;
      return undefined;
    });

    await requireStaffAdmin(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should permit legitimate staff user and inject req.staff_user for audit traceability", async () => {
    mockReq.auth_context = {
      actor_id: "usr_valid_admin",
      actor_type: "user",
    };

    const mockStaffUser = {
      id: "usr_valid_admin",
      email: "admin@sai-ajanta.com",
      first_name: "Sai",
      last_name: "Admin",
      deleted_at: null,
    };

    const mockUserModule = {
      retrieveUser: jest.fn().mockResolvedValue(mockStaffUser),
    };

    mockReq.scope.resolve.mockImplementation((key: string) => {
      if (key === Modules.USER) return mockUserModule;
      return undefined;
    });

    await requireStaffAdmin(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
    expect(mockReq.staff_user).toMatchObject({
      id: "usr_valid_admin",
      email: "admin@sai-ajanta.com",
      first_name: "Sai",
      last_name: "Admin",
    });
  });

  it("should safely handle database resolution errors without leaking internal stack traces", async () => {
    mockReq.auth_context = {
      actor_id: "usr_err",
      actor_type: "user",
    };

    const mockUserModule = {
      retrieveUser: jest.fn().mockRejectedValue(new Error("DB connection timeout")),
    };

    mockReq.scope.resolve.mockImplementation((key: string) => {
      if (key === Modules.USER) return mockUserModule;
      return undefined;
    });

    await requireStaffAdmin(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      code: "UNAUTHORIZED",
      message: "Failed to verify staff administrator credentials.",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
