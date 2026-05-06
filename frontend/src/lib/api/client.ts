import axios, { AxiosInstance, AxiosError } from 'axios';
import Cookies from 'js-cookie';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Attach access token to every request
apiClient.interceptors.request.use((config) => {
  const token = Cookies.get(ACCESS_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

// Auto-refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const refreshToken = Cookies.get(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      clearTokens();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(originalRequest));
        });
      });
    }

    isRefreshing = true;
    originalRequest._retry = true;

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
        {},
        { headers: { Authorization: `Bearer ${refreshToken}` } },
      );

      const { accessToken } = response.data;
      Cookies.set(ACCESS_TOKEN_KEY, accessToken, { expires: 1 / 96 }); // 15 min

      refreshQueue.forEach((cb) => cb(accessToken));
      refreshQueue = [];

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    } catch {
      clearTokens();
      window.location.href = '/login';
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

export function setTokens(accessToken: string, refreshToken: string) {
  Cookies.set(ACCESS_TOKEN_KEY, accessToken, { expires: 1 / 96, secure: true, sameSite: 'strict' });
  Cookies.set(REFRESH_TOKEN_KEY, refreshToken, { expires: 7, secure: true, sameSite: 'strict' });
}

export function clearTokens() {
  Cookies.remove(ACCESS_TOKEN_KEY);
  Cookies.remove(REFRESH_TOKEN_KEY);
}

export function getAccessToken() {
  return Cookies.get(ACCESS_TOKEN_KEY);
}
