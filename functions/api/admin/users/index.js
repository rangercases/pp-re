import { cleanName, hashPassword, isValidEmail, normalizeEmail, passwordProblem } from '../../../_lib/auth.js';
import { fail, json, readJsonBody, sameOrigin, serverError } from '../../../_lib/http.js';
import { requireAdmin } from '../../../_lib/session.js';

const USER_COLUMNS = `id, email, name, role, is_active, failed_logins, locked_until, created_at, last_login_at`;

export async function onRequestGet({ request, env }) {
  try {
    const session = await requireAdmin(env, request);
    if (session.error) return session.error;
    const result = await env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY id`).all();
    return json({ ok: true, users: result.results || [] });
  } catch (error) {
    return serverError(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail('BAD_ORIGIN', 403);
    const session = await requireAdmin(env, request);
    if (session.error) return session.error;

    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;

    const email = normalizeEmail(parsed.body.email);
    const name = cleanName(parsed.body.name) || (email ? email.split('@')[0] : '');
    if (!isValidEmail(email)) return fail('INVALID_EMAIL', 400);
    const pwProblem = passwordProblem(parsed.body.password);
    if (pwProblem) return fail(pwProblem, 400);
    const role = parsed.body.role === 'admin' ? 'admin' : 'user';

    const passwordHash = await hashPassword(parsed.body.password);
    const now = Date.now();
    const result = await env.DB.prepare(
      `INSERT INTO users (email, name, role, password_hash, is_active, failed_logins, created_at)
       VALUES (?, ?, ?, ?, 1, 0, ?)`
    )
      .bind(email, name, role, passwordHash, now)
      .run();

    const id = result.meta ? result.meta.last_row_id : null;
    return json({ ok: true, user: { id, email, name, role, is_active: 1, created_at: now } });
  } catch (error) {
    if (String(error && error.message).includes('UNIQUE')) return fail('EMAIL_TAKEN', 409);
    return serverError(error);
  }
}
