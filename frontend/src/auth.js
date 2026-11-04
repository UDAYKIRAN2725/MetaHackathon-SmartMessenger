// Auth calls to the FastAPI backend. Passwords are hashed with bcrypt on the server;
// the session is an HTTP-only cookie, so the browser stores no credentials.
import { api, post } from './api';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normPhone = (p) => (p || '').replace(/\D/g, '');

export async function getSession() {
  try {
    return await api('/api/auth/me');
  } catch (e) {
    if (e.status === 401) return null;
    throw e;
  }
}

export const register = ({ name, email, phone, password }) => post('/api/auth/register', { name, email, phone, password });
export const login = ({ identifier, password, remember }) => post('/api/auth/login', { identifier, password, remember });
export const logout = () => post('/api/auth/logout');

export const initials = (name) =>
  (name || '?')
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';
