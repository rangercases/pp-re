import { isValidEmail, normalizeEmail } from '../../../_lib/auth.js';
import { fail, json, readJsonBody, sameOrigin, serverError } from '../../../_lib/http.js';
import { requireAdmin } from '../../../_lib/session.js';

// Signup allowlist (admin only). While the table is empty, signup stays
// open; as soon as it holds one email, only listed emails may register.
export async function onRequestGet({ request, env }) {
  try {
    const session = await requireAdmin(env, request);
    if (session.error) return session.error;
    const result = await env.DB.prepare(
      'SELECT email, note, created_at FROM signup_allowlist ORDER BY email'
    ).all();
    return json({ ok: true, allowlist: result.results || [] });
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
    if (!isValidEmail(email)) return fail('INVALID_EMAIL', 400);
    const note = typeof parsed.body.note === 'string' ? parsed.body.note.trim().slice(0, 200) : '';
    const now = Date.now();

    await env.DB.prepare(
      `INSERT INTO signup_allowlist (email, note, created_at) VALUES (?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET note = excluded.note`
    )
      .bind(email, note, now)
      .run();

    const entry = await env.DB.prepare(
      'SELECT email, note, created_at FROM signup_allowlist WHERE email = ?'
    )
      .bind(email)
      .first();
    return json({ ok: true, entry });
  } catch (error) {
    return serverError(error);
  }
}
