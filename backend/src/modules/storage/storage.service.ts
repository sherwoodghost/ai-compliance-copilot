import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadResult {
  key:  string;
  url:  string;
}

/**
 * StorageService — S3-compatible object storage abstraction.
 * Supports AWS S3, Cloudflare R2, and any S3-compatible provider via env config.
 *
 * Key naming convention:
 *   documents/{orgId}/{documentId}/v{version}/{filename}
 *   evidence/{orgId}/{evidenceId}/{filename}
 *   imports/{orgId}/temp/{jobId}/{filename}   ← deleted after processing
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly enabled: boolean;

  constructor() {
    const provider  = process.env.STORAGE_PROVIDER ?? 'local';
    this.bucket     = process.env.STORAGE_BUCKET   ?? 'compliance-docs';
    this.enabled    = provider !== 'local';

    if (this.enabled) {
      this.client = new S3Client({
        region:   process.env.AWS_REGION ?? 'auto',
        endpoint: process.env.STORAGE_ENDPOINT, // R2: https://<accountId>.r2.cloudflarestorage.com
        credentials: {
          accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        },
      });
    } else {
      this.client = null;
      this.logger.warn('StorageService running in local/stub mode (STORAGE_PROVIDER=local)');
    }
  }

  /** Upload a file and return its storage key */
  async upload(
    key:      string,
    buffer:   Buffer,
    mimeType: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    if (!this.client) return key; // local stub

    await this.client.send(new PutObjectCommand({
      Bucket:      this.bucket,
      Key:         key,
      Body:        buffer,
      ContentType: mimeType,
      Metadata:    metadata,
    }));

    return key;
  }

  /** Generate a pre-signed GET URL (default: 1 hour) */
  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    if (!this.client) return `/storage/${key}`; // local stub

    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  /** Delete a file */
  async delete(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /** Check if a file exists */
  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  /** Build an org-scoped document key */
  documentKey(orgId: string, documentId: string, version: number, filename: string): string {
    return `documents/${orgId}/${documentId}/v${version}/${filename}`;
  }

  /** Build a temp import key (cleaned up after processing) */
  importKey(orgId: string, jobId: string, filename: string): string {
    return `imports/${orgId}/temp/${jobId}/${filename}`;
  }

  /** Build a staging key for bulk ingestion files */
  ingestionKey(orgId: string, batchId: string, filename: string): string {
    return `ingestion/${orgId}/batch-${batchId}/${filename}`;
  }

  /**
   * Verify that a storage key belongs to the given org.
   * Throws ForbiddenException if the key doesn't start with any of the org-scoped prefixes.
   * All ingestion workers MUST call this before reading or writing files.
   */
  assertOrgOwnership(orgId: string, key: string): void {
    const allowedPrefixes = [
      `documents/${orgId}/`,
      `evidence/${orgId}/`,
      `imports/${orgId}/`,
      `ingestion/${orgId}/`,
    ];
    const owned = allowedPrefixes.some((prefix) => key.startsWith(prefix));
    if (!owned) {
      throw new ForbiddenException(
        `Storage key '${key}' does not belong to org '${orgId}'. Tenant isolation violation.`,
      );
    }
  }
}
