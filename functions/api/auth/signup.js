import { cleanName, hashPassword, isValidEmail, normalizeEmail, passwordProblem } from '../../_lib/auth.js';
import { fail, json, readJsonBody, sameOrigin, serverError } from '../../_lib/http.js';
import { createSession, sessionCookie } from '../../_lib/session.js';

// Chỉ mở khi hệ thống chưa có tài khoản nào: người đăng ký đầu tiên trở thành Admin.
export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail('BAD_ORIGIN', 403);
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;

    const email = normalizeEmail(parsed.body.email);
    const name = cleanName(parsed.body.name) || (email ? email.split('@')[0] : '');
    if (!isValidEmail(email)) return fail('INVALID_EMAIL', 400);
    const pwProblem = passwordProblem(parsed.body.password);
    if (pwProblem) return fail(pwProblem, 400);

    const passwordHash = await hashPassword(parsed.body.password);
    const now = Date.now();
    const result = await env.DB.prepare(
      `INSERT INTO users (email, name, role, password_hash, is_active, failed_logins, created_at, last_login_at)
       SELECT ?, ?, 'admin', ?, 1, 0, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM users)`
    )
      .bind(email, name, passwordHash, now, now)
      .run();

    if (!result.meta || !result.meta.changes) return fail('SIGNUP_CLOSED', 403);

    const userId = result.meta.last_row_id;
    const session = await createSession(env, userId);
    return json(
      { ok: true, user: { id: userId, email, name, role: 'admin' } },
      200,
      { 'set-cookie': sessionCookie(session.token, session.expiresAt, request) }
    );
  } catch (error) {
    if (String(error && error.message).includes('UNIQUE')) return fail('EMAIL_TAKEN', 409);
    return serverError(error);
  }
}
