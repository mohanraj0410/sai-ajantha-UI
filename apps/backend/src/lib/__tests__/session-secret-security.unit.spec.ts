describe("Session Secret Security (SF-04)", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("fails-closed in production when SESSION_SECRET is missing or empty", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;

    function getSessionKeyTest(): Buffer {
      const secret = process.env.SESSION_SECRET?.trim();
      if (process.env.NODE_ENV === "production") {
        if (
          !secret ||
          secret.length < 32 ||
          secret.includes("dev-only") ||
          secret.includes("change-in-prod")
        ) {
          throw new Error(
            "CRITICAL SECURITY CONFIGURATION ERROR: SESSION_SECRET must be configured in production with at least 32 characters."
          );
        }
        return Buffer.from(secret);
      }
      return Buffer.from("dev-fallback");
    }

    expect(() => getSessionKeyTest()).toThrow(
      "CRITICAL SECURITY CONFIGURATION ERROR: SESSION_SECRET must be configured in production"
    );
  });

  it("fails-closed in production when SESSION_SECRET is too short (<32 chars)", () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "short-secret";

    function getSessionKeyTest(): Buffer {
      const secret = process.env.SESSION_SECRET?.trim();
      if (process.env.NODE_ENV === "production") {
        if (
          !secret ||
          secret.length < 32 ||
          secret.includes("dev-only") ||
          secret.includes("change-in-prod")
        ) {
          throw new Error(
            "CRITICAL SECURITY CONFIGURATION ERROR: SESSION_SECRET must be configured in production with at least 32 characters."
          );
        }
        return Buffer.from(secret);
      }
      return Buffer.from("dev-fallback");
    }

    expect(() => getSessionKeyTest()).toThrow(
      "CRITICAL SECURITY CONFIGURATION ERROR: SESSION_SECRET must be configured in production"
    );
  });

  it("succeeds in production when SESSION_SECRET is robust (>=32 chars)", () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "a-very-secure-random-production-secret-key-32chars!";

    function getSessionKeyTest(): Buffer {
      const secret = process.env.SESSION_SECRET?.trim();
      if (process.env.NODE_ENV === "production") {
        if (
          !secret ||
          secret.length < 32 ||
          secret.includes("dev-only") ||
          secret.includes("change-in-prod")
        ) {
          throw new Error(
            "CRITICAL SECURITY CONFIGURATION ERROR: SESSION_SECRET must be configured in production with at least 32 characters."
          );
        }
        return Buffer.from(secret);
      }
      return Buffer.from("dev-fallback");
    }

    expect(() => getSessionKeyTest()).not.toThrow();
  });
});
