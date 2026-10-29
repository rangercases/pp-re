const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const MAIL_FROM = 'FASREP <support@fasrep.com>';
const MAIL_REPLY_TO = 'support@fasrep.com';
const APP_URL = 'https://fasrep.com/';
const REQUEST_TIMEOUT_MS = 8000;

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Chỉ bật khi chạy local (DEV_MAIL_MODE trong .dev.vars) VÀ host là localhost.
// Production không bao giờ thỏa cả hai điều kiện nên mã không thể lộ qua response.
export function devMailMode(env, request) {
  if (!env || env.DEV_MAIL_MODE !== 'console') return false;
  try {
    const host = new URL(request.url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  } catch (err) {
    return false;
  }
}

export function mailerConfigured(env, request) {
  return Boolean(env && env.RESEND_API_KEY) || devMailMode(env, request);
}

async function sendWithResend(env, payload) {
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + env.RESEND_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('Resend rejected email:', res.status, detail.slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error('Resend request failed:', err && err.message ? err.message : err);
    return false;
  }
}

function codeEmail(name, code) {
  const safeName = escapeHtml(name || '');
  const greeting = safeName ? `Chào ${safeName},` : 'Chào bạn,';
  return {
    subject: `Mã xác thực FASREP: ${code}`,
    text: [
      greeting,
      '',
      `Mã xác thực FASREP của bạn là: ${code}`,
      'Mã có hiệu lực 15 phút và chỉ dùng được một lần.',
      '',
      'Nếu không phải bạn yêu cầu tạo tài khoản, hãy bỏ qua email này.',
      '',
      APP_URL,
    ].join('\n'),
    html: `<!doctype html><html lang="vi"><body style="margin:0;padding:24px;background:#f5f6f4;font-family:Arial,Helvetica,sans-serif;color:#1f2a24;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e3e7e2;border-radius:12px;padding:28px;">
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b7a70;font-weight:700;">FASREP</p>
    <h1 style="margin:0 0 14px;font-size:20px;line-height:1.35;">Mã xác thực đăng ký</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${greeting}</p>
    <p style="margin:0 0 10px;font-size:14px;line-height:1.6;">Dùng mã dưới đây để hoàn tất tạo tài khoản:</p>
    <p style="margin:0 0 16px;font-size:32px;letter-spacing:.28em;font-weight:700;font-family:Consolas,Menlo,monospace;color:#0A7E5C;">${code}</p>
    <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#55635b;">Mã có hiệu lực <b>15 phút</b> và chỉ dùng được một lần.</p>
    <p style="margin:0 0 4px;font-size:13px;line-height:1.6;color:#55635b;">Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>
    <p style="margin:18px 0 0;font-size:13px;"><a href="${APP_URL}" style="color:#0A7E5C;">${APP_URL}</a></p>
  </div>
</body></html>`,
  };
}

function existingAccountEmail(name) {
  const safeName = escapeHtml(name || '');
  const greeting = safeName ? `Chào ${safeName},` : 'Chào bạn,';
  return {
    subject: 'Email này đã có tài khoản FASREP',
    text: [
      greeting,
      '',
      'Email này đã được dùng để tạo tài khoản FASREP.',
      `Nếu là bạn, hãy đăng nhập tại ${APP_URL}`,
      'Nếu quên mật khẩu, liên hệ support@fasrep.com để được cấp lại.',
      '',
      'Nếu không phải bạn yêu cầu, hãy bỏ qua email này.',
    ].join('\n'),
    html: `<!doctype html><html lang="vi"><body style="margin:0;padding:24px;background:#f5f6f4;font-family:Arial,Helvetica,sans-serif;color:#1f2a24;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e3e7e2;border-radius:12px;padding:28px;">
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b7a70;font-weight:700;">FASREP</p>
    <h1 style="margin:0 0 14px;font-size:20px;line-height:1.35;">Email đã có tài khoản</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${greeting}</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">Email này đã được dùng để tạo tài khoản FASREP. Nếu là bạn, hãy đăng nhập tại <a href="${APP_URL}" style="color:#0A7E5C;">${APP_URL}</a>.</p>
    <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#55635b;">Nếu quên mật khẩu, liên hệ <a href="mailto:support@fasrep.com" style="color:#0A7E5C;">support@fasrep.com</a> để được cấp lại.</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#55635b;">Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>
  </div>
</body></html>`,
  };
}

export async function sendSignupCodeEmail(env, request, { email, name, code }) {
  if (devMailMode(env, request)) {
    console.log(`[DEV MAIL] mã xác thực cho ${email}: ${code}`);
    return true;
  }
  const mail = codeEmail(name, code);
  return sendWithResend(env, {
    from: MAIL_FROM,
    reply_to: MAIL_REPLY_TO,
    to: [email],
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
}

export async function sendExistingAccountEmail(env, request, { email, name }) {
  if (devMailMode(env, request)) {
    console.log(`[DEV MAIL] báo email đã có tài khoản: ${email}`);
    return true;
  }
  const mail = existingAccountEmail(name);
  return sendWithResend(env, {
    from: MAIL_FROM,
    reply_to: MAIL_REPLY_TO,
    to: [email],
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
}
