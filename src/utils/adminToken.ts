const ADMIN_TOKEN_STORAGE_KEY = 'sathi_admin_token';

export function getStoredAdminToken(): string | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const val = window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    return val && val.trim() ? val.trim() : null;
  } catch {
    return null;
  }
}

export function setStoredAdminToken(token: string | null): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    if (token && token.trim()) {
      window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token.trim());
    } else {
      window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restriction inside sandboxed environments
  }
}

export function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getStoredAdminToken();
  const headers = new Headers(init.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers,
  });
}
