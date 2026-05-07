import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as path from 'path';

export interface UploadResult {
  url: string;
  key: string;
  contentHash: string;
  bucket: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null = null;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('storage.aws.bucket') ?? '';
    this.region = this.config.get<string>('storage.aws.region') ?? 'us-east-1';

    const accessKeyId = this.config.get<string>('storage.aws.accessKeyId');
    const secretAccessKey = this.config.get<string>('storage.aws.secretAccessKey');

    if (this.bucket && accessKeyId && secretAccessKey) {
      this.s3 = new S3Client({
        region: this.region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log(`S3 storage initialized (bucket: ${this.bucket})`);
    } else {
      this.logger.warn(
        'S3 not configured — file uploads will use URL-only mode. ' +
        'Set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY to enable.',
      );
    }
  }

  get isConfigured(): boolean {
    return this.s3 !== null && !!this.bucket;
  }

  /**
   * Upload a file to S3.
   * Returns { url, key, contentHash, bucket }.
   * If S3 is not configured, returns a placeholder URL so the app still works.
   */
  async upload(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    orgId: string,
  ): Promise<UploadResult> {
    const contentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const ext = path.extname(originalName) || '';
    // e.g. evidence/org-abc123/2024/05/a1b2c3d4.pdf
    const key = `evidence/${orgId}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${contentHash.slice(0, 8)}${ext}`;

    if (!this.s3 || !this.bucket) {
      // S3 not configured — return a placeholder so the rest of the flow still works
      this.logger.warn(`S3 not configured; skipping actual upload for ${originalName}`);
      return {
        url: `https://placeholder-storage.local/${key}`,
        key,
        contentHash,
        bucket: 'not-configured',
      };
    }

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: fileBuffer,
          ContentType: mimeType,
          ContentLength: fileBuffer.length,
          Metadata: {
            orgId,
            originalName,
            contentHash,
          },
        }),
      );

      const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
      this.logger.log(`Uploaded ${originalName} → s3://${this.bucket}/${key}`);

      return { url, key, contentHash, bucket: this.bucket };
    } catch (err: any) {
      this.logger.error(`S3 upload failed: ${err.message}`, err.stack);
      throw new InternalServerErrorException(`File upload failed: ${err.message}`);
    }
  }

  /**
   * Delete a file from S3 by its key.
   */
  async delete(key: string): Promise<void> {
    if (!this.s3 || !this.bucket) {
      this.logger.warn(`S3 not configured; skipping delete for key ${key}`);
      return;
    }

    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      this.logger.log(`Deleted s3://${this.bucket}/${key}`);
    } catch (err: any) {
      this.logger.error(`S3 delete failed: ${err.message}`, err.stack);
      throw new InternalServerErrorException(`File delete failed: ${err.message}`);
    }
  }

  /**
   * Generate a presigned GET URL (default 1 hour expiry).
   * If S3 not configured, returns the raw URL unchanged.
   */
  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!this.s3 || !this.bucket) {
      return `https://placeholder-storage.local/${key}`;
    }

    try {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      return await getSignedUrl(this.s3, command, { expiresIn });
    } catch (err: any) {
      this.logger.error(`Presign failed for key ${key}: ${err.message}`);
      throw new InternalServerErrorException(`Could not generate download URL: ${err.message}`);
    }
  }
}
