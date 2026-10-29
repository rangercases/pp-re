import { cleanName, isValidEmail, normalizeEmail, passwordProblem, randomToken, sha256Hex } from '../../../_lib/auth.js';
import { fail, json, readJsonBody, sameOrigin, serverError } from '../../../_lib/http.js';
import { devMailMode, mailerConfigured, sendExistingAccountEmail, sendSignupCodeEmail } from '../../../_lib/mail.js';

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const HOURLY_WINDOW_MS = 60 * 60 * 1000;
const MAX_CODES_PER_EMAIL_HOUR = 3;
const MAX_CODES_PER_IP_HOUR = 10;
const CODE_RETENTION_MS = 24 * 60 * 60 * 1000;
const RESEND_AFTER_SECONDS = Math.round(RESEND_COOLDOWN_MS / 1000);
const EXPIRES_IN_SECONDS = Math.round(CODE_TTL_MS / 1000);

function randomCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(value).padStart(6, '0');
}

function clientIp(request) {
  const direct = request.headers.get('cf-connecting-ip');
  if (direct) return direct.trim();
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : '';
}

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return fail('BAD_ORIGIN', 403);
    const parsed = await readJsonBody(request);
    if (!parsed.ok) return parsed.response;

    const email = normalizeEmail(parsed.body.email);
    const name = cleanName(parsed.body.name) || (email ? email.split('@')[0] : '');
    if (!isValidEmail(email)) return fail('INVALID_EMAIL', 400);
    const pwProblem = passwordProblem(parsed.body.password);
    if (pwProblem) return fail(pwProblem, 400);
    if (!mailerConfigured(env, request)) return fail('MAIL_NOT_CONFIGURED', 503);

    const now = Date.now();
    const ipHash = await sha256Hex(clientIp(request) || 'unknown');

    await env.DB.prepare('DELETE FROM signup_codes WHERE created_at < ?')
      .bind(now - CODE_RETENTION_MS)
      .run();

    const last = await env.DB.prepare(
      'SELECT created_at FROM signup_codes WHERE email = ? ORDER BY id DESC LIMIT 1'
    )
      .bind(email)
      .first();
    if (last && now - last.created_at < RESEND_COOLDOWN_MS) {
      return fail('CODE_COOLDOWN', 429, {
        retryAfter: Math.ceil((RESEND_COOLDOWN_MS - (now - last.created_at)) / 1000),
      });
    }

    const emailCount = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM signup_codes WHERE email = ? AND created_at > ?'
    )
      .bind(email, now - HOURLY_WINDOW_MS)
      .first();
    if (emailCount && emailCount.n >= MAX_CODES_PER_EMAIL_HOUR) {
      return fail('RATE_LIMITED', 429, { scope: 'email', retryAfter: Math.round(HOURLY_WINDOW_MS / 1000) });
    }

    const ipCount = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM signup_codes WHERE ip_hash = ? AND created_at > ?'
    )
      .bind(ipHash, now - HOURLY_WINDOW_MS)
      .first();
    if (ipCount && ipCount.n >= MAX_CODES_PER_IP_HOUR) {
      return fail('RATE_LIMITED', 429, { scope: 'ip', retryAfter: Math.round(HOURLY_WINDOW_MS / 1000) });
    }

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) {
      // Vẫn ghi một dòng đã tiêu thụ để giới hạn tần suất có hiệu lực, nhưng không có mã dùng được.
      await env.DB.prepare(
        `INSERT INTO signup_codes (email, ip_hash, code_hash, attempts, created_at, expires_at, consumed_at)
         VALUES (?, ?, ?, 0, ?, ?, ?)`
      )
        .bind(email, ipHash, await sha256Hex(randomToken(16)), now, now, now)
        .run();
      await sendExistingAccountEmail(env, request, { email, name }).catch(() => false);
      return json({ ok: true, expiresIn: EXPIRES_IN_SECONDS, resendAfter: RESEND_AFTER_SECONDS });
    }

    const code = randomCode();
    const codeHash = await sha256Hex(email + ':' + code);
    await env.DB.prepare('UPDATE signup_codes SET consumed_at = ? WHERE email = ? AND consumed_at IS NULL')
      .bind(now, email)
      .run();
    await env.DB.prepare(
      `INSERT INTO signup_codes (email, ip_hash, code_hash, attempts, created_at, expires_at, consumed_at)
       VALUES (?, ?, ?, 0, ?, ?, NULL)`
    )
      .bind(email, ipHash, codeHash, now, now + CODE_TTL_MS)
      .run();

    const sent = await sendSignupCodeEmail(env, request, { email, name, code });
    if (!sent) return fail('MAIL_SEND_FAILED', 502);

    const payload = { ok: true, expiresIn: EXPIRES_IN_SECONDS, resendAfter: RESEND_AFTER_SECONDS };
    if (devMailMode(env, request)) payload.devCode = code;
    return json(payload);
  } catch (error) {
    return serverError(error);
  }
}
