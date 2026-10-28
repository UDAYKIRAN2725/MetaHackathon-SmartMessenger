// Demo authentication stored in the browser (localStorage).
// There is no backend yet. Replace the bodies of register / login / logout / getSession
// with fetch() calls to your API; the rest of the app only uses these four functions.
// Passwords are never stored in plain text: a salted SHA-256 hash is kept instead.
// This is still demo-grade. Real auth must hash on the server (bcrypt/argon2) and use HTTP-only cookies.

const USERS_KEY = 'sm_users';
const SESSION_KEY = 'sm_session';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normPhone = (p) => (p || '').replace(/\D/g, '');
export const normEmail = (e) => (e || '').trim().toLowerCase();

const readUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
};
const writeUsers = (u) => localStorage.setItem(USERS_KEY, JSON.stringify(u));

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  return toHex(await crypto.subtle.digest('SHA-256', data));
}
const randomHex = (n = 16) => toHex(crypto.getRandomValues(new Uint8Array(n)));

const publicUser = ({ id, name, email, phone, createdAt }) => ({ id, name, email, phone, createdAt });

function saveSession(userId, remember) {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify({ userId }));
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { userId } = JSON.parse(raw);
    const u = readUsers().find((x) => x.id === userId);
    return u ? publicUser(u) : null;
  } catch {
    return null;
  }
}

export async function register({ name, email, phone, password }) {
  const users = readUsers();
  const e = normEmail(email);
  const p = normPhone(phone);
  if (users.some((u) => u.email === e)) throw new Error('An account with this email already exists.');
  if (users.some((u) => u.phone === p)) throw new Error('An account with this phone number already exists.');

  const salt = randomHex();
  const user = {
    id: randomHex(8),
    name: name.trim(),
    email: e,
    phone: p,
    salt,
    hash: await hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };
  writeUsers([...users, user]);
  saveSession(user.id, true);
  return publicUser(user);
}

export async function login({ identifier, password, remember }) {
  const id = identifier.trim();
  const byEmail = id.includes('@');
  const key = byEmail ? normEmail(id) : normPhone(id);
  const user = readUsers().find((u) => (byEmail ? u.email === key : u.phone === key));
  // Same message for unknown user and wrong password, so accounts can't be probed.
  const fail = new Error('Email/phone or password is incorrect.');
  if (!user) throw fail;
  if ((await hashPassword(password, user.salt)) !== user.hash) throw fail;
  saveSession(user.id, remember);
  return publicUser(user);
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export const initials = (name) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';
