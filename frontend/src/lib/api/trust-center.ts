import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrustCenter {
  id:           string;
  orgId:        string;
  slug:         string;
  isPublic:     boolean;
  companyName:  string;
  logoUrl:      string | null;
  primaryColor: string;
  headline:     string;
  description:  string;
  showControls: boolean;
  showEvidence: boolean;
  publishedAt:  string | null;
  updatedAt:    string;
  createdAt:    string;
}

export interface TrustCenterAccessLink {
  id:            string;
  trustCenterId: string;
  token:         string;
  label:         string;
  expiresAt:     string | null;
  viewCount:     number;
  createdAt:     string;
}

export interface TrustCenterPassRate {
  total:    number;
  pass:     number;
  fail:     number;
  skipped:  number;
  passRate: number;
}

export interface UpdateTrustCenterDto {
  companyName?:  string;
  logoUrl?:      string | null;
  primaryColor?: string;
  headline?:     string;
  description?:  string;
  showControls?: boolean;
  showEvidence?: boolean;
}

export interface CreateAccessLinkDto {
  label:          string;
  expiresInDays?: number;
}

export interface SecurityFaqItem {
  question: string;
  answer:   string;
}

export interface TrustCenterCheck {
  id:          string;
  name:        string;
  description: string;
  status:      'pass' | 'fail' | 'warning' | 'skip';
  category:    string;
  controlCode?: string;
  checkedAt:   string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const trustCenterApi = {
  /** Get (or lazily create) this org's trust center settings */
  get: (): Promise<TrustCenter> =>
    apiClient.get('/trust-center').then((r) => r.data),

  /** Update branding / content / visibility settings */
  update: (dto: UpdateTrustCenterDto): Promise<TrustCenter> =>
    apiClient.patch('/trust-center', dto).then((r) => r.data),

  /** Make the trust center publicly visible */
  publish: (): Promise<TrustCenter> =>
    apiClient.post('/trust-center/publish').then((r) => r.data),

  /** Hide the trust center from public view */
  unpublish: (): Promise<TrustCenter> =>
    apiClient.post('/trust-center/unpublish').then((r) => r.data),

  /** Current control-test pass rate */
  getPassRate: (): Promise<TrustCenterPassRate> =>
    apiClient.get('/trust-center/pass-rate').then((r) => r.data),

  /** List all private shareable access links */
  listLinks: (): Promise<TrustCenterAccessLink[]> =>
    apiClient.get('/trust-center/links').then((r) => r.data),

  /** Create a new private access link */
  createLink: (dto: CreateAccessLinkDto): Promise<TrustCenterAccessLink> =>
    apiClient.post('/trust-center/links', dto).then((r) => r.data),

  /** AI-generate a security FAQ for the trust center */
  aiSecurityFaq: (): Promise<SecurityFaqItem[]> =>
    apiClient.post('/trust-center/ai-security-faq').then((r) => r.data),

  /** Get automated compliance checks for the trust center */
  getChecks: (): Promise<TrustCenterCheck[]> =>
    apiClient.get('/trust-center/checks').then((r) => r.data),
};
