import { sha256Hex } from '../../_lib/auth.js';
import { json, serverError } from '../../_lib/http.js';
import { clearSessionCookie, readSessionToken } from '../../_lib/session.js';

export async function onRequestPost({ request, env }) {
  try {
    const token = readSessionToken(request);
    if (token) {
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
    }
    return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie(request) });
  } catch (error) {
    return serverError(error);
  }
}
