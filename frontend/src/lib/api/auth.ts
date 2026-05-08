import { apiClient, setTokens, clearTokens } from './client';

export interface RegisterPayload {
  organizationName: string;
  email: string;
  fullName: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string; fullName: string; role: string; orgId: string; onboardingComplete?: boolean };
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', payload);
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },

  async login(emailOrPayload: string | LoginPayload, password?: string): Promise<AuthResponse> {
    const payload: LoginPayload =
      typeof emailOrPayload === 'string'
        ? { email: emailOrPayload, password: password! }
        : emailOrPayload;
    const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },

  async logout(): Promise<void> {
    try { await apiClient.post('/auth/logout'); } catch {}
    clearTokens();
  },

  async me() {
    const { data } = await apiClient.get('/auth/me');
    return data;
  },

  /** Accept an invite link and set a password to activate the account. */
  async acceptInvite(token: string, password: string): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/accept-invite', { token, password });
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },

  /** Request a password-reset email (always succeeds silently). */
  async requestPasswordReset(email: string): Promise<void> {
    await apiClient.post('/auth/request-password-reset', { email });
  },

  /** Consume a reset token and set a new password. */
  async resetPassword(token: string, password: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, password });
  },
};

// ─── Notifications API ────────────────────────────────────────────────────────

export const notificationsApi = {
  getMyNotifications: (limit = 20) =>
    apiClient.get('/notifications', { params: { limit } }).then((r) => r.data) as Promise<{
      notifications: any[];
      unreadCount: number;
    }>,

  markRead: (id: string) =>
    apiClient.post(`/notifications/${id}/read`),

  markAllRead: () =>
    apiClient.post('/notifications/read-all'),
};
