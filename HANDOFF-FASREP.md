# BÀN GIAO FASREP — 2026-10-28

Tài liệu này để AI/người tiếp nhận trên máy khác nắm đúng tình hình. Cập nhật lần cuối: 2026-10-28 ~08:55 UTC (15:55 giờ VN).

## 1. Dự án là gì

FASREP — PWA nội bộ SOFACOMPANY để làm báo cáo audit (ảnh + checklist), xuất PDF. Toàn bộ app nằm trong MỘT file `index.html` ở repo root (~19.200 dòng, Vite + vite-plugin-singlefile, `minify:false`, `treeshake:false`), build ra `dist/index.html`.

- Thư mục hiện tại: `C:\Users\vn.technical03\OneDrive - SOFACOMPANY\Antigravity SCHung\Super Report`
- Repo: https://github.com/rangercases/pp-re (nhánh `main`)
- Commit mới nhất: `3bc8e5b feat(auth): add account login, roles and per-user local data`
- Working tree sạch tính đến lúc bàn giao. **Chưa có dòng code nào cho đăng ký mở / OTP email.**

## 2. Ba bề mặt đang chạy

| Bề mặt | Địa chỉ | Cách cập nhật |
|---|---|---|
| **Chính thức** | https://fasrep.com (+ www.fasrep.com) | `npm run deploy` (build + wrangler pages deploy project `fasrep`) |
| Bản phụ | https://fasrep.pages.dev | cùng project Pages, cùng lần deploy |
| GitHub Pages | https://rangercases.github.io/pp-re | tự chạy workflow `Deploy to GitHub Pages` mỗi lần push `main` |
| Project cũ | https://super-report.pages.dev | không xoá, không dùng nữa |

GitHub Pages **không chạy được Pages Functions** → bản này chỉ hiện màn hình thông báo trỏ về `AUTH_OFFICIAL_URL` (hiện vẫn là `https://fasrep.pages.dev/`, chưa đổi sang fasrep.com).

## 3. Định danh hạ tầng (không phải secret)

- Cloudflare account: `cb7a564e04867345ce3fdc5448489c33` (rangercases@gmail.com, đăng nhập wrangler bằng OAuth)
- Zone `fasrep.com`: `bb2e4d1d0d5b146a98612c3136e56caa`, status `active`
- D1 database: tên `fasrep-auth`, id `dabae723-d9e3-4240-9c48-80c8baf94fea`, region APAC
- Pages project: `fasrep`, production branch `main`, Git Provider = No (deploy thủ công)
- Custom domains: `fasrep.com` + `www.fasrep.com` — **cả hai status active, chứng chỉ HTTPS active** (gắn lúc 08:41–08:43 UTC 2026-10-28)
- Turnstile: **chưa có widget nào**
- Pages env/secrets: **trống** (cả production và preview)

### Quyền của token wrangler trên máy này
Có `pages (write)`, `challenge-widgets.write` (Turnstile), `email_sending (write)`, `d1 (write)`, `zone (read)` — **không có quyền sửa DNS zone**. Token nằm ở `%APPDATA%\xdg.config\.wrangler\config\default.toml`; máy khác phải chạy `npx wrangler login` lại, **không copy token qua chat**.

## 4. Trạng thái xác thực hiện tại (đã kiểm bằng API lúc 08:50 UTC)

- `GET https://fasrep.com/api/auth/state` → `{"ok":true,"hasUsers":true,"user":null}` — Functions chạy đúng trên domain mới.
- D1 `users` có đúng 1 dòng, chính là Admin đầu tiên:
  - id `1`, email `buiquochung1199@gmail.com`, tên `Han`, role `admin`, active
  - tạo 2026-10-28 07:45 UTC (trên pages.dev), đăng nhập cuối 08:04 UTC
- Vì `hasUsers=true`, giao diện ở cả hai domain chỉ hiện **đăng nhập**, không hiện đăng ký. Đây KHÔNG phải "trình duyệt nhớ pages.dev" — hai domain dùng chung D1.
- Cookie phiên gắn theo từng hostname → phải đăng nhập riêng ở fasrep.com.

