import { cleanName, hashPassword, isValidEmail, normalizeEmail, passwordProblem, sha256Hex, timingSafeEqual } from '../../../_lib/auth.js';
import { fail, json, readJsonBody, sameOrigin, serverError } from '../../../_lib/http.js';
import { createSession, sessionCookie } from '../../../_lib/session.js';

const MAX_ATTEMPTS = 5;

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail('BAD_ORIGIN', 403);
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;

    const email = normalizeEmail(parsed.body.email);
    const name = cleanName(parsed.body.name) || (email ? email.split('@')[0] : '');
    const code = typeof parsed.body.code === 'string' ? parsed.body.code.trim() : '';
    if (!isValidEmail(email)) return fail('INVALID_EMAIL', 400);
    if (!/^\d{6}$/.test(code)) return fail('INVALID_CODE', 400);
    const pwProblem = passwordProblem(parsed.body.password);
    if (pwProblem) return fail(pwProblem, 400);

    const now = Date.now();
    const row = await env.DB.prepare(
      `SELECT id, code_hash, attempts, expires_at, consumed_at
         FROM signup_codes WHERE email = ? ORDER BY id DESC LIMIT 1`
    )
      .bind(email)
      .first();
    if (!row || row.consumed_at || row.expires_at <= now) return fail('CODE_EXPIRED', 400);

    if (row.attempts >= MAX_ATTEMPTS) {
      await env.DB.prepare('UPDATE signup_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL')
        .bind(now, row.id)
        .run();
      return fail('CODE_LOCKED', 429, { retryAfter: 900 });
    }

    const actual = hexToBytes(await sha256Hex(email + ':' + code));
    const expected = hexToBytes(row.code_hash);
    if (!timingSafeEqual(actual, expected)) {
      const attempts = row.attempts + 1;
      await env.DB.prepare('UPDATE signup_codes SET attempts = ? WHERE id = ?').bind(attempts, row.id).run();
      if (attempts >= MAX_ATTEMPTS) {
        await env.DB.prepare('UPDATE signup_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL')
          .bind(now, row.id)
          .run();
        return fail('CODE_LOCKED', 429, { retryAfter: 900 });
      }
      return fail('INVALID_CODE', 400, { attemptsLeft: MAX_ATTEMPTS - attempts });
    }

    const consumed = await env.DB.prepare(
      'UPDATE signup_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL'
    )
      .bind(now, row.id)
      .run();
    if (!consumed.meta || consumed.meta.changes !== 1) return fail('CODE_EXPIRED', 400);

    const passwordHash = await hashPassword(parsed.body.password);
    const inserted = await env.DB.prepare(
      `INSERT INTO users (email, name, role, password_hash, is_active, failed_logins, created_at, last_login_at)
       SELECT ?, ?, CASE WHEN EXISTS (SELECT 1 FROM users WHERE role = 'admin') THEN 'user' ELSE 'admin' END, ?, 1, 0, ?, ?`
    )
      .bind(email, name, passwordHash, now, now)
      .run();

    const userId = inserted.meta && inserted.meta.last_row_id;
    const user = await env.DB.prepare('SELECT id, email, name, role FROM users WHERE id = ?')
      .bind(userId)
      .first();
    const session = await createSession(env, userId);
    return json(
      { ok: true, user },
      200,
      { 'set-cookie': sessionCookie(session.token, session.expiresAt, request) }
    );
  } catch (error) {
    if (String(error && error.message).includes('UNIQUE')) return fail('EMAIL_TAKEN', 409);
    return serverError(error);
  }
}
