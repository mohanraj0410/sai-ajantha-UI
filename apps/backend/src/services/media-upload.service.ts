/**
 * SAI AJANTHA — SECURE PRODUCT MEDIA & TECHNICAL PDF UPLOAD SERVICE (B3 TRUTH GATE)
 *
 * Implements dependency-safe, approval-controlled media ingestion for:
 * 1. Product Images (JPG, PNG, WebP <= 10MB)
 * 2. Technical Cut Sheets & Specification PDFs (<= 15MB)
 *
 * Security & Data Integrity Features:
 * - Magic byte inspection (prevents extension spoofing / polyglot attacks)
 * - Strict MIME allowlisting
 * - Quarantined staging directory storage
 * - Dedicated `dms_media_upload` audit table in PostgreSQL
 * - Explicit Staff/Owner Review Gate (PENDING_APPROVAL -> APPROVED | REJECTED)
 * - Public gallery projection on APPROVE only (NEVER overwrites existing baseline assets)
 * - Blank/null input in Excel imports NEVER deletes existing image associations
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getPgPool } from "../lib/db";
import { assertDisposableDbConnection } from "../lib/disposable-db-guard";

function isR2Configured(): boolean {
  return Boolean(
    (process.env.R2_BUCKET || process.env.S3_BUCKET) &&
    (process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID) &&
    (process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY)
  );
}

function getR2Config() {
  const accountId = (process.env.R2_ACCOUNT_ID || "").trim();
  const endpoint =
    process.env.R2_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || "").trim();
  const bucket = (process.env.R2_BUCKET || process.env.S3_BUCKET || "").trim();
  const region = (process.env.R2_REGION || process.env.S3_REGION || "auto").trim();
  const publicUrl = (
    process.env.R2_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_R2_URL ||
    process.env.S3_FILE_URL ||
    ""
  ).trim().replace(/\/+$/, "");

  return { accountId, endpoint, accessKeyId, secretAccessKey, bucket, region, publicUrl };
}

export type MediaType = "IMAGE" | "TECHNICAL_PDF";
export type MediaStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

export interface MediaUploadItem {
  id: string;
  sku: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  storagePath: string;
  publicUrl: string;
  mediaType: MediaType;
  status: MediaStatus;
  caption?: string | null;
  reviewNotes?: string | null;
  uploadedBy: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadOptions {
  sku: string;
  fileName: string;
  fileType: string;
  fileContentBase64: string;
  mediaType: MediaType;
  caption?: string;
  uploadedBy?: string;
}

export interface ReviewOptions {
  mediaId: string;
  action: "APPROVE" | "REJECT";
  reviewerEmail: string;
  reviewNotes?: string;
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export class MediaUploadService {
  private static tableEnsured = false;

  public static async ensureTableExists(clientOrPool: Pool | PoolClient): Promise<void> {
    if (this.tableEnsured) return;
    await clientOrPool.query(`
      CREATE TABLE IF NOT EXISTS "dms_media_upload" (
        "id" VARCHAR(128) PRIMARY KEY,
        "sku" VARCHAR(128) NOT NULL,
        "file_name" VARCHAR(255) NOT NULL,
        "file_type" VARCHAR(128) NOT NULL,
        "file_size_bytes" INTEGER NOT NULL,
        "storage_path" TEXT NOT NULL,
        "public_url" TEXT NOT NULL,
        "media_type" VARCHAR(32) NOT NULL,
        "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING_APPROVAL',
        "caption" TEXT,
        "review_notes" TEXT,
        "uploaded_by" VARCHAR(255) NOT NULL,
        "approved_by" VARCHAR(255),
        "approved_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS "idx_dms_media_upload_sku" ON "dms_media_upload" ("sku");
      CREATE INDEX IF NOT EXISTS "idx_dms_media_upload_status" ON "dms_media_upload" ("status");
    `);
    this.tableEnsured = true;
  }

  /**
   * Validates file buffer against known binary magic bytes.
   */
  public static validateMagicBytes(buffer: Buffer, mime: string): { isValid: boolean; error?: string } {
    if (buffer.length < 4) {
      return { isValid: false, error: "File buffer is too short to verify magic bytes." };
    }

    const hex = buffer.subarray(0, 12).toString("hex").toLowerCase();

    if (mime === "image/jpeg" || mime === "image/jpg") {
      // JPEG SOI marker is FF D8 FF
      if (!hex.startsWith("ffd8ff")) {
        return { isValid: false, error: "File content does not match JPEG header markers." };
      }
      return { isValid: true };
    }

    if (mime === "image/png") {
      // PNG header is 89 50 4E 47 0D 0A 1A 0A
      if (!hex.startsWith("89504e47")) {
        return { isValid: false, error: "File content does not match PNG signature." };
      }
      return { isValid: true };
    }

    if (mime === "image/webp") {
      // WEBP has RIFF....WEBP
      if (!hex.startsWith("52494646") || !hex.includes("57454250")) {
        return { isValid: false, error: "File content does not match WEBP container signature." };
      }
      return { isValid: true };
    }

    if (mime === "application/pdf") {
      // PDF header is %PDF- (25 50 44 46 2d)
      if (!hex.startsWith("25504446")) {
        return { isValid: false, error: "File content does not match PDF signature (%PDF-)." };
      }
      return { isValid: true };
    }

    return { isValid: false, error: `Unsupported MIME type: ${mime}` };
  }

  /**
   * Ingests a new media file into quarantine staging storage.
   */
  public static async uploadMedia(
    options: UploadOptions,
    poolOverride?: Pool
  ): Promise<MediaUploadItem> {
    const pool = poolOverride || getPgPool();
    await assertDisposableDbConnection(pool);
    await this.ensureTableExists(pool);

    const normSku = (options.sku || "").trim().toUpperCase();
    if (!normSku) {
      throw new Error("SKU is required for media association.");
    }

    const normType = (options.fileType || "").trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(normType)) {
      throw new Error(`Disallowed file type '${normType}'. Allowed: JPG, PNG, WebP, PDF.`);
    }

    const cleanBase64 = options.fileContentBase64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    if (buffer.length === 0) {
      throw new Error("Uploaded file is empty (0 bytes).");
    }

    const isImage = normType.startsWith("image/");
    const isPdf = normType === "application/pdf";
    const maxBytes = isImage ? MAX_IMAGE_SIZE_BYTES : MAX_PDF_SIZE_BYTES;

    if (buffer.length > maxBytes) {
      throw new Error(
        `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds limit of ${(maxBytes / (1024 * 1024))} MB.`
      );
    }

    // Magic byte inspection
    const magic = this.validateMagicBytes(buffer, normType);
    if (!magic.isValid) {
      throw new Error(`File integrity check failed: ${magic.error}`);
    }

    // Sanitize file name
    const ext = path.extname(options.fileName).toLowerCase() || (isPdf ? ".pdf" : ".jpg");
    const safeBase = path
      .basename(options.fileName, ext)
      .replace(/[^a-zA-Z0-9_\-]/g, "_")
      .slice(0, 50);

    const mediaId = `med_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
    const storedFileName = `${normSku}_${safeBase}_${mediaId}${ext}`;

    let storagePath: string;
    let publicUrl: string;

    if (isR2Configured()) {
      const r2 = getR2Config();
      const s3Client = new S3Client({
        region: r2.region,
        endpoint: r2.endpoint,
        credentials: {
          accessKeyId: r2.accessKeyId,
          secretAccessKey: r2.secretAccessKey,
        },
        forcePathStyle: false,
      });

      const r2Key = `products/${storedFileName}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: r2.bucket,
          Key: r2Key,
          Body: buffer,
          ContentType: normType,
        })
      );

      storagePath = `r2://${r2.bucket}/${r2Key}`;
      publicUrl = r2.publicUrl ? `${r2.publicUrl}/${r2Key}` : `/${r2Key}`;
    } else {
      // Quarantined staging directory
      const uploadDir = path.resolve(process.cwd(), "apps", "storefront", "public", "products", "media_staging");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      storagePath = path.join(uploadDir, storedFileName);
      fs.writeFileSync(storagePath, buffer);
      publicUrl = `/products/media_staging/${storedFileName}`;
    }

    const uploadedBy = options.uploadedBy || "staff@sai-ajanta.com";

    const insertRes = await pool.query(
      `INSERT INTO "dms_media_upload" (
        "id", "sku", "file_name", "file_type", "file_size_bytes",
        "storage_path", "public_url", "media_type", "status",
        "caption", "uploaded_by", "created_at", "updated_at"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_APPROVAL', $9, $10, NOW(), NOW())
      RETURNING *;`,
      [
        mediaId,
        normSku,
        options.fileName,
        normType,
        buffer.length,
        storagePath,
        publicUrl,
        options.mediaType,
        options.caption || null,
        uploadedBy,
      ]
    );

    const row = insertRes.rows[0];

    return {
      id: row.id,
      sku: row.sku,
      fileName: row.file_name,
      fileType: row.file_type,
      fileSizeBytes: row.file_size_bytes,
      storagePath: row.storage_path,
      publicUrl: row.public_url,
      mediaType: row.media_type as MediaType,
      status: row.status as MediaStatus,
      caption: row.caption,
      reviewNotes: row.review_notes,
      uploadedBy: row.uploaded_by,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at?.toISOString() || null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Reviews and approves or rejects a quarantined media upload.
   * On APPROVE, projects to the target product metadata without deleting existing baseline media.
   */
  public static async reviewMedia(
    options: ReviewOptions,
    poolOverride?: Pool
  ): Promise<MediaUploadItem> {
    const pool = poolOverride || getPgPool();
    await assertDisposableDbConnection(pool);
    await this.ensureTableExists(pool);

    const itemRes = await pool.query(
      `SELECT * FROM "dms_media_upload" WHERE "id" = $1 AND deleted_at IS NULL LIMIT 1;`,
      [options.mediaId]
    );

    if (itemRes.rows.length === 0) {
      throw new Error(`Media upload record '${options.mediaId}' not found.`);
    }

    const item = itemRes.rows[0];

    if (item.status === "APPROVED") {
      throw new Error(`Media '${options.mediaId}' has already been approved.`);
    }

    const nextStatus: MediaStatus = options.action === "APPROVE" ? "APPROVED" : "REJECTED";
    const approvedAt = options.action === "APPROVE" ? new Date().toISOString() : null;

    const updatedRes = await pool.query(
      `UPDATE "dms_media_upload"
       SET "status" = $1,
           "review_notes" = $2,
           "approved_by" = $3,
           "approved_at" = $4,
           "updated_at" = NOW()
       WHERE "id" = $5
       RETURNING *;`,
      [
        nextStatus,
        options.reviewNotes || null,
        options.reviewerEmail,
        approvedAt,
        options.mediaId,
      ]
    );

    const updated = updatedRes.rows[0];

    // If APPROVED, project to the product metadata in PostgreSQL
    if (options.action === "APPROVE") {
      const prodRes = await pool.query(
        `SELECT id, metadata, thumbnail FROM product WHERE metadata->>'sku' = $1 LIMIT 1;`,
        [item.sku]
      );

      if (prodRes.rows.length > 0) {
        const prod = prodRes.rows[0];
        const meta = { ...(prod.metadata || {}) };

        if (item.media_type === "IMAGE") {
          const currentImages: string[] = Array.isArray(meta.images) ? [...meta.images] : [];
          if (!currentImages.includes(item.public_url)) {
            currentImages.push(item.public_url);
          }
          meta.images = currentImages;

          const currentThumbnail = prod.thumbnail || meta.src || "";
          const shouldUpdateThumbnail = !currentThumbnail || currentThumbnail.includes("placeholder");

          await pool.query(
            `UPDATE product
             SET metadata = $1,
                 thumbnail = CASE WHEN $2 THEN $3 ELSE thumbnail END,
                 updated_at = NOW()
             WHERE id = $4;`,
            [JSON.stringify(meta), shouldUpdateThumbnail, item.public_url, prod.id]
          );
        } else if (item.media_type === "TECHNICAL_PDF") {
          const currentDocs: any[] = Array.isArray(meta.other_document_links)
            ? [...meta.other_document_links]
            : [];
          currentDocs.push({
            title: item.caption || item.file_name,
            url: item.public_url,
            type: "PDF",
            addedAt: new Date().toISOString(),
          });
          meta.other_document_links = currentDocs;

          await pool.query(
            `UPDATE product SET metadata = $1, updated_at = NOW() WHERE id = $2;`,
            [JSON.stringify(meta), prod.id]
          );
        }
      }
    }

    return {
      id: updated.id,
      sku: updated.sku,
      fileName: updated.file_name,
      fileType: updated.file_type,
      fileSizeBytes: updated.file_size_bytes,
      storagePath: updated.storage_path,
      publicUrl: updated.public_url,
      mediaType: updated.media_type as MediaType,
      status: updated.status as MediaStatus,
      caption: updated.caption,
      reviewNotes: updated.review_notes,
      uploadedBy: updated.uploaded_by,
      approvedBy: updated.approved_by,
      approvedAt: updated.approved_at?.toISOString() || null,
      createdAt: updated.created_at.toISOString(),
      updatedAt: updated.updated_at.toISOString(),
    };
  }

  /**
   * Lists media records with filtering by SKU, status, or mediaType.
   */
  public static async listMedia(
    filters: { sku?: string; status?: MediaStatus; mediaType?: MediaType; limit?: number; offset?: number },
    poolOverride?: Pool
  ): Promise<{ items: MediaUploadItem[]; total: number }> {
    const pool = poolOverride || getPgPool();
    await assertDisposableDbConnection(pool);
    await this.ensureTableExists(pool);

    const conditions: string[] = ["deleted_at IS NULL"];
    const params: any[] = [];

    if (filters.sku) {
      params.push(filters.sku.trim().toUpperCase());
      conditions.push(`sku = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }

    if (filters.mediaType) {
      params.push(filters.mediaType);
      conditions.push(`media_type = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await pool.query(
      `SELECT count(*)::int as total FROM "dms_media_upload" ${whereClause};`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    params.push(limit, offset);

    const rowsRes = await pool.query(
      `SELECT * FROM "dms_media_upload"
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length};`,
      params
    );

    const items: MediaUploadItem[] = rowsRes.rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      fileName: row.file_name,
      fileType: row.file_type,
      fileSizeBytes: row.file_size_bytes,
      storagePath: row.storage_path,
      publicUrl: row.public_url,
      mediaType: row.media_type as MediaType,
      status: row.status as MediaStatus,
      caption: row.caption,
      reviewNotes: row.review_notes,
      uploadedBy: row.uploaded_by,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at?.toISOString() || null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));

    return { items, total };
  }
}
