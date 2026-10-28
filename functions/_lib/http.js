const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

export function fail(code, status, extra = {}) {
  return json({ ok: false, error: code, ...extra }, status);
}

export function serverError(error) {
  console.error('API error:', error && error.stack ? error.stack : error);
  return fail('SERVER_ERROR', 500);
}

export function methodNotAllowed(allow) {
  return new Response(JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }), {
    status: 405,
    headers: { ...JSON_HEADERS, allow },
  });
}

export async function readJsonBody(request) {
  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (!type.includes('application/json')) {
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
