import { normalizeEmail } from '../../../_lib/auth.js';
import { fail, json, sameOrigin, serverError } from '../../../_lib/http.js';
import { requireAdmin } from '../../../_lib/session.js';

export async function onRequestDelete({ request, env, params }) {
  try {
    if (!sameOrigin(request)) return fail('BAD_ORIGIN', 403);
    const session = await requireAdmin(env, request);
    if (session.error) return session.error;

    const email = normalizeEmail(params && params.email ? decodeURIComponent(String(params.email)) : '');
    if (!email) return fail('INVALID_EMAIL', 400);

    await env.DB.prepare('DELETE FROM signup_allowlist WHERE email = ?').bind(email).run();
    return json({ ok: true, email });
  } catch (error) {
    return serverError(error);
  }
}
