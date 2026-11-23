---
title: "Checklist review code backend do agent viết"
description: "một danh sách để duyệt nhanh nhưng không bỏ sót khi agent nộp code backend. Dùng cùng ../02-quy-trinh-phan-mem/06-code-review.md. Chi tiết từng chủ đề nằm ở mục \"Checklist..."
pubDatetime: 2026-11-18T20:00:00Z
featured: false
tags:
  - backend
  - system-design
  - checklist
---
# Checklist review code backend do agent viết

**Mục đích:** một danh sách để duyệt nhanh nhưng không bỏ sót khi agent nộp code backend. Dùng cùng [../02-quy-trinh-phan-mem/06-code-review.md](../02-quy-trinh-phan-mem/06-code-review.md). Chi tiết từng chủ đề nằm ở mục "Checklist review" cuối mỗi file 01–12.
**Liên quan:** [00-README.md](00-README.md) · [01-authentication.md](01-authentication.md) · [03-phan-quyen.md](03-phan-quyen.md) · [07-thiet-ke-database.md](07-thiet-ke-database.md) · [08-thiet-ke-api.md](08-thiet-ke-api.md) · [10-messaging-kafka.md](10-messaging-kafka.md) · [11-bao-mat.md](11-bao-mat.md) · [12-observability-reliability.md](12-observability-reliability.md)

---

## Cách dùng

1. Đọc yêu cầu (FR/AC) trước, **rồi** mới đọc diff.
2. Đi qua từng nhóm dưới đây; ghi "N/A" cho nhóm không liên quan.
3. Mục đánh dấu 🔴 = vi phạm thì **Request changes**, không duyệt có điều kiện.
4. Đòi bằng chứng: lệnh test + output, migration chạy thử, kết quả EXPLAIN cho truy vấn mới trên bảng lớn.

## A. Phạm vi và tính đúng

- [ ] Chỉ sửa trong phạm vi task; không refactor lan rộng, không đổi file không liên quan.
- [ ] Mọi AC có test tương ứng; test thất bại nếu bỏ phần code mới.
- [ ] 🔴 Không sửa/xóa/skip test cũ để cho pass mà không giải thích.
- [ ] Xử lý lỗi không bị nuốt (`catch {}` rỗng, trả 200 khi lỗi).
- [ ] Không có API/thư viện "bịa" — kiểm tra hàm được gọi thật sự tồn tại trong phiên bản đang dùng.

## B. Xác thực và phiên ([01](01-authentication.md), [02](02-session-token.md), [04](04-module-tai-khoan.md))

- [ ] 🔴 Mật khẩu băm bằng Argon2id/bcrypt (không MD5/SHA-x thuần, không mã hóa hai chiều).
- [ ] Thông báo lỗi đăng nhập/quên mật khẩu không lộ email có tồn tại hay không.
- [ ] Có rate limit cho login, đăng ký, quên mật khẩu, gửi OTP.
- [ ] Token reset/verify: ngẫu nhiên đủ mạnh, lưu dạng băm, dùng một lần, có hạn.
- [ ] Đổi/reset mật khẩu → thu hồi các phiên khác.
- [ ] Cookie phiên: `HttpOnly`, `Secure`, `SameSite`; có chống CSRF khi dùng cookie.
- [ ] JWT: kiểm tra chữ ký + thuật toán cố định + `exp`/`aud`/`iss`; không chứa dữ liệu nhạy cảm.
- [ ] Logout thật sự vô hiệu hóa refresh token/phiên phía server.

## C. Phân quyền ([03](03-phan-quyen.md))

- [ ] 🔴 Mọi endpoint truy cập tài nguyên theo ID đều kiểm tra quyền sở hữu/vai trò (chống IDOR/BOLA).
- [ ] Kiểm tra quyền ở server, không dựa vào việc UI ẩn nút.
- [ ] 🔴 Không gán hàng loạt (mass assignment): client không thể gửi `role`, `isAdmin`, `ownerId`, `status`.
- [ ] Truy vấn danh sách lọc theo người dùng/tenant ngay trong SQL, không lọc sau khi lấy hết.
- [ ] Có test cho trường hợp **bị từ chối** (403/404), không chỉ trường hợp thành công.

## D. Dữ liệu ([07](07-thiet-ke-database.md))

