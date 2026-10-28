import { hashPassword, passwordProblem, verifyPassword } from '../../_lib/auth.js';
import { fail, json, readJsonBody, sameOrigin, serverError } from '../../_lib/http.js';
import { requireUser } from '../../_lib/session.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail('BAD_ORIGIN', 403);
    const session = await requireUser(env, request);
    if (session.error) return session.error;

    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const currentPassword = typeof parsed.body.currentPassword === 'string' ? parsed.body.currentPassword : '';
    if (!currentPassword) return fail('WRONG_PASSWORD', 400);

    const row = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
      .bind(session.user.id)
      .first();
    if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
      return fail('WRONG_PASSWORD', 400);
    }

    const pwProblem = passwordProblem(parsed.body.newPassword);
    if (pwProblem) return fail(pwProblem, 400);

    const passwordHash = await hashPassword(parsed.body.newPassword);
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?')
        .bind(passwordHash, session.user.id),
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?')
        .bind(session.user.id, session.tokenHash),
    ]);
    return json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
