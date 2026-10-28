import { json, fail, serverError } from '../../_lib/http.js';
import { getSession } from '../../_lib/session.js';

export async function onRequestGet({ request, env }) {
  try {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
    const session = await getSession(env, request);
    return json({
      ok: true,
      hasUsers: (row && row.n ? row.n : 0) > 0,
      user: session ? session.user : null,
    });
  } catch (error) {
    if (String(error && error.message).includes('no such table')) return fail('DB_NOT_INITIALIZED', 503);
    return serverError(error);
  }
}
