import { API_BASE } from '../constants';

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('nomina_token');
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('nomina_token');
    window.dispatchEvent(new CustomEvent('nomina:unauthorized'));
  }

  return res;
}
