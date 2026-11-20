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

  console.log(`[apiFetch] Request to: ${endpoint}`, { method: options.method || 'GET' });

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    console.log(`[apiFetch] Response from: ${endpoint} - Status: ${res.status}`);

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('nomina_token');
      localStorage.removeItem('nomina_user');
      window.dispatchEvent(new CustomEvent('nomina:unauthorized'));
    }

    return res;
  } catch (err) {
    console.error(`[apiFetch] Network error at ${endpoint}:`, err);
    throw err;
  }
}
