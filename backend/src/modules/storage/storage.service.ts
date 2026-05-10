import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('STORAGE_REGION', 'us-east-1');
    const endpoint = this.config.get<string>('STORAGE_ENDPOINT'); // MinIO / R2 / LocalStack
    const accessKeyId = this.config.get<string>('STORAGE_ACCESS_KEY_ID', '');
    const secretAccessKey = this.config.get<string>('STORAGE_SECRET_ACCESS_KEY', '');
    this.bucket = this.config.get<string>('STORAGE_BUCKET', 'compliance-copilot');

    this.s3 = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      ...(accessKeyId
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  // ── Upload ──────────────────────────────────────────────────────────────────

  async upload(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    this.logger.debug(`Uploaded ${key} (${buffer.length} bytes)`);
  }

  // ── Download ────────────────────────────────────────────────────────────────

  async download(key: string): Promise<Buffer> {
    const resp = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const stream = resp.Body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  // ── Signed URL ──────────────────────────────────────────────────────────────

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  // ── Key Generators ──────────────────────────────────────────────────────────

  ingestionKey(orgId: string, batchId: string, filename: string): string {
    return `orgs/${orgId}/ingestion/${batchId}/${filename}`;
  }

  documentKey(orgId: string, documentId: string, filename: string): string {
    return `orgs/${orgId}/documents/${documentId}/${filename}`;
  }

  // ── Tenant Isolation ────────────────────────────────────────────────────────

  assertOrgOwnership(orgId: string, key: string): void {
    if (!key.startsWith(`orgs/${orgId}/`)) {
      throw new Error(
        `Tenant isolation violation: org ${orgId} cannot access key ${key}`,
      );
    }
  }
}
