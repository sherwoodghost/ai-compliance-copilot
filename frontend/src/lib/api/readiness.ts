import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReadinessBreakdown {
  category:    string;
  score:       number;
  total:       number;
  implemented: number;
  [key: string]: unknown;
}

/** Full readiness score object returned by /readiness/breakdown — richer than ReadinessScore */
export type ReadinessReport = {
  overall:        number;
  overallGrade?:  string;
  formulaVersion?: string;
  // Breakdown is an object with category scores (controlDesign, evidence, policy, operational, etc.)
  breakdown?:     Record<string, number> & Record<string, unknown>;
  soc2?:          any;
  iso27001?:      any;
  [key: string]:  unknown;
};

export interface ReadinessHistoryEntry {
  date:  string;
  score: number;
  [key: string]: unknown;
}

export interface ReadinessVelocity {
  trend:      'up' | 'down' | 'flat';
  delta:      number;
  periodDays: number;
  [key: string]: unknown;
}

export interface ReadinessBenchmark {
  industry:     string;
  avgScore:     number;
  percentile:   number;
  [key: string]: unknown;
}

export interface ReadinessScore {
  score:            number;
  implemented:      number;
  total:            number;
  [key: string]: unknown;
}

export interface ReadinessCoachResult {
  recommendations: string[];
  priority:        string;
  [key: string]: unknown;
}

export interface ReadinessDigest {
  digest:      string;
  generatedAt: string;
  [key: string]: unknown;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const readinessApi = {
  /** Current readiness score */
  getScore: (): Promise<ReadinessScore> =>
    apiClient.get('/readiness/score').then((r) => r.data),

  /** Category breakdown of readiness — returns the full readiness report object */
  getBreakdown: (): Promise<ReadinessReport> =>
    apiClient.get('/readiness/breakdown').then((r) => r.data),

  /** Historical score data */
  getHistory: (limit = 10): Promise<ReadinessHistoryEntry[]> =>
    apiClient.get(`/readiness/history?limit=${limit}`).then((r) => r.data),

  /** Score velocity (trend over time) — returns a rich object with forecast, velocity, summary */
  getVelocity: (): Promise<Record<string, any>> =>
    apiClient.get('/readiness/velocity').then((r) => r.data),

  /** Industry benchmark comparison */
  getBenchmark: (): Promise<ReadinessBenchmark> =>
    apiClient.get('/readiness/benchmark').then((r) => r.data),

  /** Trigger a readiness score recalculation */
  recalculate: (): Promise<ReadinessScore> =>
    apiClient.post('/readiness/recalculate').then((r) => r.data),

  /** Get AI coaching recommendations */
  aiCoach: (): Promise<ReadinessCoachResult> =>
    apiClient.post('/readiness/coach').then((r) => r.data),

  /** Generate and optionally email a readiness digest */
  generateDigest: (email = false): Promise<ReadinessDigest> =>
    apiClient.post(`/readiness/digest${email ? '?email=true' : ''}`, {}).then((r) => r.data),

  /** Get dashboard configuration (alerts, recommended actions) */
  getDashboardConfig: (role: string): Promise<{ alerts: unknown[]; recommendedActions: unknown[]; [key: string]: unknown }> =>
    apiClient.get(`/dashboard/config?role=${role}`).then((r) => r.data),
};
