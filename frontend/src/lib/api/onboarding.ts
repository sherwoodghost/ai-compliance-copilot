import { apiClient } from './client';

export interface OnboardingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface OnboardingSession {
  id: string;
  status: string;
  messages: OnboardingMessage[];
  businessProfile: Record<string, unknown> | null;
  completeness_score?: number;
}

export interface ChatResponse {
  message: string;
  extractedFields: Record<string, unknown>;
  completionScore: number;
  isComplete: boolean;
}

export interface OnboardingStatus {
  hasSession: boolean;
  status?: string;
  currentState?: string;
  turnCount?: number;
  completionScore?: number;
  isComplete?: boolean;
  hasBusinessProfile?: boolean;
  extractedData?: Record<string, unknown>;
  messages?: OnboardingMessage[];
}

export const onboardingApi = {
  getSession: () =>
    apiClient.get<OnboardingSession>('/onboarding/session').then((r) => r.data),

  sendMessage: (message: string) =>
    apiClient.post<{ queued: boolean }>('/onboarding/message', { message }).then((r) => r.data),

  /** Synchronous chat — sends a message (or null for greeting) and gets an AI response directly */
  chat: (message?: string | null) =>
    apiClient.post<ChatResponse>('/onboarding/chat', { message: message ?? undefined }).then((r) => r.data),

  getProfile: () =>
    apiClient.get('/onboarding/profile').then((r) => r.data),

  getStatus: () =>
    apiClient.get<OnboardingStatus>('/onboarding/status').then((r) => r.data),

  finalize: () =>
    apiClient.post('/onboarding/finalize').then((r) => r.data),
};