- [ ] 🔴 Truy vấn tham số hóa, không nối chuỗi SQL.
- [ ] Ràng buộc ở DB (NOT NULL, UNIQUE, FK, CHECK) cho bất biến quan trọng, không chỉ validate ở code.
- [ ] Thao tác nhiều bước cần nhất quán nằm trong một transaction; đúng isolation/lock khi có tranh chấp.
- [ ] Không N+1; truy vấn mới trên bảng lớn có index phù hợp (đòi EXPLAIN).
- [ ] 🔴 Migration an toàn khi chạy trên production: không khóa bảng lớn lâu, có thể chạy khi code cũ còn hoạt động, có đường lui.
- [ ] Danh sách có phân trang và giới hạn `limit` tối đa.

## E. API ([08](08-thiet-ke-api.md))

- [ ] Mã HTTP đúng ngữ nghĩa; định dạng lỗi thống nhất; không trả stack trace.
- [ ] Validate đầu vào (kiểu, độ dài, phạm vi) ở biên; giới hạn kích thước body/file.
- [ ] Thao tác tạo/thanh toán/nộp bài có idempotency (khóa idempotency hoặc ràng buộc duy nhất).
- [ ] Không phá tương thích ngược (đổi tên/xóa field, đổi kiểu) khi chưa có versioning/kế hoạch.

## F. Bất đồng bộ và tích hợp ([10](10-messaging-kafka.md), [12](12-observability-reliability.md))

- [ ] Gọi service ngoài có timeout; retry có backoff + jitter và chỉ cho lỗi tạm thời.
- [ ] Consumer idempotent (xử lý trùng message không gây hậu quả kép).
- [ ] 🔴 Không "ghi DB rồi publish message" rời rạc khi cần nhất quán — dùng outbox.
- [ ] Message lỗi lặp lại đi vào DLQ, không lặp vô hạn.
- [ ] Không gọi I/O chậm (email, AI moderation, chấm code) đồng bộ trong request của người dùng.

## G. Bảo mật chung ([11](11-bao-mat.md))

- [ ] 🔴 Không có bí mật (key, mật khẩu, token) trong code, test, log, commit.
- [ ] Log không chứa mật khẩu, token, OTP, PII không cần thiết.
- [ ] Nội dung người dùng (HTML/Markdown) được sanitize theo allowlist.
- [ ] Upload: kiểm tra loại/kích thước, lưu ngoài web root/object storage, tên file do server sinh.
- [ ] Fetch URL do người dùng cung cấp có chống SSRF.
- [ ] Thư viện mới: cần thiết, còn bảo trì, không có lỗ hổng đã biết, khóa phiên bản.

## H. Vận hành ([09](09-scale-trieu-user.md), [12](12-observability-reliability.md))

- [ ] Log có cấu trúc và correlation/request id; có metric cho luồng mới quan trọng.
- [ ] Cache có TTL và chiến lược vô hiệu hóa; không cache dữ liệu theo quyền dưới khóa dùng chung.
- [ ] Service stateless (không lưu phiên/file trong bộ nhớ hoặc đĩa cục bộ của instance).
- [ ] Cấu hình qua biến môi trường; có giá trị mặc định an toàn.
- [ ] Tính năng rủi ro có feature flag hoặc cách tắt nhanh.

## Các lỗi agent hay mắc (để soi kỹ)

| Lỗi | Dấu hiệu trong diff |
|---|---|
| Kiểm tra quyền thiếu ở endpoint mới | Handler lấy `req.params.id` rồi truy vấn thẳng, không so với `req.user` |
| Sửa test cho khớp code sai | `expected` thay đổi trong cùng commit với logic |
| Nuốt lỗi | `catch (e) { console.log(e) }` rồi tiếp tục |
| Race condition | "Đọc → kiểm tra → ghi" không có transaction/lock/ràng buộc UNIQUE |
| Over-engineering | Thêm interface/factory/queue cho việc chỉ có một cách làm |
| Tuyên bố đã chạy test nhưng không có output | Báo cáo "all tests pass" không kèm lệnh và kết quả |
| Lộ thông tin | Trả nguyên object user (có `password_hash`) ra API |
| Migration nguy hiểm | `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT` trên bảng lớn ở DB cũ, đổi tên cột trong một bước |
