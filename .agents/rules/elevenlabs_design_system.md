---
trigger: always_on
description: Mandatory ElevenLabs Design System and UI/UX rules for FASREP
---

# MANDATORY UI/UX & DESIGN SYSTEM RULE (FASREP - ELEVENLABS STYLE)
> ⚠️ **PHẠM VI ĐỘC QUYỀN:** Rule này CHỈ ÁP DỤNG cho dự án FASREP.
> Tuyệt đối KHÔNG áp dụng cho phiên bản V2.0 cũ (ArtCraft Studio Style với 0px border-radius).

Khi thực hiện bất kỳ công việc nào liên quan đến giao diện (UI), trải nghiệm người dùng (UX), CSS/styling, layout, màu sắc, font chữ hoặc các tương tác frontend trên dự án **FASREP**:

## 1. BẮT BUỘC ĐỌC VÀ TUÂN THỦ TÀI LIỆU THIẾT KẾ:
- Bạn PHẢI luôn tham chiếu và áp dụng các nguyên tắc, bảng mã màu, typography, khoảng cách (spacing), Bento Grid, và animation được định nghĩa chi tiết tại:
  `.agents/rules/elevenlabs_design_system.md` (mục 2 dưới đây)

---

## 2. NGUYÊN TẮC BẤT BIẾN CỦA PHONG CÁCH ELEVENLABS:

### A. TONE NỀN & BỀ MẶT (WARM PAPER & BENTO SURFACES):
- **Nền chính (Canvas):** Nền web mang màu kem giấy ấm `var(--page-bg: #F5F3F1)`. Tránh dùng nền trắng thuần chói mắt hoặc xám tối kim loại.
- **Thẻ Bento (Surface Cards):** Nền trắng thuần `#FFFFFF` nổi nhẹ trên nền kem, sử dụng đường viền siêu mảnh **Hairline Ring** (`box-shadow: 0 0 0 1px rgba(0,0,0,0.065)` hoặc `ring-0.5`). Tuyệt đối không dùng viền xám đậm hoặc drop-shadow đen ngòm.

### B. HÌNH HỌC & BO GÓC (RADIUS HIERARCHY):
- **Tuyệt đối KHÔNG dùng góc vuông `0px` như V2.0:**
  - Thẻ Card / Bento: `border-radius: 16px` (`rounded-2xl`) hoặc `20px`.
  - Khung ảnh / Thẻ phụ: `border-radius: 12px` (`rounded-xl`).
  - Nút bấm, Ô tìm kiếm, Badge trạng thái, Tab chọn: `border-radius: 9999px` (`rounded-full` dạng viên thuốc Pill).

### C. TYPOGRAPHY & TABULAR NUMBERS:
- **Heading:** Phông thanh lịch, hiện đại, tracking chặt chẽ nhẹ `-0.02em`.
- **Số liệu & Thống kê:** BẮT BUỘC áp dụng `font-variant-numeric: tabular-nums;` cho mọi trường kích thước, ngày tháng, đếm số lượng báo cáo trên tab (`ALL (12) | DONE (8) | WIP (4)`).
- **Metadata / Tag:** Viết hoa `UPPERCASE`, kích thước nhỏ 10px-11px, tracking thoáng `0.05em`.

### D. TƯƠNG TÁC XÚC GIÁC (TACTILE MICRO-INTERACTIONS):
- Khi nhấn nút hoặc thẻ: `active: transform: scale(0.98);` tạo cảm giác nảy cơ học.
- Chuyển động mượt mà bằng đường cong Bézier: `cubic-bezier(0.4, 0, 0.2, 1)` với thời gian `150ms - 200ms`.
- Hover mềm mại bằng lớp phủ mực nhẹ `rgba(0, 0, 0, 0.025)`.

### E. TỐI ƯU CÔNG NĂNG & THAO TÁC NHANH:
- **Cụm nút điều hướng chính:** Gom các nút tạo mới và tác vụ thường dùng thành hàng ngang tinh gọn (nút chính `+ NEW REPORT` mang màu đen nổi bật `#000000`, nút phụ dạng outline hairline).
- **Cất các tính năng hệ thống:** Các tính năng nguy hiểm hoặc ít dùng (như Backup / Restore data) đưa vào menu phụ (icon bánh răng `⚙️` hoặc `...`) kèm hộp thoại xác nhận an toàn trước khi chạy.
- **Chuỗi dữ liệu không lỗi:** Dùng `.filter(Boolean).join(' · ')` để loại bỏ triệt để lỗi dấu chấm đôi `· ·` khi thiếu dữ liệu.
- **100% Tiếng Anh:** Thống nhất toàn bộ từ ngữ trên giao diện, không trộn lẫn song ngữ.

---

## 3. QUY TRÌNH THỰC THI AN TOÀN (SAFETY PROTOCOL):
- Mọi thao tác file HTML/JS/CSS đều phải lập Plan và hỏi xác nhận `(Y/N)` theo `RULE[user_global]`.
- Sau khi chỉnh sửa code, luôn chạy `npm run build` để xác thực cú pháp và đóng gói cập nhật vào `dist/index.html`.
