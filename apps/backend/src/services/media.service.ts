import fs from "node:fs";
import path from "node:path";

export interface MediaResolutionResult {
  allowed: boolean;
  filePath?: string;
  mimeType?: string;
  statusCode: number;
  errorMessage?: string;
}

export class MediaService {
  private static readonly MIME_MAP: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".svg": "image/svg+xml",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
  };

  /**
   * Resolves the authoritative public NAS media root directory from environment variables,
   * falling back to local monorepo directory candidates.
   */
  static getPublicMediaRoot(): string {
    const envRoot =
      process.env.NAS_PUBLIC_MEDIA_ROOT ||
      process.env.LOCAL_NAS_DIR;

    if (envRoot) {
      const resolved = path.resolve(process.cwd(), envRoot);
      if (fs.existsSync(resolved)) return resolved;
    }

    // Relative candidates within repo
    const candidates = [
      path.resolve(process.cwd(), "local-nas"),
      path.resolve(process.cwd(), "../local-nas"),
      path.resolve(process.cwd(), "../../local-nas"),
      path.resolve(process.cwd(), "../../../local-nas"),
      path.resolve(process.cwd(), "../../../../local-nas"),
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }

    return candidates[0];
  }

  /**
   * Resolves the secure private documents directory (invoices, KYC, seller uploads).
   */
  static getPrivateMediaRoot(): string {
    const envRoot = process.env.NAS_PRIVATE_ROOT;
    if (envRoot) {
      const resolved = path.resolve(process.cwd(), envRoot);
      if (fs.existsSync(resolved)) return resolved;
    }
    return path.resolve(this.getPublicMediaRoot(), "private");
  }

  /**
   * Validates and resolves a requested public static asset path.
   * Enforces strict protection against path traversal, null bytes, dotfiles, and private roots.
   */
  static resolvePublicAsset(requestPath: string): MediaResolutionResult {
    const raw = (requestPath || "").replace(/^\/(static|nas)\/?/, "");
    if (!raw) {
      return { allowed: false, statusCode: 400, errorMessage: "Missing asset path." };
    }

    // 1. Decode URL path safely
    let decoded: string;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      return { allowed: false, statusCode: 400, errorMessage: "Invalid URL encoding." };
    }

    // 2. Reject null byte injection
    if (decoded.includes("\0")) {
      return { allowed: false, statusCode: 400, errorMessage: "Null byte injection prohibited." };
    }

    // 3. Reject dotfiles and hidden files (.env, .git, etc.)
    const segments = decoded.split(/[/\\]/);
    if (segments.some((seg) => seg.startsWith("."))) {
      return { allowed: false, statusCode: 403, errorMessage: "Forbidden asset path." };
    }

    // 4. Resolve against public root and enforce path containment (no directory traversal)
    const publicRoot = path.resolve(this.getPublicMediaRoot());
    const targetPath = path.resolve(publicRoot, decoded);
    const relative = path.relative(publicRoot, targetPath);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return { allowed: false, statusCode: 403, errorMessage: "Forbidden asset path." };
    }

    // 5. Prohibit access to private directory from public endpoint
    const privateRoot = path.resolve(this.getPrivateMediaRoot());
    const relativeToPrivate = path.relative(privateRoot, targetPath);
    if (!relativeToPrivate.startsWith("..") && !path.isAbsolute(relativeToPrivate)) {
      return {
        allowed: false,
        statusCode: 403,
        errorMessage: "Private documents cannot be accessed via public static endpoint.",
      };
    }

    // 6. Validate file extension against allowlist
    const ext = path.extname(targetPath).toLowerCase();
    const mimeType = this.MIME_MAP[ext];
    if (!mimeType) {
      return { allowed: false, statusCode: 403, errorMessage: "Forbidden asset path." };
    }

    // 7. Verify file existence
    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
      return { allowed: false, statusCode: 404, errorMessage: "Asset not found." };
    }

    return {
      allowed: true,
      filePath: targetPath,
      mimeType,
      statusCode: 200,
    };
  }
}
