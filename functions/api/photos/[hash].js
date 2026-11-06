import { fail, json, serverError } from '../../_lib/http.js';
import { requireUser } from '../../_lib/session.js';

// Content-addressed photo storage in R2. Clients upload a photo's raw
// bytes under its SHA-256 hash; report payloads in D1 then reference the
// photo as `fasrep-r2://<hash>` instead of an inline base64 data URL.
// Objects live under a per-user prefix (u<userId>/<hash>) and every
// handler requires a session, so an account can only reach its own
// photos. Objects are never deleted when a report is deleted: the same
// photo bytes may be referenced by several reports.

const HASH_PATTERN = /^[a-f0-9]{64}$/;

function extractHash(params, request) {
  if (params && params.hash) {
    return decodeURIComponent(String(params.hash)).trim().toLowerCase();
  }
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    return lastPart ? decodeURIComponent(lastPart).trim().toLowerCase() : '';
  } catch {
    return '';
  }
}

async function sha256HexOfBytes(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function photosNotConfigured() {
  return fail('PHOTOS_NOT_CONFIGURED', 503);
}

export async function onRequestPut({ request, env, params }) {
  try {
    const session = await requireUser(env, request);
    if (session.error) return session.error;

    const hash = extractHash(params, request);
    if (!HASH_PATTERN.test(hash)) return fail('INVALID_HASH', 400);
    if (!env || !env.PHOTOS) return photosNotConfigured();

    const bytes = new Uint8Array(await request.arrayBuffer());
    const actualHash = await sha256HexOfBytes(bytes);
    if (actualHash !== hash) return fail('HASH_MISMATCH', 400);

    const contentType = request.headers.get('content-type') || 'application/octet-stream';
    const key = `u${session.user.id}/${hash}`;
    await env.PHOTOS.put(key, bytes, { httpMetadata: { contentType } });
    return json({ ok: true, hash });
  } catch (err) {
    return serverError(err);
  }
}

export async function onRequestGet({ request, env, params }) {
  try {
    const session = await requireUser(env, request);
    if (session.error) return session.error;

    const hash = extractHash(params, request);
    if (!HASH_PATTERN.test(hash)) return fail('INVALID_HASH', 400);
    if (!env || !env.PHOTOS) return photosNotConfigured();

    // Regular users always read under their own prefix. An admin may read
    // another user's object only by naming the owner explicitly (?user=<id>).
    let ownerId = session.user.id;
    const url = new URL(request.url);
    const userParam = url.searchParams.get('user');
    if (session.user.role === 'admin' && userParam) {
      ownerId = userParam;
    }

    const key = `u${ownerId}/${hash}`;
    const object = await env.PHOTOS.get(key);
    if (!object) return fail('PHOTO_NOT_FOUND', 404);

    const contentType = (object.httpMetadata && object.httpMetadata.contentType) || 'application/octet-stream';
    return new Response(object.body, {
      status: 200,
      headers: {
        'content-type': contentType,
        // Content-addressed: the bytes behind a hash never change.
        'cache-control': 'private, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    const session = await requireUser(env, request);
    if (session.error) return session.error;

    const hash = extractHash(params, request);
    if (!HASH_PATTERN.test(hash)) return fail('INVALID_HASH', 400);
    if (!env || !env.PHOTOS) return photosNotConfigured();

    const key = `u${session.user.id}/${hash}`;
    await env.PHOTOS.delete(key);
    return json({ ok: true, hash });
  } catch (err) {
    return serverError(err);
  }
}
