import fs from "node:fs";
import path from "node:path";
import { loadEnv, defineConfig } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", __dirname);
loadEnv(process.env.NODE_ENV || "development", process.cwd());

const resolveNasDir = (): string => {
  const envDir = process.env.NAS_PUBLIC_MEDIA_ROOT || process.env.LOCAL_NAS_DIR;
  const candidates = [
    envDir ? path.resolve(process.cwd(), envDir) : null,
    path.resolve(process.cwd(), "../../../local-nas"),
    path.resolve(__dirname, "../../../local-nas"),
    path.resolve(process.cwd(), "../../../../local-nas"),
    path.resolve(__dirname, "../../../../local-nas"),
  ].filter((p): p is string => Boolean(p));
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
};

const localNasDir = resolveNasDir();

const isR2Configured = Boolean(
  (process.env.R2_BUCKET || process.env.S3_BUCKET) &&
  (process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID) &&
  (process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY)
);

const fileProvider = isR2Configured
  ? {
      resolve: "@medusajs/medusa/file-s3",
      id: "s3",
      options: {
        file_url: (
          process.env.R2_PUBLIC_URL ||
          process.env.NEXT_PUBLIC_R2_URL ||
          process.env.S3_FILE_URL ||
          ""
        ).replace(/\/+$/, ""),
        access_key_id: process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID,
        secret_access_key: process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY,
        region: process.env.R2_REGION || process.env.S3_REGION || "auto",
        bucket: process.env.R2_BUCKET || process.env.S3_BUCKET,
        endpoint:
          process.env.R2_ENDPOINT ||
          (process.env.R2_ACCOUNT_ID
            ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
            : undefined),
        acl: false,
        additional_client_config: {
          forcePathStyle: false,
        },
      },
    }
  : {
      resolve: "@medusajs/medusa/file-local",
      id: "local",
      options: {
        upload_dir: localNasDir,
        private_upload_dir: localNasDir,
        backend_url:
          process.env.MEDUSA_STATIC_URL || "http://localhost:9000/static",
      },
    };

module.exports = defineConfig({
  admin: {
    disable: process.env.MEDUSA_ADMIN_DISABLE !== "false",
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    databaseDriverOptions: {
      connection: {
        ssl: false,
      },
    },
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  modules: [
    {
      resolve: path.resolve(__dirname, "./src/modules/dms"),
    },
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [fileProvider],
      },
    },
  ],
});
