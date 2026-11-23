---
title: "Backend cấp senior – mục lục"
description: "kiến thức backend chuyên sâu để tự thiết kế, giao việc cho agent và review code backend do agent viết."
pubDatetime: 2026-11-19T09:00:00Z
featured: true
tags:
  - backend
  - system-design
---
# Backend cấp senior – mục lục

**Mục đích:** kiến thức backend chuyên sâu để tự thiết kế, giao việc cho agent và review code backend do agent viết.
**Ví dụ xuyên suốt:** nền tảng cộng đồng học tập **LearnHub** (người dùng, bài viết, bình luận, kiểm duyệt, bài kiểm tra/chấm bài), mục tiêu 5 triệu user, 200k người dùng đồng thời giờ cao điểm.
**Ngôn ngữ ví dụ:** TypeScript (Node) + PostgreSQL + Redis. Khái niệm áp dụng cho mọi stack (Java/Spring, Go, Python, .NET…).

## Mục lục

| # | File | Nội dung chính |
|---|---|---|
| 00 | [00-request-lifecycle-tu-trinh-duyet-den-db.md](00-request-lifecycle-tu-trinh-duyet-den-db.md) | Vòng đời đầy đủ một Request (DNS → TLS → LB → Middleware/Controller/Service → Cache/Pool → PostgreSQL) kèm ngân sách độ trễ |
| 01 | [01-authentication.md](01-authentication.md) | Lưu mật khẩu, đăng nhập, chống brute-force, MFA/passkey, OAuth2/OIDC, SSO, xác thực giữa service |
| 02 | [02-session-token.md](02-session-token.md) | Session vs JWT, cookie, CSRF, access/refresh token, xoay vòng, thu hồi, logout mọi thiết bị |
| 03 | [03-phan-quyen.md](03-phan-quyen.md) | RBAC/ABAC/ReBAC, IDOR, multi-tenant, row-level security, ma trận quyền LearnHub |
| 04 | [04-module-tai-khoan.md](04-module-tai-khoan.md) | Đăng ký, đăng nhập, đăng xuất, quên/đổi mật khẩu, đổi email, sửa hồ sơ, xóa tài khoản |
| 05 | [05-module-bai-viet-kiem-duyet.md](05-module-bai-viet-kiem-duyet.md) | Viết/đăng bài, vòng đời trạng thái, kiểm duyệt tự động + thủ công, feed, bình luận, tìm kiếm |
| 06 | [06-module-bai-kiem-tra-cham-bai.md](06-module-bai-kiem-tra-cham-bai.md) | Đề thi, làm bài, hẹn giờ phía server, nộp bài đúng một lần, chấm tự động/thủ công, tải đỉnh |
| 07 | [07-thiet-ke-database.md](07-thiet-ke-database.md) | Mô hình dữ liệu, index, transaction, isolation, khóa, migration không downtime, SQL vs NoSQL |
| 08 | [08-thiet-ke-api.md](08-thiet-ke-api.md) | REST, mã lỗi, phân trang, idempotency key, versioning, webhook, REST vs GraphQL vs gRPC |
| 09 | [09-scale-trieu-user.md](09-scale-trieu-user.md) | Ước lượng tải, lộ trình mở rộng, cache, rate limit, monolith vs microservices |
| 10 | [10-messaging-kafka.md](10-messaging-kafka.md) | Khi nào Kafka / RabbitMQ / SQS / Redis / Postgres queue, outbox, saga, idempotent consumer |
| 11 | [11-bao-mat.md](11-bao-mat.md) | OWASP Top 10, API Security, bí mật, mã hóa, PII và Nghị định 13/2023 |
| 12 | [12-observability-reliability.md](12-observability-reliability.md) | Log, metric, trace, SLO, timeout/retry/circuit breaker, sự cố, DR |
| 13 | [13-checklist-review-backend.md](13-checklist-review-backend.md) | ★ Checklist tổng hợp để review code backend do agent viết |

## Lộ trình đọc gợi ý

0. **Bức tranh tổng thể đường đi request:** 00
1. **Nền tảng bảo mật người dùng:** 01 → 02 → 03 → 04
2. **Nghiệp vụ nội dung:** 05 → 06
3. **Dữ liệu và giao tiếp:** 07 → 08
4. **Quy mô và vận hành:** 09 → 10 → 12
5. **Bảo mật toàn diện:** 11
6. **Khi duyệt code:** 13 (và mục "Checklist review" cuối mỗi file)

## Tư duy senior – 10 nguyên tắc

1. **Bắt đầu từ yêu cầu và con số**, không phải công nghệ. "Bao nhiêu request/giây, chấp nhận trễ bao lâu, mất dữ liệu được không?"
2. **Đơn giản nhất mà đủ.** Monolith module hóa + PostgreSQL + Redis phục vụ được hàng triệu user. Thêm Kafka/microservices khi có tín hiệu cụ thể.
3. **Mọi thứ đều có thể lỗi:** mạng, DB, service bên ngoài, chính code của bạn. Thiết kế timeout, retry, idempotency từ đầu.
4. **Dữ liệu sống lâu hơn code.** Đầu tư vào schema, ràng buộc DB, migration an toàn.
5. **Kiểm tra quyền ở mọi điểm truy cập dữ liệu**, không chỉ ở giao diện.
6. **Không tin dữ liệu từ client**: validate, giới hạn kích thước, server là nguồn sự thật (giờ làm bài, giá, quyền).
7. **Đo trước khi tối ưu.** EXPLAIN ANALYZE, profile, metric.
8. **Quan sát được** (log có correlation id, metric, trace) — không quan sát được thì không vận hành được.
9. **Tương thích ngược** cho API và schema; thay đổi theo kiểu mở rộng → di chuyển → thu hẹp.
10. **Viết cho người bảo trì sau**: rõ ràng hơn khéo léo.
