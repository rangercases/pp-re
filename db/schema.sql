-- FASREP auth schema (Cloudflare D1 / SQLite)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  password_hash TEXT NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  INTEGER,
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash   TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Mã xác thực đăng ký: chỉ lưu hash, mỗi email dùng mã mới nhất chưa tiêu thụ.
CREATE TABLE IF NOT EXISTS signup_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL COLLATE NOCASE,
  ip_hash     TEXT NOT NULL DEFAULT '',
  code_hash   TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  consumed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_signup_codes_email_created ON signup_codes(email, created_at);
CREATE INDEX IF NOT EXISTS idx_signup_codes_ip_created ON signup_codes(ip_hash, created_at);

-- Danh sách email được phép tự đăng ký, do admin quản lý. Bảng rỗng (hoặc
-- chưa được tạo) nghĩa là đăng ký đang mở — để lần triển khai đầu tiên còn
-- tạo được tài khoản admin; ngay khi có ít nhất một dòng, chỉ các email
-- trong danh sách mới nhận được mã đăng ký.
CREATE TABLE IF NOT EXISTS signup_allowlist (
  email      TEXT PRIMARY KEY COLLATE NOCASE,
  note       TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

-- Sổ kế toán dung lượng R2: mỗi object ảnh đã lưu trong bucket
-- fasrep-photos có đúng một dòng ở đây. PUT /api/photos cộng tổng
-- size_bytes trước khi nhận upload mới và từ chối khi vượt hạn mức
-- ngân sách (mặc định 9 GB, dưới trần miễn phí 10 GB của R2) để tài
-- khoản không bao giờ bị tính phí R2.
CREATE TABLE IF NOT EXISTS photo_objects (
  object_key TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0
);
