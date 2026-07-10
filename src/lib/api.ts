const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const TOKEN_KEY = 'saas_auth_token';

export interface CreateInstituteInput {
  name: string;
  email: string;
  phone: string;
  address: string;
  subscriptionPlan: string;
  adminName: string;
  adminPassword: string;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? 'Request failed');
  return result;
}

export function createInstitute(input: CreateInstituteInput) {
  return api('/api/institutes', { method: 'POST', body: JSON.stringify(input) });
}
