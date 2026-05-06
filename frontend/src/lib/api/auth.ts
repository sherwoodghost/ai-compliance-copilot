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
  user: { id: string; email: string; fullName: string; role: string; orgId: string };
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
};
