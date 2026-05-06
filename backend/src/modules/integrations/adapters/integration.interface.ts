export interface IntegrationTestResult {
  connected: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

export interface IntegrationEvidence {
  controlCode: string;
  title: string;
  data: Record<string, unknown>;
  collectedAt: Date;
}

export interface IntegrationAdapter {
  readonly provider: string;
  testConnection(credentials: Record<string, unknown>): Promise<IntegrationTestResult>;
  collectEvidence(credentials: Record<string, unknown>): Promise<IntegrationEvidence[]>;
}
