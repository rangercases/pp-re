# Packaging & Git Deployment Rules

## 1. Single-File Packaging (Đóng gói khép kín)
* Mọi tính năng, giao diện, thư viện font, style CSS và logic JavaScript của ứng dụng/báo cáo bắt buộc phải nằm khép kín bên trong duy nhất một file `index.html`.
* Thư viện bên ngoài ưu tiên tải qua CDN online ổn định (như cdnjs, jsdelivr).
* Font tiếng Việt, dữ liệu base, icon cục bộ phải được nhúng trực tiếp (inlined / base64) bên trong `index.html`. Không tách ra thành các file rời như `.js`, `.css`.

## 2. Git Tracking & Upload Restriction
* Chỉ cho phép theo dõi và đẩy duy nhất tệp `index.html` (cùng cấu hình Git `.gitignore` / workflows cần thiết) lên kho lưu trữ GitHub.
* Tuyệt đối KHÔNG commit hoặc push bất kỳ file nào sau đây lên Git:
  - File dữ liệu JSON, CSV, Excel (ví dụ: `*.json`, `*.xlsx`, `*.csv`).
  - File tài liệu xuất ra: `*.pdf`.
  - File tài nguyên rời: `*.png`, `*.jpg`, `*.svg`, `font_*.js`.
  - File cấu hình IDE hoặc tạm: `.vscode/`, `scratch/`, `*.log`.
