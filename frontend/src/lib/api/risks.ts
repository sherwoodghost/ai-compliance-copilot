import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLikelihood =
  | 'rare'
  | 'unlikely'
  | 'possible'
  | 'likely'
  | 'almost_certain';

export type RiskImpact =
  | 'negligible'
  | 'minor'
  | 'moderate'
  | 'major'
  | 'catastrophic';

export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';
export type RiskStatus    = 'open' | 'mitigated' | 'accepted';

export type TreatmentType = 'mitigate' | 'accept' | 'transfer' | 'avoid';

export interface RiskTreatment {
  id:                   string;
  treatmentType:        TreatmentType;
  treatmentDescription: string;
  status:               string;
  targetCompletionDate?: string | null;
  residualRiskAfter?:    string | null;
  acceptedAt?:           string | null;
  completedAt?:          string | null;
  createdAt:             string;
}

export interface Risk {
  id:               string;
  title:            string;
  description:      string;       // HTML
  likelihood:       RiskLikelihood;
  impact:           RiskImpact;
  riskScore:        number;
  severity:         RiskSeverity;
  status:           RiskStatus;
  mitigationAdvice?: string | null;
  riskTreatments:   RiskTreatment[];
  createdAt:        string;
  updatedAt:        string;
}

export interface RiskStats {
  total:     number;
  open:      number;
  highRisks: number;
  mitigated: number;
  accepted:  number;
}

export interface ExposureArea {
  area:      string;
  riskCount: number;
  concern:   string;
}

export interface MitigationStrategy {
  title:       string;
  type:        string;
  effort:      string;
  description: string;
}

export interface PerRiskAdvice {
  executiveSummary?:     string;
  quickWin?:             string;
  mitigationStrategies?: MitigationStrategy[];
}

export interface PortfolioStats {
  total:     number;
  critical:  number;
  high:      number;
  open:      number;
  mitigated: number;
  accepted:  number;
  unowned:   number;
}

export interface PortfolioAnalysis {
  stats:                  PortfolioStats;
  overallRiskRating:      string;
  executiveSummary:       string;
  topExposureAreas:       ExposureArea[];
  systemicPatterns:       string[];
  criticalUntreated:      string[];
  quickWins:              string[];
  boardRecommendations:   string[];
  riskAppetiteAssessment: string;
  generatedAt:            string;
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateRiskDto {
  title:            string;
  description?:     string;
  likelihood:       RiskLikelihood;
  impact:           RiskImpact;
  owner?:           string;
  mitigationAdvice?: string;
}

export interface AddTreatmentDto {
  treatmentType:        TreatmentType;
  treatmentDescription: string;
  residualRiskAfter?:   string;
  targetCompletionDate?: string;
}

// ─── API client ───────────────────────────────────────────────────────────────

export const risksApi = {
  /** List all risks for the org */
  list(): Promise<Risk[]> {
    return apiClient.get<Risk[]>('/risks').then((r) => r.data);
  },

  /** Get aggregate risk stats */
  getStats(): Promise<RiskStats> {
    return apiClient.get<RiskStats>('/risks/stats').then((r) => r.data);
  },

  /** Create a new risk */
  create(dto: CreateRiskDto): Promise<Risk> {
    return apiClient.post<Risk>('/risks', dto).then((r) => r.data);
  },

  /** Request AI mitigation advice for a specific risk */
  getAiAdvice(id: string): Promise<PerRiskAdvice> {
    return apiClient.post<PerRiskAdvice>(`/risks/${id}/ai-advice`, {}).then((r) => r.data);
  },

  /** Add a treatment decision (mitigate / accept / transfer / avoid) */
  addTreatment(id: string, dto: AddTreatmentDto): Promise<RiskTreatment> {
    return apiClient.post<RiskTreatment>(`/risks/${id}/treatments`, dto).then((r) => r.data);
  },

  /** Sign off acceptance treatment */
  acceptTreatment(riskId: string, treatmentId: string): Promise<RiskTreatment> {
    return apiClient
      .patch<RiskTreatment>(`/risks/${riskId}/treatments/${treatmentId}/accept`, {})
      .then((r) => r.data);
  },

  /** Mark mitigate treatment as complete */
  completeTreatment(riskId: string, treatmentId: string): Promise<RiskTreatment> {
    return apiClient
      .patch<RiskTreatment>(`/risks/${riskId}/treatments/${treatmentId}/complete`, {})
      .then((r) => r.data);
  },

  /** AI-generate risks from control gaps (ISO gap analysis) */
  generateFromGaps(): Promise<{ created: number; risks: Risk[] }> {
    return apiClient
      .post<{ created: number; risks: Risk[] }>('/risks/generate-from-gaps', {})
      .then((r) => r.data);
  },

  /** Run AI portfolio-level risk analysis across all org risks */
  portfolioAnalysis(): Promise<PortfolioAnalysis> {
    return apiClient
      .post<PortfolioAnalysis>('/risks/ai-portfolio-analysis', {})
      .then((r) => r.data);
  },
};