### Auth đã triển khai (v3.3.0)
- `functions/api/auth/`: `state.js` (GET trạng thái), `signup.js` (chỉ tạo được user đầu tiên rồi trả `SIGNUP_CLOSED`), `login.js`, `logout.js`, `me.js`, `password.js`
- `functions/api/admin/users/index.js` (GET list, POST tạo user) và `[id].js` (PATCH khóa/đổi role/đặt lại mật khẩu; chặn tự đổi role chính mình và chặn mất Admin cuối cùng)
- `functions/_lib/auth.js` (PBKDF2-SHA256 100.000 vòng — mức tối đa workerd cho phép, salt 16B, hash 32B, format `pbkdf2$iterations$saltB64$hashB64`, so sánh timing-safe, PBKDF2 giả để chống dò email), `_lib/session.js` (token 32B base64url, lưu SHA-256 trong D1, cookie `fasrep_session` HttpOnly/SameSite=Lax/Path=//30 ngày/Secure trên https), `_lib/http.js` (JSON, same-origin guard)
- Khóa tạm: sai 10 lần → 15 phút
- Schema: `db/schema.sql` (bảng `users`, `sessions`, index) — đã apply remote
- Frontend: khối auth trong `index.html` từ ~dòng 18511; boot gate trước `initDB()`; session cache localStorage `fasrep.session.v1` (30 ngày, dùng offline); màn GitHub Pages thông báo tại ~dòng 6597; `AUTH_OFFICIAL_URL` dòng 18514; `APP_VERSION` dòng 8286; badge `[V3.3.0]` dòng 6729
- Tách dữ liệu theo tài khoản: `SofaCompanyPP_DB_Lite::<userId>` và `SofaCompanyPP_FS::<userId>`; localStorage bọc qua `scopedStorageKey()`; DB gốc giữ nguyên; lần đầu đăng nhập hỏi sao chép báo cáo cũ một lần
- Service worker: `pp-review-v3.3.0` (2 bản: `service-worker.js` và `public/service-worker.js`, phải sửa cả hai), bypass `/api/*`

## 5. Việc đang dở: đăng ký mở + mã xác thực email

Yêu cầu người dùng: cho phép tự đăng ký như các web quốc tế, gửi mã xác thực 6 số về email đăng ký.

### Thiết kế đã thống nhất (CHƯA viết code)
- Thêm bảng D1 `signup_codes`: email, mã băm SHA-256, `expires_at` (15 phút), `attempts` (tối đa 5 lần sai), `ip`, `created_at`, `last_sent_at`
- API mới:
  - `POST /api/auth/signup/request` — nhận email + Turnstile token, kiểm tra rate limit, sinh mã 6 số, gửi mail, trả về thông báo chung (không lộ email tồn tại hay không)
  - `POST /api/auth/signup/verify` — nhận email + mã + tên + mật khẩu, tạo user, **user đầu tiên khi bảng trống mới là Admin**, còn lại là User (hiện bảng đã có Admin nên mọi người mới sẽ là User)
- Chống lạm dụng: gửi lại tối thiểu 60 giây; tối đa 3 mã/email/giờ và 10/IP/giờ; mã sai 5 lần thì huỷ; Turnstile xác thực phía server (`siteverify`)
- Giữ nguyên: đăng nhập, đổi mật khẩu, Admin tạo user thủ công
- Dự kiến nâng phiên bản 3.4.0 (badge, `APP_VERSION`, `package.json`, `package-lock.json`, cache SW, `scripts/assert-build.js`)
- Dự kiến đổi `AUTH_OFFICIAL_URL` và link ở màn GitHub Pages sang `https://fasrep.com/`

### Quyết định còn treo
1. **Dịch vụ gửi mail** — chọn 1:
   - **Cloudflare Email Service** (khuyến nghị: miễn phí, domain đã ở Cloudflare DNS, không thêm dịch vụ ngoài). Cần người dùng: Compute → Email Service → Email Sending → **Onboard Domain** `fasrep.com`, rồi tạo API token quyền **Email Sending: Edit**. Pages Functions **không hỗ trợ binding `send_email`**, nên code phải gọi REST `POST /accounts/{account_id}/email/sending/send`, token lưu làm secret `EMAIL_API_TOKEN` (chưa đặt).
   - **Resend** — cần tạo tài khoản, xác thực domain (thêm bản ghi DNS thủ công vì token wrangler không có quyền sửa DNS), tạo API key, lưu secret `RESEND_API_KEY`.
2. **Turnstile** — chưa tạo widget. Có thể tạo qua API bằng token wrangler (`challenge-widgets.write`), lấy sitekey + secret, lưu `TURNSTILE_SECRET_KEY` vào Pages. Cần duyệt trước khi làm.

## 6. Thứ tự công việc đề xuất

1. Chốt dịch vụ gửi mail; người dùng bật domain gửi mail + tạo token (nếu chọn Cloudflare Email Service).
2. Tạo Turnstile widget + lưu secret (xin duyệt).
3. Backup trước khi sửa mã: copy `index.html`, `functions/`, `db/` vào `%TEMP%\fasrep-backup-<ngày>\`.
4. Viết code đăng ký mở + OTP + frontend 2 bước (xin duyệt phạm vi trước).
5. Test E2E local bằng `wrangler pages dev` với D1 local, Turnstile test key, chế độ dev in mã ra console **chỉ khi thiếu token gửi mail và chạy localhost**.
6. Nâng version 3.4.0 + cập nhật `scripts/assert-build.js`, build phải pass.
7. Xin duyệt riêng từng bước remote: apply schema D1 → `npm run deploy` → commit + push `main`.
8. Kiểm chứng: hash `dist/index.html` khớp bản Cloudflare (gọi URL gốc `/`), marker mới trên GitHub Pages, luồng đăng ký thật với email thật.

## 7. Lệnh và lỗi cần biết

```bash
npm run build                 # build + scripts/assert-build.js (32 check)
npm run deploy                # build + xoá artifact gây lỗi + wrangler pages deploy dist --project-name fasrep --branch main
npx wrangler d1 execute fasrep-auth --remote --command "SELECT ..."   # truy vấn D1 production
npx wrangler pages dev dist --d1=DB=fasrep-auth --persist-to %TEMP%\fasrep-dev   # test local
```

- **Bắt buộc** dùng `npm run deploy` (đã gồm `scripts/prepare-pages-deploy.js` xoá `dist/wrangler.json` và `.wrangler/deploy/config.json`); nếu không wrangler báo `Configuration file for Pages projects does not support "assets"`.
- `curl https://fasrep.com/index.html` có thể trả rỗng — luôn gọi URL gốc `/`.
- GitHub Pages phục vụ file từ **repo root**, không phải `dist` → asset tĩnh mới phải có bản ở root lẫn `public/`.
- `.gitignore` whitelist `functions/`, `db/`, `wrangler.json` — kiểm tra lại nếu thêm thư mục mới.
- `wrangler.json` ở root khai báo binding `DB` → D1 `fasrep-auth`.
- Repo có nhiều file backup `backup_index_*.html` ở root — của người dùng, không xoá.

## 8. Ràng buộc bắt buộc (luật của người dùng)

- **Agent Safety Rules v4 trên laptop công ty**: mọi thay đổi file/hệ thống/dịch vụ ngoài phải trình phạm vi + backup, chờ người dùng trả lời **"Duyệt"** rồi mới chạy; hỏi duyệt riêng cho từng bước remote (D1, deploy, push).
- Lệnh bị cấm tuyệt đối: `del /s`, `rmdir /s`, `rd /s`, `rm -rf`, `Remove-Item -Recurse/-Force`, `format`, `diskpart`, `regedit`, `takeown`, `icacls /grant`, vòng `for ... do del`, `xcopy/robocopy /MIR`.
- Vùng bảo vệ: `C:\Windows`, `C:\Program Files*`, `C:\ProgramData`, `C:\Users\*\AppData`; đặc biệt `C:\Users\vn.technical03\OneDrive - SOFACOMPANY\General\` và toàn bộ OneDrive công ty — **không ghi file nháp/benchmark vào OneDrive, dùng `%TEMP%`**.
- Không thêm dependency npm nếu chưa được duyệt; không refactor ngoài phạm vi.
- Không đổi tên IndexedDB `SofaCompanyPP_DB_Lite` / `SofaCompanyPP_FS` (chỉ được thêm hậu tố `::<userId>`), không đổi key localStorage cũ (chỉ thêm hậu tố scoped), không đổi `start_url`/`scope` manifest, không đổi tên repo/thư mục.
- Không xoá dữ liệu người dùng khi chưa được yêu cầu rõ ràng.
- Chỉ commit/push khi được yêu cầu; mỗi lần push xin duyệt riêng.
- Cách xưng hô: không gọi người/agent khác là "nó".

## 9. Dữ liệu theo origin (quan trọng)

IndexedDB/localStorage gắn theo từng origin. Báo cáo tạo trên `fasrep.pages.dev` sẽ **không hiện** trên `fasrep.com`. Chuyển dữ liệu: mở pages.dev → xuất `.json` (Ctrl+S) → mở fasrep.com → nhập lại. Admin hiện tại mới đăng nhập, chưa có dữ liệu thật cần chuyển.

## 10. Liên hệ trạng thái nhanh

```bash
curl -s https://fasrep.com/api/auth/state
npx wrangler d1 execute fasrep-auth --remote --command "SELECT id,email,role,is_active FROM users"
```
