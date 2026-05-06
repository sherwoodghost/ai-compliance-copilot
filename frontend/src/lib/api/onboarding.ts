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

export const onboardingApi = {
  getSession: () =>
    apiClient.get<OnboardingSession>('/onboarding/session').then((r) => r.data),

  sendMessage: (message: string) =>
    apiClient.post<{ queued: boolean }>('/onboarding/message', { message }).then((r) => r.data),

  getProfile: () =>
    apiClient.get('/onboarding/profile').then((r) => r.data),
};
