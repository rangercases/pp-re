import {
  MAX_FAILED_LOGINS,
  LOCKOUT_MS,
  isValidEmail,
  normalizeEmail,
  passwordWorkEqualizer,
  verifyPassword,
} from '../../_lib/auth.js';
import { fail, json, readJsonBody, sameOrigin, serverError } from '../../_lib/http.js';
import { createSession, sessionCookie } from '../../_lib/session.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail('BAD_ORIGIN', 403);
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;

    const email = normalizeEmail(parsed.body.email);
    const password = typeof parsed.body.password === 'string' ? parsed.body.password : '';
    if (!isValidEmail(email) || !password) return fail('INVALID_CREDENTIALS', 401);

    const now = Date.now();
    const user = await env.DB.prepare(
      `SELECT id, email, name, role, password_hash, is_active, failed_logins, locked_until
         FROM users WHERE email = ?`
    )
      .bind(email)
      .first();

    if (!user) {
      await passwordWorkEqualizer(password);
      return fail('INVALID_CREDENTIALS', 401);
    }
    if (user.locked_until && user.locked_until > now) {
      return fail('ACCOUNT_LOCKED', 429, { retryAfter: Math.ceil((user.locked_until - now) / 1000) });
    }
    if (!user.is_active) return fail('ACCOUNT_DISABLED', 403);

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      const failed = (user.failed_logins || 0) + 1;
      const lockedUntil = failed >= MAX_FAILED_LOGINS ? now + LOCKOUT_MS : null;
      await env.DB.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?')
        .bind(failed, lockedUntil, user.id)
        .run();
      if (lockedUntil) return fail('ACCOUNT_LOCKED', 429, { retryAfter: Math.ceil(LOCKOUT_MS / 1000) });
      return fail('INVALID_CREDENTIALS', 401, { attemptsLeft: Math.max(0, MAX_FAILED_LOGINS - failed) });
    }

    await env.DB.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = ? WHERE id = ?')
      .bind(now, user.id)
      .run();
    await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run();

    const session = await createSession(env, user.id);
    return json(
      { ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } },
      200,
      { 'set-cookie': sessionCookie(session.token, session.expiresAt, request) }
    );
  } catch (error) {
    return serverError(error);
  }
}
