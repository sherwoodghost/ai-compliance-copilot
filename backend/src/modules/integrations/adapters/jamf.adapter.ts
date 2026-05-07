import { Injectable, Logger } from '@nestjs/common';
import { IntegrationAdapter, IntegrationEvidence, IntegrationTestResult } from './integration.interface';

/**
 * JamfAdapter
 *
 * Connects to Jamf Pro via username + password (Basic Auth for token exchange).
 * Supports Jamf Cloud (https://yourorg.jamfcloud.com) and self-hosted.
 *
 * Evidence collected:
 * - CC6.7  Encryption at Rest: disk encryption (FileVault/BitLocker) compliance
 * - A.8.1  Asset Management: managed device inventory + OS versions
 * - CC6.8  Malware Protection: endpoint protection status
 */
@Injectable()
export class JamfAdapter implements IntegrationAdapter {
  readonly provider = 'jamf';
  private readonly logger = new Logger(JamfAdapter.name);

  private cleanUrl(url: string) {
    return url.replace(/\/$/, '');
  }

  private async getToken(baseUrl: string, username: string, password: string): Promise<string | null> {
    try {
      const res = await fetch(`${baseUrl}/api/v1/auth/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) return null;
      const data = await res.json() as any;
      return data.token ?? null;
    } catch {
      return null;
    }
  }

  async testConnection(credentials: Record<string, unknown>): Promise<IntegrationTestResult> {
    const { url, username, password } = credentials as Record<string, string>;
    if (!url || !username || !password) {
      return { connected: false, error: 'Missing url, username, or password' };
    }

    const baseUrl = this.cleanUrl(url);

    try {
      const token = await this.getToken(baseUrl, username, password);
      if (!token) {
        // Try legacy Classic API auth check
        const res = await fetch(`${baseUrl}/JSSResource/accounts/username/${username}`, {
          headers: {
            Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
            Accept: 'application/json',
          },
        });

        if (!res.ok) {
          return { connected: false, error: `Authentication failed (HTTP ${res.status})` };
        }
        return { connected: true, details: { authMethod: 'basic', url: baseUrl } };
      }

      return { connected: true, details: { authMethod: 'token', url: baseUrl } };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  async collectEvidence(credentials: Record<string, unknown>): Promise<IntegrationEvidence[]> {
    const { url, username, password } = credentials as Record<string, string>;
    const baseUrl = this.cleanUrl(url);
    const evidence: IntegrationEvidence[] = [];
    const token = await this.getToken(baseUrl, username, password);

    const hdrs: Record<string, string> = token
      ? { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      : {
          Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
          Accept: 'application/json',
        };

    try {
      // ── A.8.1: Managed computer inventory ────────────────────────────────────
      const computersRes = await fetch(
        `${baseUrl}/JSSResource/computers`,
        { headers: hdrs },
      );

      if (computersRes.ok) {
        const data = await computersRes.json() as any;
        const computers = data.computers ?? [];

        evidence.push({
          controlCode: 'A.8.1',
          title: 'Jamf Managed Device Inventory',
          data: {
            totalManagedDevices: computers.length,
            sampleDevices: computers.slice(0, 10).map((c: any) => ({
              id: c.id,
              name: c.name,
              serialNumber: c.serial_number,
            })),
            collectedAt: new Date().toISOString(),
            note: 'Managed endpoint inventory evidencing asset management controls',
          },
          collectedAt: new Date(),
        });
      }

      // ── CC6.7: Disk encryption (FileVault) status ─────────────────────────────
      // Use Jamf Pro API v1 for disk encryption reporting
      const diskEncRes = await fetch(
        `${baseUrl}/api/v1/disk-encryption`,
        { headers: hdrs },
      );

      if (diskEncRes.ok) {
        const diskData = await diskEncRes.json() as any;
        evidence.push({
          controlCode: 'CC6.7',
          title: 'Jamf FileVault Disk Encryption Compliance',
          data: {
            ...(diskData as object),
            collectedAt: new Date().toISOString(),
            note: 'Disk encryption (FileVault) status for managed macOS devices',
          },
          collectedAt: new Date(),
        });
      } else {
        // Fallback: check computer management framework settings
        const mgmtRes = await fetch(
          `${baseUrl}/JSSResource/diskencryption`,
          { headers: hdrs },
        );
        if (mgmtRes.ok) {
          const mgmt = await mgmtRes.json() as any;
          evidence.push({
            controlCode: 'CC6.7',
            title: 'Jamf Disk Encryption Configuration',
            data: {
              config: mgmt,
              collectedAt: new Date().toISOString(),
              note: 'Disk encryption configuration in Jamf Pro',
            },
            collectedAt: new Date(),
          });
        }
      }

      // ── CC6.8: Policy summary (malware protection indicator) ─────────────────
      const policiesRes = await fetch(
        `${baseUrl}/JSSResource/policies`,
        { headers: hdrs },
      );

      if (policiesRes.ok) {
        const polData = await policiesRes.json() as any;
        const policies = polData.policies ?? [];

        evidence.push({
          controlCode: 'CC6.8',
          title: 'Jamf Policy Configuration — Endpoint Compliance',
          data: {
            totalPolicies: policies.length,
            samplePolicies: policies.slice(0, 10).map((p: any) => ({
              id: p.id,
              name: p.name,
            })),
            collectedAt: new Date().toISOString(),
            note: 'Jamf endpoint policies evidencing MDM-enforced compliance controls',
          },
          collectedAt: new Date(),
        });
      }

      this.logger.log(`Jamf: collected ${evidence.length} evidence items from ${baseUrl}`);
    } catch (err: any) {
      this.logger.error(`Jamf evidence collection failed: ${err.message}`);
    }

    return evidence;
  }
}
