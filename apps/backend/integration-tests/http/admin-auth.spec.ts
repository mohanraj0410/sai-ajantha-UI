import path from "node:path";

process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "5432";
process.env.DB_USERNAME = process.env.DB_USERNAME || "medusa";
process.env.DB_TEMP_NAME = process.env.DB_TEMP_NAME || "medusa_test";
if (!process.env.DATABASE_URL) {
  const dbUser = process.env.DB_USERNAME || "medusa";
  const dbPass = process.env.DB_PASSWORD || "7hippocampus";
  process.env.DATABASE_URL = `postgres://${dbUser}:${dbPass}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_TEMP_NAME}`;
}
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-very-secure-key-12345";
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || "test-cookie-secret-very-secure-key-12345";

import { medusaIntegrationTestRunner } from "@medusajs/test-utils";

jest.setTimeout(120000);

medusaIntegrationTestRunner({
  cwd: path.resolve(__dirname, "../../"),
  dbName: process.env.DB_TEMP_NAME || "medusa_test",
  env: {
    DB_HOST: process.env.DB_HOST || "127.0.0.1",
    DB_PORT: process.env.DB_PORT || "5432",
    DB_USERNAME: process.env.DB_USERNAME || "medusa",
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    COOKIE_SECRET: process.env.COOKIE_SECRET,
  },
  testSuite: ({ api }) => {
    describe("HTTP Stack Admin Authentication Boundary (BE-01 / ADM-01)", () => {
      it("rejects anonymous GET /admin/sai-ajanta/products with 401 Unauthorized", async () => {
        try {
          await api.get("/admin/sai-ajanta/products");
          expect(true).toBe(false);
        } catch (err: any) {
          expect(err.response?.status).toBe(401);
          expect(err.response?.data).toBeDefined();
        }
      });

      it("rejects anonymous GET /admin/sai-ajanta/orders with 401 Unauthorized", async () => {
        try {
          await api.get("/admin/sai-ajanta/orders");
          expect(true).toBe(false);
        } catch (err: any) {
          expect(err.response?.status).toBe(401);
        }
      });

      it("rejects anonymous GET /admin/sai-ajanta/analytics with 401 Unauthorized", async () => {
        try {
          await api.get("/admin/sai-ajanta/analytics");
          expect(true).toBe(false);
        } catch (err: any) {
          expect(err.response?.status).toBe(401);
        }
      });

      it("rejects anonymous GET /admin/custom with 401 Unauthorized", async () => {
        try {
          await api.get("/admin/custom");
          expect(true).toBe(false);
        } catch (err: any) {
          expect(err.response?.status).toBe(401);
        }
      });

      it("rejects anonymous POST /admin/sai-ajanta/sync-nas with 401 Unauthorized", async () => {
        try {
          await api.post("/admin/sai-ajanta/sync-nas", {});
          expect(true).toBe(false);
        } catch (err: any) {
          expect(err.response?.status).toBe(401);
        }
      });

      it("rejects customer bearer token from accessing /admin/sai-ajanta/products with 401 or 403", async () => {
        try {
          await api.get("/admin/sai-ajanta/products", {
            headers: {
              Authorization: "Bearer invalid.customer.jwt.token",
            },
          });
          expect(true).toBe(false);
        } catch (err: any) {
          expect([401, 403]).toContain(err.response?.status);
        }
      });
    });
  },
});
