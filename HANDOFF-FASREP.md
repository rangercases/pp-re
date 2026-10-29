# BÀN GIAO FASREP — cập nhật 2026-10-29

Tài liệu này để AI/người tiếp nhận trên máy khác nắm đúng tình hình. Cập nhật lần cuối: 2026-10-29 ~10:30 UTC (17:30 giờ VN).

## 1. Dự án là gì

FASREP — PWA nội bộ SOFACOMPANY để làm báo cáo audit (ảnh + checklist), xuất PDF. Toàn bộ app nằm trong MỘT file `index.html` ở repo root (~19.200 dòng, Vite + vite-plugin-singlefile, `minify:false`, `treeshake:false`), build ra `dist/index.html`.

- Thư mục hiện tại: `C:\Users\vn.technical03\OneDrive - SOFACOMPANY\Antigravity SCHung\Super Report`
- Repo: https://github.com/rangercases/pp-re (nhánh `main`)
- Commit mới nhất trên GitHub: `d781d31 docs: add FASREP handoff notes for another machine`
- **Working tree đang có thay đổi chưa commit** của bản v3.4.0 (đăng ký mở + OTP email) — đã deploy Cloudflare nhưng **chưa push lên GitHub** (chờ duyệt).

## 2. Ba bề mặt đang chạy

| Bề mặt | Địa chỉ | Cách cập nhật |
|---|---|---|
| **Chính thức** | https://fasrep.com (+ www.fasrep.com) | `npm run deploy` (build + wrangler pages deploy project `fasrep`) |
| Bản phụ | https://fasrep.pages.dev | cùng project Pages, cùng lần deploy |
| GitHub Pages | https://rangercases.github.io/pp-re | tự chạy workflow `Deploy to GitHub Pages` mỗi lần push `main` |
| Project cũ | ~~https://super-report.pages.dev~~ | **đã xoá project 2026-10-29** (bản v3.2.0 không còn truy cập được) |

GitHub Pages **không chạy được Pages Functions** → bản này chỉ hiện màn hình thông báo trỏ về `AUTH_OFFICIAL_URL` (đã đổi sang `https://fasrep.com/` ở v3.4.0).

## 3. Định danh hạ tầng (không phải secret)

- Cloudflare account: `cb7a564e04867345ce3fdc5448489c33` (rangercases@gmail.com, đăng nhập wrangler bằng OAuth)
- Zone `fasrep.com`: `bb2e4d1d0d5b146a98612c3136e56caa`, status `active`
- D1 database: tên `fasrep-auth`, id `dabae723-d9e3-4240-9c48-80c8baf94fea`, region APAC
- Pages project: `fasrep`, production branch `main`, Git Provider = No (deploy thủ công)
- Custom domains: `fasrep.com` + `www.fasrep.com` — **cả hai status active, chứng chỉ HTTPS active** (gắn lúc 08:41–08:43 UTC 2026-10-28)
- Turnstile: **chưa có widget nào** (chưa bật cho đăng ký)
- Pages env/secrets (Production): `RESEND_API_KEY` (Resend, quyền Sending access, domain `fasrep.com` đã Verified). Không có secret nào khác.

### Quyền của token wrangler trên máy này
Có `pages (write)`, `challenge-widgets.write` (Turnstile), `email_sending (write)`, `d1 (write)`, `zone (read)` — **không có quyền sửa DNS zone**. Token nằm ở `%APPDATA%\xdg.config\.wrangler\config\default.toml`; máy khác phải chạy `npx wrangler login` lại, **không copy token qua chat**.

## 4. Trạng thái xác thực hiện tại (kiểm 2026-10-29)

- `GET https://fasrep.com/api/auth/state` → `{"ok":true,"hasUsers":true,"user":null}` — Functions chạy đúng trên domain mới.
- D1 `users` có 2 dòng:
  - id `1`, email `buiquochung1199@gmail.com`, role `admin` (Admin đầu tiên, tạo 2026-10-28)
  - id `2`, email `ngtnhi29@gmail.com`, role `user`
- Vì `hasUsers=true`, giao diện chỉ hiện **đăng nhập**, nhưng từ v3.4.0 đã có nút **Đăng ký** cho người mới (OTP email).
- Cookie phiên gắn theo từng hostname → phải đăng nhập riêng ở fasrep.com và fasrep.pages.dev. Dữ liệu báo cáo cũng tách theo origin.

