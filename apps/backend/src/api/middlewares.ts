import fs from "node:fs";
import path from "node:path";
import {
  authenticate,
  configureStoreSearch,
  defineMiddlewares,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http";
import { resolveLocalNasRoot } from "../lib/nas-catalog";

import { requireStaffAdmin } from "./middlewares/staff-guard";

const LOCAL_NAS_ROOT = resolveLocalNasRoot();

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

const ALLOWED_STATIC_EXTENSIONS = new Set(Object.keys(MIME_TYPES));

export function serveLocalNasFile(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }

  const rawPath = (req.path || "").replace(/^\/(static|nas)\/?/, "");
  if (!rawPath) {
    return next();
  }

  let decodedRelPath: string;
  try {
    decodedRelPath = decodeURIComponent(rawPath);
  } catch {
    return res.status(400).json({ message: "Invalid static asset path." });
  }

  // Reject null byte injection
  if (decodedRelPath.includes("\0")) {
    return res.status(400).json({ message: "Invalid static asset path." });
  }

  const resolvedBase = path.resolve(LOCAL_NAS_ROOT);
  const targetFile = path.resolve(resolvedBase, decodedRelPath);
  const relative = path.relative(resolvedBase, targetFile);

  // Path traversal check (BE-19)
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return res.status(403).json({ message: "Forbidden asset path." });
  }

  // Reject hidden files and dotfiles (.env, .git, etc.)
  const pathSegments = decodedRelPath.split(/[/\\]/);
  if (pathSegments.some((seg) => seg.startsWith("."))) {
    return res.status(403).json({ message: "Forbidden asset path." });
  }

  const ext = path.extname(targetFile).toLowerCase();
  if (!ALLOWED_STATIC_EXTENSIONS.has(ext)) {
    return res.status(403).json({ message: "Asset extension not permitted." });
  }

  if (!fs.existsSync(targetFile) || !fs.statSync(targetFile).isFile()) {
    return next();
  }

  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

  if (req.method === "HEAD") {
    return res.status(200).end();
  }

  return res.sendFile(targetFile);
}

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    {
      matcher: /^\/(static|nas)\//,
      methods: ["GET", "HEAD"],
      middlewares: [serveLocalNasFile],
    },
    {
      matcher: "/admin/sai-ajanta/products/import/stage",
      methods: ["POST"],
      bodyParser: {
        sizeLimit: "25mb",
      },
    },
    {
      matcher: /^\/admin\/(sai-ajanta|custom)(\/.*)?$/,
      middlewares: [
        authenticate("user", ["session", "bearer", "api-key"], {
          allowUnauthenticated: false,
        }),
        requireStaffAdmin,
      ],
    },
    {
      matcher: "/store/sai-ajanta/seller-resolution",
      methods: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"], {
          allowUnauthenticated: true,
        }),
      ],
    },
    {
      matcher: "/store/sai-ajanta/profile",
      methods: ["GET", "POST", "PATCH"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/sai-ajanta/cart/merge",
      methods: ["POST"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: /^\/store\/sai-ajanta\/cart(\/.*)?$/,
      middlewares: [
        authenticate("customer", ["session", "bearer"], {
          allowUnauthenticated: true,
        }),
      ],
    },
    {
      matcher: /^\/store\/sai-ajanta\/trade(\/.*)?$/,
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/sai-ajanta/orders",
      methods: ["GET", "POST"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/sai-ajanta/orders/*",
      methods: ["GET", "POST", "PATCH"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      method: ["POST"],
      matcher: "/store/search",
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
  ],
});
