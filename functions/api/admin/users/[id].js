import { cleanName, hashPassword, passwordProblem } from '../../../_lib/auth.js';
import { fail, json, readJsonBody, sameOrigin, serverError } from '../../../_lib/http.js';
import { requireAdmin } from '../../../_lib/session.js';

export async function onRequestPatch({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail('BAD_ORIGIN', 403);
    const session = await requireAdmin(env, request);
    if (session.error) return session.error;

    const id = Number.parseInt(params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return fail('INVALID_USER', 400);

    const target = await env.DB.prepare('SELECT id, role, is_active FROM users WHERE id = ?').bind(id).first();
    if (!target) return fail('USER_NOT_FOUND', 404);

    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;
    const isSelf = id === session.user.id;

    const updates = [];
    const bindings = [];
    let revokeSessions = false;

    if ('name' in body) {
      updates.push('name = ?');
      bindings.push(cleanName(body.name));
    }

    if ('role' in body) {
      if (body.role !== 'admin' && body.role !== 'user') return fail('INVALID_ROLE', 400);
      if (isSelf && body.role !== target.role) return fail('CANNOT_CHANGE_SELF', 400);
      updates.push('role = ?');
      bindings.push(body.role);
    }

    if ('is_active' in body) {
      const active = body.is_active ? 1 : 0;
      if (isSelf && !active) return fail('CANNOT_CHANGE_SELF', 400);
      updates.push('is_active = ?');
      bindings.push(active);
      if (!active) revokeSessions = true;
    }

    if (body.unlock) {
      updates.push('failed_logins = 0', 'locked_until = NULL');
    }

    if ('password' in body) {
      const pwProblem = passwordProblem(body.password);
      if (pwProblem) return fail(pwProblem, 400);
      updates.push('password_hash = ?', 'failed_logins = 0', 'locked_until = NULL');
      bindings.push(await hashPassword(body.password));
      revokeSessions = true;
    }

    const willLoseAdmin =
      target.role === 'admin' &&
      ((updates.some((u) => u.startsWith('role')) && body.role !== 'admin') ||
        (updates.some((u) => u.startsWith('is_active')) && !body.is_active));
    if (willLoseAdmin) {
      const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1").first();
      if ((row && row.n ? row.n : 0) <= 1) return fail('LAST_ADMIN', 400);
    }

    if (!updates.length) return fail('NOTHING_TO_UPDATE', 400);

    await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...bindings, id).run();
    if (revokeSessions) {
      if (isSelf) {
        await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?')
          .bind(id, session.tokenHash)
          .run();
      } else {
        await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
      }
    }

    const user = await env.DB.prepare(
      'SELECT id, email, name, role, is_active, failed_logins, locked_until, created_at, last_login_at FROM users WHERE id = ?'
    )
      .bind(id)
      .first();
    return json({ ok: true, user });
  } catch (error) {
    return serverError(error);
  }
}