### Auth đã triển khai (v3.4.0)
- `functions/api/auth/`: `state.js` (GET trạng thái), `signup/request.js` + `signup/verify.js` (đăng ký mở bằng mã OTP), `login.js`, `logout.js`, `me.js`, `password.js`
- `functions/_lib/mail.js` — gửi mail qua Resend REST (`POST https://api.resend.com/emails`), From `FASREP <support@fasrep.com>`, Reply-To `support@fasrep.com`; chế độ dev `DEV_MAIL_MODE=console` chỉ hoạt động khi host là localhost
- `functions/api/admin/users/index.js` (GET list, POST tạo user) và `[id].js` (PATCH khóa/đổi role/đặt lại mật khẩu; chặn tự đổi role chính mình và chặn mất Admin cuối cùng)
- `functions/_lib/auth.js` (PBKDF2-SHA256 100.000 vòng — mức tối đa workerd cho phép, salt 16B, hash 32B, format `pbkdf2$iterations$saltB64$hashB64`, so sánh timing-safe, PBKDF2 giả để chống dò email), `_lib/session.js` (token 32B base64url, lưu SHA-256 trong D1, cookie `fasrep_session` HttpOnly/SameSite=Lax/Path=//30 ngày/Secure trên https), `_lib/http.js` (JSON, same-origin guard)
- Khóa tạm: sai 10 lần → 15 phút
- Schema: `db/schema.sql` (bảng `users`, `sessions`, `signup_codes` + index) — đã apply remote, dữ liệu cũ nguyên vẹn
- Frontend: khối auth trong `index.html` (~dòng 18580 là `AUTH_OFFICIAL_URL`); boot gate trước `initDB()`; session cache localStorage `fasrep.session.v1` (30 ngày, dùng offline); màn GitHub Pages thông báo ~dòng 6640; `APP_VERSION` dòng 8352; badge `[V3.4.0]` dòng 6795
- Tách dữ liệu theo tài khoản: `SofaCompanyPP_DB_Lite::<userId>` và `SofaCompanyPP_FS::<userId>`; localStorage bọc qua `scopedStorageKey()`; DB gốc giữ nguyên; lần đầu đăng nhập hỏi sao chép báo cáo cũ một lần
- Service worker: `pp-review-v3.4.0` (2 bản: `service-worker.js` và `public/service-worker.js`, phải sửa cả hai), bypass `/api/*`

## 5. Đăng ký mở + OTP — ĐÃ XONG (v3.4.0, deploy 2026-10-29)

Người dùng tự đăng ký: nhập họ tên/email/mật khẩu → hệ thống gửi mã 6 số → nhập mã là có tài khoản và **đăng nhập luôn**. Chi phí 0 đồng (Resend Free 3.000 mail/tháng, 100/ngày).

### Đã triển khai
- Bảng D1 `signup_codes`: `email`, `ip_hash`, `code_hash` (SHA-256 của `email + ':' + code`), `attempts`, `created_at`, `expires_at` (15 phút), `consumed_at`
- `POST /api/auth/signup/request` — kiểm tra Origin/JSON/email/mật khẩu → cooldown 60s/email → 3 mã/email/giờ, 10 mã/IP/giờ → sinh mã, gửi Resend; email đã tồn tại vẫn trả response y hệt nhưng gửi thư “đã có tài khoản” và không tạo mã dùng được (chống dò email)
- `POST /api/auth/signup/verify` — mã sai 5 lần → `CODE_LOCKED`; đúng → tạo user (Admin nếu bảng `users` trống, còn lại là User), tạo phiên, set-cookie → vào app ngay
- Frontend 2 bước: panel `#authSignupForm` → `#authVerifyForm` (ô `#authCodeInput`, đếm ngược gửi lại 60s, nút quay lại giữ thông tin)
- Mã lỗi frontend: `INVALID_CODE` (+số lần còn lại), `CODE_EXPIRED`, `CODE_LOCKED`, `CODE_COOLDOWN`, `RATE_LIMITED`, `MAIL_SEND_FAILED`, `MAIL_NOT_CONFIGURED`
- Đã xoá endpoint cũ `functions/api/auth/signup.js` (chỉ tạo Admin đầu tiên)

### Còn treo (chưa làm)
- **Turnstile**: chưa bật. Có thể thêm sau mà không đổi API — chỉ cần secret `TURNSTILE_SECRET_KEY` + widget ở frontend.
- Theo dõi vài ngày đầu: thư OTP có thể vào Spam lần đầu (Resend dùng IP chung).

## 6. Việc còn lại

1. (Chờ duyệt) Commit + push `main` cho bản v3.4.0 — hiện mới deploy Cloudflare, GitHub Pages vẫn là bản cũ.
2. Người dùng tự đăng ký thử trên https://fasrep.com bằng email thật để xác nhận thư Resend về hộp.
3. Tuỳ chọn: bật Turnstile nếu bị spam đăng ký.
4. Tuỳ chọn: chặn/redirect `fasrep.pages.dev` → `fasrep.com` (Cloudflare Access hoặc Worker). `super-report.pages.dev` đã xoá 2026-10-29.

## 7. Lệnh và lỗi cần biết

```bash
npm run build                 # build + scripts/assert-build.js (38 check)
npm run deploy                # build + xoá artifact gây lỗi + wrangler pages deploy dist --project-name fasrep --branch main
npx wrangler d1 execute fasrep-auth --remote --command "SELECT ..."   # truy vấn D1 production
npx wrangler pages secret list --project-name fasrep                  # xem secret (không in giá trị)
npx wrangler pages dev dist --persist-to="%TEMP%\fasrep-dev" --port 8788   # test local
```

- **Test local D1**: `wrangler d1 execute <tên> --local --persist-to=X` và `wrangler pages dev --persist-to=X` có thể ghi vào **hai file sqlite khác nhau** trong `X/v3/d1/miniflare-D1DatabaseObject/` (một theo tên DB, một theo `database_id`). Nếu dev server báo `DB_NOT_INITIALIZED`: checkpoint file có schema rồi copy đè lên file mà dev server dùng (xem thư mục đó có 2 file `.sqlite`, file rỗng là của dev server).
- Dev mail: tạo `.dev.vars` (đã gitignore) với `DEV_MAIL_MODE=console` → mã in ra console và trả `devCode`; **chỉ khi host là localhost/127.0.0.1**.

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
