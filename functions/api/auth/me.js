import { fail, json, serverError } from '../../_lib/http.js';
import { getSession } from '../../_lib/session.js';

export async function onRequestGet({ request, env }) {
  try {
    const session = await getSession(env, request);
    if (!session) return fail('AUTH_REQUIRED', 401);
    return json({ ok: true, user: session.user });
  } catch (error) {
    return serverError(error);
  }
}
