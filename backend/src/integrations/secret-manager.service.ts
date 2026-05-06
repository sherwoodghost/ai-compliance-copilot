import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'crypto';

/**
 * SecretManagerService
 *
 * Provides AES-256-GCM envelope encryption for integration credentials.
 * Secrets are NEVER stored in plaintext in the database.
 *
 * Envelope format (base64-encoded JSON):
 *   { iv: <hex>, tag: <hex>, ciphertext: <hex>, version: 1 }
 *
 * Key source: LOCAL_SECRET_ENCRYPTION_KEY env var.
 * Key is SHA-256 hashed to always produce a 32-byte key regardless of input length.
 *
 * Production note: replace the key derivation here with a call to AWS KMS,
 * GCP Cloud KMS, or HashiCorp Vault — the interface stays identical.
 */
@Injectable()
export class SecretManagerService {
  private readonly logger = new Logger(SecretManagerService.name);
  private readonly key: Buffer;
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly ENVELOPE_VERSION = 1;

  constructor(private readonly config: ConfigService) {
    const rawKey = this.config.get<string>('LOCAL_SECRET_ENCRYPTION_KEY') ?? 'dev-insecure-key-change-in-production';
    // SHA-256 the raw key to get a stable 32-byte key
    this.key = createHash('sha256').update(rawKey).digest();

    if (rawKey === 'dev-insecure-key-change-in-production') {
      this.logger.warn('Using default dev encryption key — set LOCAL_SECRET_ENCRYPTION_KEY in production');
    }
  }

  /**
   * Encrypt a credentials object.
   * Returns an opaque base64 envelope suitable for DB storage.
   */
  encrypt(credentials: Record<string, unknown>): string {
    const plaintext = JSON.stringify(credentials);
    const iv = randomBytes(12); // 96-bit IV — recommended for GCM
    const cipher = createCipheriv(this.ALGORITHM, this.key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag(); // 128-bit authentication tag

    const envelope = {
      v: this.ENVELOPE_VERSION,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      ct: ciphertext.toString('hex'),
    };

    return Buffer.from(JSON.stringify(envelope)).toString('base64');
  }

  /**
   * Decrypt an envelope produced by encrypt().
   * Throws if the envelope is tampered with (GCM auth tag verification).
   */
  decrypt(encryptedEnvelope: string): Record<string, unknown> {
    try {
      const envelope = JSON.parse(
        Buffer.from(encryptedEnvelope, 'base64').toString('utf8'),
      ) as { v: number; iv: string; tag: string; ct: string };

      if (envelope.v !== this.ENVELOPE_VERSION) {
        throw new Error(`Unknown envelope version: ${envelope.v}`);
      }

      const iv = Buffer.from(envelope.iv, 'hex');
      const tag = Buffer.from(envelope.tag, 'hex');
      const ciphertext = Buffer.from(envelope.ct, 'hex');

      const decipher = createDecipheriv(this.ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);

      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');

      return JSON.parse(plaintext) as Record<string, unknown>;
    } catch (err: any) {
      this.logger.error(`Failed to decrypt credentials envelope: ${err.message}`);
      throw new Error('Credentials decryption failed — possible tampering or key mismatch');
    }
  }

  /**
   * Check if a value looks like an encrypted envelope (base64 JSON with expected fields).
   * Used to decide whether to decrypt or return as-is (for legacy plaintext rows).
   */
  isEncrypted(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    try {
      const parsed = JSON.parse(
        Buffer.from(value, 'base64').toString('utf8'),
      ) as Record<string, unknown>;
      return parsed.v === this.ENVELOPE_VERSION && 'iv' in parsed && 'ct' in parsed;
    } catch {
      return false;
    }
  }

  /**
   * Safely decrypt — returns empty object on failure instead of throwing.
   * Use for non-critical paths where partial degradation is acceptable.
   */
  safeDecrypt(encryptedEnvelope: unknown): Record<string, unknown> {
    if (!this.isEncrypted(encryptedEnvelope)) {
      // Legacy plaintext credentials — return as-is and log warning
      if (encryptedEnvelope && typeof encryptedEnvelope === 'object') {
        this.logger.warn('Found unencrypted credentials in DB — re-encrypt on next connect');
        return encryptedEnvelope as Record<string, unknown>;
      }
      return {};
    }
    try {
      return this.decrypt(encryptedEnvelope as string);
    } catch {
      return {};
    }
  }
}
