/**
 * Settings API — typed client for user profile, organization settings,
 * LLM configuration, retention settings, and auth operations.
 */

import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id:        string;
  email:     string;
  fullName:  string;
  role:      string;
  orgId:     string;
  createdAt: string;
}

export interface Organization {
  id:           string;
  name:         string;
  industry?:    string;
  country?:     string;
  employeeSize?: string;
  frameworks?:  string[];
  settings?:    Record<string, unknown>;
  createdAt:    string;
  [key: string]: unknown;
}

export interface LlmSettings {
  provider?:    string;
  model?:       string;
  orgApiKey?:   string;
  hasApiKey?:   boolean;
  hasKey?:      boolean;      // alias used by some endpoints
  keyMasked?:   string | null;
  [key: string]: unknown;
}

export interface RetentionSettings {
  documentRetentionDays: number;
  evidenceRetentionDays: number;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword:     string;
}

export interface SsoConfig {
  id?:                  string;
  orgId?:               string;
  provider?:            string;
  idpEntityId?:         string | null;
  idpSsoUrl?:           string | null;
  idpCertificate?:      string | null;   // '[configured]' when set, null otherwise
  emailAttribute?:      string;
  firstNameAttribute?:  string;
  lastNameAttribute?:   string;
  spEntityId?:          string | null;
  acsUrl?:              string | null;
  isVerified?:          boolean;
  lastTestedAt?:        string | null;
  organization?: {
    id:        string;
    slug:      string;
    name:      string;
    ssoEnabled: boolean;
  };
}

export interface SsoConfigInput {
  provider?:            string;
  idpEntityId?:         string;
  idpSsoUrl?:           string;
  idpCertificate?:      string;
  emailAttribute?:      string;
  firstNameAttribute?:  string;
  lastNameAttribute?:   string;
}

// ─── API Client ───────────────────────────────────────────────────────────────

export const settingsApi = {
  // ── User Profile ──────────────────────────────────────────────────────────

  updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    return apiClient.patch('/users/me', data).then((r) => r.data);
  },

  changePassword(dto: ChangePasswordDto): Promise<void> {
    return apiClient.post('/users/me/change-password', dto).then(() => undefined);
  },

  // ── Organization ──────────────────────────────────────────────────────────

  getOrg(): Promise<Organization> {
    return apiClient.get('/organizations/me').then((r) => r.data);
  },

  updateOrg(data: Partial<Organization>): Promise<Organization> {
    return apiClient.patch('/organizations/me', data).then((r) => r.data);
  },

  resetDemo(): Promise<void> {
    return apiClient.post('/organizations/me/reset-demo').then(() => undefined);
  },

  // ── LLM Settings ──────────────────────────────────────────────────────────

  getLlmSettings(): Promise<LlmSettings> {
    return apiClient.get('/organizations/me/llm-settings').then((r) => r.data);
  },

  saveLlmSettings(orgApiKey: string): Promise<LlmSettings> {
    return apiClient.patch('/organizations/me/llm-settings', { orgApiKey }).then((r) => r.data);
  },

  testLlmConnection(): Promise<{ ok: boolean; latencyMs?: number; model?: string; error?: string }> {
    return apiClient.post('/organizations/me/llm-settings/test', {}).then((r) => r.data);
  },

  // ── Retention Settings ────────────────────────────────────────────────────

  getRetentionSettings(): Promise<RetentionSettings> {
    return apiClient.get('/organizations/me/retention-settings').then((r) => r.data);
  },

  updateRetentionSettings(data: Partial<RetentionSettings>): Promise<RetentionSettings> {
    return apiClient.patch('/organizations/me/retention-settings', data).then((r) => r.data);
  },

  // ── Auth ──────────────────────────────────────────────────────────────────

  logoutAllSessions(): Promise<void> {
    return apiClient.post('/auth/logout-all').then(() => undefined);
  },

  // ── SSO / SAML ────────────────────────────────────────────────────────────

  getSsoConfig(): Promise<SsoConfig> {
    return apiClient.get('/auth/sso/config').then((r) => r.data);
  },

  upsertSsoConfig(dto: SsoConfigInput): Promise<SsoConfig> {
    return apiClient.post('/auth/sso/config', dto).then((r) => r.data);
  },

  testSsoConfig(): Promise<{ ok: boolean; error?: string }> {
    return apiClient.post('/auth/sso/test').then((r) => r.data);
  },

  toggleSso(enabled: boolean): Promise<{ id: string; ssoEnabled: boolean }> {
    return apiClient.patch('/auth/sso/toggle', { enabled }).then((r) => r.data);
  },
};
