import { randomToken, sha256Hex } from './auth.js';
import { fail } from './http.js';

export const SESSION_COOKIE = 'fasrep_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export async function createSession(env, userId) {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  await env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(tokenHash, userId, now, expiresAt, now)
    .run();
  return { token, tokenHash, expiresAt };
}

export function sessionCookie(token, expiresAt, request) {
  const secure = new URL(request.url).protocol === 'https:';
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === 'https:';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

export function readSessionToken(request) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === SESSION_COOKIE) return part.slice(idx + 1).trim();
  }
  return '';
}

export async function getSession(env, request) {
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const row = await env.DB.prepare(
    `SELECT s.expires_at, s.last_seen_at,
            u.id AS user_id, u.email, u.name, u.role, u.is_active
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`
  )
    .bind(tokenHash)
    .first();
  if (!row) return null;
  if (row.expires_at <= now || !row.is_active) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }
  if (now - row.last_seen_at > TOUCH_INTERVAL_MS) {
    await env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').bind(now, tokenHash).run();
  }
  return {
    tokenHash,
    user: { id: row.user_id, email: row.email, name: row.name, role: row.role },
  };
}

export async function requireUser(env, request) {
  const session = await getSession(env, request);
  if (!session) return { error: fail('AUTH_REQUIRED', 401) };
  return session;
}

export async function requireAdmin(env, request) {
  const session = await getSession(env, request);
  if (!session) return { error: fail('AUTH_REQUIRED', 401) };
  if (session.user.role !== 'admin') return { error: fail('FORBIDDEN', 403) };
  return session;
}
