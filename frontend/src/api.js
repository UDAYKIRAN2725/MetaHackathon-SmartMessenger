// Thin fetch wrapper. The session lives in an HTTP-only cookie, so nothing auth-related is stored in JS.
export class ApiError extends Error {
  constructor(message, status, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Can’t reach the server. Is the backend running?', 0);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = res.status >= 500 || res.status === 502 ? 'Server error. Is the backend running?' : data.detail || `Request failed (${res.status}).`;
    throw new ApiError(msg, res.status, data.field);
  }
  return data;
}

export const post = (path, body) => api(path, { method: 'POST', body: body ?? {} });
export const patch = (path, body) => api(path, { method: 'PATCH', body });
export const del = (path) => api(path, { method: 'DELETE' });

export const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
