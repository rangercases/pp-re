export const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization, X-Requested-With',
};

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  ...CORS_HEADERS,
};

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

export function error(message, status = 400, details = null) {
  const payload = { success: false, error: message };
  if (details !== null && details !== undefined) {
    payload.details = details;
  }
  return json(payload, status);
}

export function fail(code, status = 400, extra = {}) {
  return json({ ok: false, success: false, error: code, ...extra }, status);
}

export function serverError(err) {
  console.error('API error:', err && err.stack ? err.stack : err);
  const message = err && err.message ? err.message : 'Internal Server Error';
  return json({ ok: false, success: false, error: message }, 500);
}

export function methodNotAllowed(allow) {
  return new Response(JSON.stringify({ ok: false, success: false, error: 'METHOD_NOT_ALLOWED' }), {
    status: 405,
    headers: { ...JSON_HEADERS, allow },
  });
}

export async function readJsonBody(request) {
  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (type && !type.includes('application/json')) {
    return { ok: false, response: fail('INVALID_CONTENT_TYPE', 415) };
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: fail('INVALID_JSON', 400) };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, response: fail('INVALID_BODY', 400) };
  }
  return { ok: true, body };
}

// SameSite=Lax đã chặn form cross-site; kiểm tra Origin thêm một lớp cho POST/PATCH.
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
