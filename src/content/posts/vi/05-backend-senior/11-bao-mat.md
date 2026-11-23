---
title: "Bảo mật backend"
description: "nắm các lớp tấn công phổ biến theo OWASP và cách phòng thủ cụ thể ở backend; quản lý bí mật, mã hóa, dữ liệu cá nhân (bao gồm Nghị định 13/2023/NĐ-CP), chuỗi cung ứng, upload..."
pubDatetime: 2026-11-18T22:00:00Z
featured: false
tags:
  - backend
  - system-design
  - security
---
# Bảo mật backend

**Mục đích:** nắm các lớp tấn công phổ biến theo OWASP và cách phòng thủ cụ thể ở backend; quản lý bí mật, mã hóa, dữ liệu cá nhân (bao gồm Nghị định 13/2023/NĐ-CP), chuỗi cung ứng, upload file, log, threat modeling và kiểm thử bảo mật.
**Phạm vi công nghệ:** ví dụ TypeScript/Node + PostgreSQL; nguyên lý áp dụng cho mọi stack.
**Liên quan:** [01-authentication.md](01-authentication.md) · [02-session-token.md](02-session-token.md) · [03-phan-quyen.md](03-phan-quyen.md) · [08-thiet-ke-api.md](08-thiet-ke-api.md) · [12-observability-reliability.md](12-observability-reliability.md) · [13-checklist-review-backend.md](13-checklist-review-backend.md)

---

## 1. Tư duy nền

- **Không tin bất kỳ dữ liệu nào từ client**: body, query, header, cookie, tên file, JWT chưa xác minh, thậm chí dữ liệu từ service nội bộ khác.
- **Defense in depth:** nhiều lớp (WAF → rate limit → xác thực → phân quyền → validate → query tham số hóa → quyền DB tối thiểu → mã hóa → giám sát). Một lớp hỏng, lớp khác chặn.
- **Least privilege:** user DB của app không được `DROP`/`SUPERUSER`; service chỉ có quyền nó cần; token có phạm vi hẹp, sống ngắn.
- **Secure by default:** endpoint mới mặc định **yêu cầu đăng nhập và kiểm quyền**; mở công khai phải là quyết định có chủ ý.
- **Fail closed:** lỗi khi kiểm quyền → từ chối, không cho qua.

---

## 2. OWASP Top 10

### 2.1 Bản 2021 → phòng thủ cụ thể

| # | Rủi ro | Ví dụ LearnHub | Phòng thủ ở backend |
|---|---|---|---|
| A01 | **Broken Access Control** | `GET /submissions/123` trả bài của người khác (IDOR) | Kiểm quyền **trên từng đối tượng** ở server (`WHERE id=$1 AND owner_id=$2` hoặc policy), deny-by-default, test tự động cho mỗi endpoint với user khác ([03-phan-quyen.md](03-phan-quyen.md)) |
| A02 | Cryptographic Failures | Lưu mật khẩu bằng SHA-256; HTTP không TLS | Argon2id/bcrypt cho mật khẩu; TLS 1.2+ mọi nơi; mã hóa dữ liệu nhạy cảm at-rest |
| A03 | Injection | `"... WHERE title LIKE '%" + q + "%'"` | Query tham số hóa, ORM đúng cách, validate input, không gọi shell với input |
| A04 | Insecure Design | Không giới hạn số lần nộp bài, cho phép đổi điểm qua API | Threat modeling từ thiết kế, rate limit, quy tắc nghiệp vụ ở server |
| A05 | Security Misconfiguration | Bật stack trace ra client, CORS `*` với credentials, bucket S3 public | Cấu hình cứng hóa, review IaC, tắt debug ở prod, header bảo mật |
| A06 | Vulnerable & Outdated Components | Thư viện có CVE | SCA (Dependabot/Renovate, `npm audit`, Trivy), cập nhật định kỳ |
| A07 | Identification & Authentication Failures | Không chống brute force, session không hết hạn | Rate limit, MFA, khóa mềm, rotation token ([01-authentication.md](01-authentication.md)) |
| A08 | Software & Data Integrity Failures | Deserialize dữ liệu không tin cậy, CI tải script không kiểm | Ký artefact, pin dependency + hash, không deserialize object tùy ý |
| A09 | Security Logging & Monitoring Failures | Không log đăng nhập thất bại, không cảnh báo | Log sự kiện bảo mật, cảnh báo bất thường ([12-observability-reliability.md](12-observability-reliability.md)) |
| A10 | SSRF | Tính năng "đăng bài từ URL" cho phép gọi `http://169.254.169.254` | Allowlist đích, chặn IP nội bộ sau khi resolve DNS, egress proxy |

### 2.2 Bản 2025

OWASP đã công bố bản Top 10:2025. Các thay đổi chính (đối chiếu trang chính thức owasp.org/Top10 trước khi trích dẫn trong tài liệu chính thức): Broken Access Control vẫn đứng đầu và **gộp SSRF** vào; Security Misconfiguration lên #2; xuất hiện **Software Supply Chain Failures** (mở rộng từ "Vulnerable Components"); thêm **Mishandling of Exceptional Conditions** (xử lý lỗi/ngoại lệ sai dẫn đến fail-open, lộ thông tin). Ý nghĩa thực tế: chuỗi cung ứng và xử lý lỗi giờ là hạng mục review bắt buộc.

### 2.3 OWASP API Security Top 10 (2023)

| # | Rủi ro | Phòng thủ |
|---|---|---|
| API1 | Broken Object Level Authorization (BOLA) | Kiểm quyền mỗi đối tượng theo ID; dùng ID khó đoán (UUIDv7) **không thay thế** kiểm quyền |
| API2 | Broken Authentication | Xem [01-authentication.md](01-authentication.md) |
| API3 | Broken Object Property Level Authorization | **Mass assignment**: client gửi `{"role":"admin"}` khi sửa profile → chỉ nhận trường được phép (DTO allowlist). **Lộ dữ liệu thừa**: trả `password_hash`, `email` người khác → DTO response tường minh |
| API4 | Unrestricted Resource Consumption | Giới hạn kích thước body, page size tối đa, timeout, rate limit, giới hạn upload, chi phí gọi AI/SMS |
| API5 | Broken Function Level Authorization | `POST /admin/users/ban` gọi được bởi user thường → kiểm role/permission theo chức năng |
| API6 | Unrestricted Access to Sensitive Business Flows | Bot tạo hàng nghìn tài khoản, spam đăng ký khóa học miễn phí → CAPTCHA, rate limit theo luồng, phát hiện bất thường |
| API7 | SSRF | Như A10 |
| API8 | Security Misconfiguration | Như A05 |
| API9 | Improper Inventory Management | API cũ `/v1` không còn bảo trì nhưng vẫn mở; endpoint debug quên tắt → danh mục API (OpenAPI), gỡ bản cũ |
| API10 | Unsafe Consumption of APIs | Tin dữ liệu từ API bên thứ ba mà không validate → validate như input người dùng, timeout, TLS |

Mass assignment — sai và đúng:

```ts
// SAI: đẩy nguyên body vào DB
await db.users.update(req.user.id, req.body);           // body có thể chứa role, is_verified, balance

// ĐÚNG: schema allowlist
const UpdateProfile = z.object({
  displayName: z.string().trim().min(1).max(50),
  bio: z.string().max(500).optional(),
}).strict();                                             // trường lạ → lỗi 400
const input = UpdateProfile.parse(req.body);
await db.users.update(req.user.id, input);
```

---

## 3. Injection

### SQL

```ts
// SAI
db.query(`SELECT * FROM posts WHERE author_id = '${req.query.author}'`);
// ĐÚNG
db.query('SELECT id, title FROM posts WHERE author_id = $1', [req.query.author]);
```

Chỗ **không** tham số hóa được (tên cột `ORDER BY`, chiều sắp xếp) → **allowlist**:

```ts
const SORTABLE = { created: 'created_at', score: 'score' } as const;
const col = SORTABLE[req.query.sort as keyof typeof SORTABLE] ?? 'created_at';
const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC';
```

ORM vẫn có lỗ: `raw()`, `whereRaw()`, chuỗi nối trong query builder. `LIKE` cần escape `%` và `_` trong input.

### NoSQL

MongoDB: body `{"email": {"$ne": null}, "password": {"$ne": null}}` → bỏ qua đăng nhập. Phòng: validate kiểu (`z.string()`), loại bỏ key bắt đầu bằng `$`.

### Command injection

Không bao giờ `exec("convert " + filename)`. Dùng thư viện thay vì shell; nếu buộc phải gọi tiến trình, dùng `execFile`/`spawn` với **mảng tham số** và không `shell: true`, kèm allowlist giá trị.

### Khác

Template injection (render template từ chuỗi người dùng), LDAP, XPath, header injection (CRLF trong header redirect), log injection (xuống dòng giả mạo log) — cùng nguyên tắc: dữ liệu không bao giờ trở thành mã/lệnh.

---

## 4. SSRF

Tính năng nhận URL từ user (xem trước link, import ảnh từ URL, webhook) có thể bị dùng để gọi vào mạng nội bộ hoặc metadata cloud (`169.254.169.254` → lấy credential IAM).

Phòng thủ:
1. Chỉ cho `https`, cổng 443.
2. Resolve DNS → **chặn** dải nội bộ: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`, `fe80::/10`.
3. Kết nối tới **đúng IP đã kiểm tra** (chống DNS rebinding — DNS trả IP khác ở lần resolve thứ hai).
4. Không tự động theo redirect (hoặc kiểm tra lại mỗi bước).
5. Timeout ngắn, giới hạn kích thước response.
6. Tốt nhất: đi qua **egress proxy** riêng không có quyền vào mạng nội bộ; cloud dùng IMDSv2.

---

## 5. XSS (phía API), CSRF, CORS

**XSS:** backend API trả JSON thì nguy cơ chính ở frontend render, nhưng backend phải:
- Lưu nội dung gốc, **sanitize khi render** (hoặc lưu bản đã sanitize bằng thư viện chuẩn như DOMPurify/sanitize-html với allowlist thẻ) cho bài viết rich text/Markdown.
- Trả `Content-Type: application/json` đúng; không phản chiếu input vào HTML.
- Đặt CSP cho trang web.
- File người dùng upload phục vụ từ **domain riêng** (`usercontent.learnhub.vn`) để script trong SVG/HTML không chạy dưới domain chính.

**CSRF:** chỉ xảy ra khi trình duyệt **tự gửi** credential (cookie).
- Cookie phiên: `SameSite=Lax` (hoặc `Strict`) + `Secure` + `HttpOnly`.
- Thao tác thay đổi trạng thái không dùng `GET`.
- Thêm CSRF token (double-submit hoặc synchronizer token) hoặc kiểm `Origin`/`Sec-Fetch-Site` cho request thay đổi trạng thái.
- API dùng `Authorization: Bearer` trong header (không phải cookie) không bị CSRF — nhưng token trong `localStorage` dễ bị XSS lấy (trade-off ở [02-session-token.md](02-session-token.md)).

**CORS** không phải cơ chế bảo vệ server; nó là trình duyệt **nới lỏng** same-origin.
- Allowlist origin cụ thể; **không** phản chiếu nguyên header `Origin` khi có `Access-Control-Allow-Credentials: true`.
- Không dùng `*` với credentials (trình duyệt cũng chặn).
- Không tin regex lỏng: `/learnhub\.vn$/` khớp `evil-learnhub.vn`.

```ts
const ALLOWED = new Set(['https://learnhub.vn', 'https://admin.learnhub.vn']);
app.use(cors({ origin: (o, cb) => cb(null, !o || ALLOWED.has(o)), credentials: true }));
```

### Header bảo mật

| Header | Giá trị gợi ý |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | `default-src 'self'; ...` (theo frontend) |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` / CSP `frame-ancestors` | `DENY` / `'none'` |
| `Cache-Control` cho response chứa dữ liệu cá nhân | `no-store` |

Ẩn header lộ công nghệ (`X-Powered-By`). Thư viện: `helmet` (Node).

---

## 6. Quản lý bí mật (secrets)

| Quy tắc | Chi tiết |
|---|---|
| Không trong code, không trong Git | Kể cả repo private; gitleaks ở pre-commit + CI (repo này có hook `aiic-astec`) |
| Lưu ở secret manager | HashiCorp Vault, AWS Secrets Manager/SSM, GCP Secret Manager, Azure Key Vault; Kubernetes Secret + mã hóa etcd/External Secrets |
| Tiêm lúc chạy | Biến môi trường hoặc file mount; không bake vào image |
| Xoay vòng (rotation) | Định kỳ và **ngay** khi nghi lộ; thiết kế hỗ trợ 2 khóa hợp lệ song song (JWT `kid`) |
| Credential động | Vault cấp user DB sống ngắn |
| Không log | Redact `password`, `token`, `authorization`, `cookie`, `secret` trong logger |
| Quyền tối thiểu | Mỗi service một credential riêng, quyền hẹp |

Khi lộ bí mật: **xoay vòng ngay** (xóa khỏi Git history không đủ — coi như đã bị lấy), kiểm tra log truy cập, báo cáo sự cố.

---

## 7. Mã hóa

| Ở đâu | Làm gì |
|---|---|
| Truyền tải | TLS 1.2+ (ưu tiên 1.3) cả **nội bộ** (service ↔ DB, service ↔ service, mTLS nếu có mesh) |
| Lưu trữ (at rest) | Mã hóa đĩa/DB/backup/bucket (KMS); đây là mức tối thiểu |
| Cấp trường | Dữ liệu cực nhạy cảm (CCCD, số điện thoại nếu yêu cầu) mã hóa ở ứng dụng bằng AES-256-GCM, khóa trong KMS (envelope encryption); tìm kiếm qua **blind index** (HMAC) |
| Mật khẩu | **Không mã hóa — băm**: Argon2id (ưu tiên) hoặc bcrypt cost ≥ 12 |
| Token lưu DB (reset password, refresh token) | Lưu **hash** (SHA-256) của token, không lưu bản gốc |

Không tự chế thuật toán; không dùng ECB, MD5/SHA-1 cho bảo mật; IV/nonce không tái sử dụng; so sánh token bằng hàm **constant-time** (`crypto.timingSafeEqual`).

---

## 8. Dữ liệu cá nhân và Nghị định 13/2023/NĐ-CP

Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân (hiệu lực 01/07/2023) là khung pháp lý tại Việt Nam; **Luật Bảo vệ dữ liệu cá nhân 2025** đã được thông qua và có hiệu lực từ 01/01/2026 — kiểm tra văn bản hiện hành với bộ phận pháp chế trước khi ra quyết định. Ý nghĩa kỹ thuật cho backend:

| Yêu cầu | Việc kỹ thuật |
|---|---|
| Phân loại dữ liệu cơ bản / nhạy cảm (sức khỏe, sinh trắc, vị trí, tài chính…) | Đánh dấu cột chứa PII, mức nhạy cảm, trong data catalog |
| **Sự đồng ý** của chủ thể, rút lại được | Bảng `consents` (mục đích, phiên bản điều khoản, thời điểm, kênh), API rút đồng ý |
| Quyền của chủ thể: truy cập, chỉnh sửa, xóa, hạn chế xử lý | API xuất dữ liệu cá nhân, quy trình xóa/ẩn danh hóa xuyên hệ thống (DB, cache, search, backup, analytics) |
| Tối thiểu hóa | Chỉ thu thập trường cần; không gửi PII sang analytics/log/LLM nếu không cần |
| Đánh giá tác động xử lý dữ liệu, chuyển dữ liệu ra nước ngoài | Biết dữ liệu nằm ở region nào; dịch vụ AI/SaaS bên ngoài nào nhận dữ liệu |
| Thông báo vi phạm (trong 72 giờ theo NĐ 13) | Có quy trình phát hiện, ghi nhận, báo cáo sự cố |
| Thời hạn lưu trữ | Job xóa/ẩn danh dữ liệu hết hạn |

LearnHub: email, số điện thoại, ngày sinh học sinh (có thể là **trẻ em** → yêu cầu đồng ý của cha mẹ/người giám hộ theo quy định), điểm thi — đều là dữ liệu cá nhân.

---

## 9. Chuỗi cung ứng (supply chain)

- **Lockfile** (`package-lock.json`, `pnpm-lock.yaml`) commit vào repo; CI dùng `npm ci` (cài đúng lockfile).
- SCA tự động: Dependabot/Renovate, `npm audit`, OSV-Scanner, Trivy (cả image container).
- Cảnh giác **typosquatting** và package mới, ít người dùng; review dependency mới trong PR (AI agent hay thêm package không cần hoặc **bịa tên package** → kẻ xấu đăng ký đúng tên đó: "slopsquatting").
- Tắt/giới hạn script cài đặt (`npm ci --ignore-scripts` khi có thể).
- Image nền tối thiểu (distroless/alpine), chạy non-root, quét image.
- Pin GitHub Actions theo commit SHA; CI có quyền tối thiểu (`permissions: read-all` mặc định).
- SBOM (CycloneDX/SPDX), ký artefact (Sigstore/cosign) cho hệ thống yêu cầu cao.

---

## 10. Upload file an toàn

| Rủi ro | Phòng thủ |
|---|---|
| File quá lớn / zip bomb | Giới hạn kích thước ở proxy và app; giới hạn số file; giới hạn kích thước sau giải nén |
| Giả mạo loại file | Kiểm **magic bytes**, không tin `Content-Type`/đuôi file; allowlist loại (jpg, png, webp, pdf) |
| Path traversal (`../../etc/passwd`) | Không dùng tên file của user làm đường dẫn; đặt tên mới (UUID) |
| Mã độc | Quét antivirus (ClamAV) bất đồng bộ trước khi cho tải xuống; trạng thái `pending_scan` |
| XSS qua SVG/HTML | Không phục vụ SVG người dùng như ảnh inline, hoặc sanitize; `Content-Disposition: attachment` cho loại khác; domain riêng |
| Metadata EXIF lộ vị trí | Xử lý lại ảnh (re-encode) và xóa EXIF |
| Truy cập trái phép | Bucket private; tải xuống qua **presigned URL** sống ngắn sau khi kiểm quyền |
| Upload làm nghẽn app | Client upload thẳng lên S3 bằng presigned POST có điều kiện (kích thước, content-type) |

Luồng: `POST /uploads` (kiểm quyền, tạo presigned URL) → client PUT lên S3 → sự kiện S3 → worker kiểm magic bytes, quét virus, re-encode → đánh dấu `ready`.

---

## 11. Log không làm lộ dữ liệu

- Không log: mật khẩu, token, cookie, header `Authorization`, OTP, số thẻ, nội dung bài thi, toàn bộ body request.
- Redact theo allowlist trường được log, không theo blocklist (blocklist luôn sót).
- Che bớt PII: email `ng***@gmail.com`; dùng `userId` thay vì email.
- Thông báo lỗi cho client chung chung + `requestId`; chi tiết (stack) chỉ ở log nội bộ.
- Log bảo mật cần có: đăng nhập thành công/thất bại, đổi mật khẩu/email, thay đổi quyền, truy cập bị từ chối, thao tác admin (audit log bất biến).

```ts
const logger = pino({
  redact: { paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.otp'], censor: '[REDACTED]' },
});
```

### 11.1 Chống lộ API Backend, IP thật của Server & Cấu trúc thư mục dự án

Ngoài chống SQL Injection và DDoS, cần khóa **4 lỗ hổng cấu hình** hay làm lộ hạ tầng và cây thư mục code:

1. **Ẩn IP Origin & Cổng nội bộ (`3001`, `5432`):**
   - Đặt **Cloudflare (Proxy DNS + WAF)** phía trước $\rightarrow$ **Nginx Reverse Proxy** (`proxy_pass http://127.0.0.1:3001`). Trên Firewall (UFW/Security Group), **đóng hoàn toàn port `3001` và `5432` với Internet**, chỉ mở port `443` cho dải IP Cloudflare.
   - Dùng **Next.js `rewrites()`** làm BFF Proxy để trình duyệt chỉ gọi cùng domain `/api/...`, không lộ domain/port backend trong F12 Network.
2. **Không trả `error.stack` về Client:** `error.stack` của Node.js chứa đường dẫn tuyệt đối trên ổ cứng (vd `/home/ubuntu/app/src/services/auth.service.js:42`). Chỉ log `error` ở nội bộ, trả về `{ status: 'error', message: 'Internal server error.' }`.
3. **Tắt Source Maps trên Production của Frontend:** Giữ `productionBrowserSourceMaps: false` trong `next.config.ts` để F12 $\rightarrow$ Sources không thấy nguyên cây thư mục `src/` và code TypeScript gốc.
4. **Khoanh vùng `express.static`, ẩn chữ ký & CORS chặt:**
   - Chỉ phục vụ đúng thư mục ảnh công khai với `{ dotfiles: 'deny', index: false }` (chặn đọc `.env`, `.git`, `.DS_Store`); dùng `path.basename(filename)` chống Path Traversal (`../../.env`); xóa `.DS_Store` khỏi git.
   - Gọi `app.disable('x-powered-by')` + `helmet()`. Cẩn thận lỗi CORS viết fallback `return callback(null, true)` bên ngoài `if (allowedOrigins.includes(origin))` — phải trả `callback(new Error('Not allowed by CORS'))`.
5. **Khóa quyền `DELETE` ngay tại DB (Zero Hard Delete):** Tạo role riêng cho ứng dụng và thu hồi quyền xóa vật lý trên các bảng cốt lõi:
   ```sql
   REVOKE DELETE, TRUNCATE ON Users, Exam, exam_attempts, blogs, lesson_practice_sessions FROM app_user;
   ```

---

## 12. Threat modeling nhanh (STRIDE) cho LearnHub

| STRIDE | Mối đe dọa | Ví dụ | Biện pháp |
|---|---|---|---|
| **S**poofing | Giả danh | Đăng nhập bằng mật khẩu bị lộ từ site khác (credential stuffing) | Rate limit, kiểm tra mật khẩu bị lộ (HIBP k-anonymity), MFA cho giáo viên/admin |
| **T**ampering | Sửa dữ liệu | Học sinh sửa `score` trong request nộp bài; sửa thời gian nộp | Điểm chỉ tính ở server; thời gian lấy từ server; ký/kiểm tra toàn vẹn |
| **R**epudiation | Chối bỏ | Giáo viên nói "tôi không sửa điểm đó" | Audit log bất biến (ai, cái gì, khi nào, giá trị cũ/mới) |
| **I**nformation disclosure | Lộ thông tin | Xem đề thi trước giờ; xem bài của bạn khác | Kiểm quyền theo thời gian mở đề; BOLA test; response DTO tối thiểu |
| **D**enial of service | Từ chối dịch vụ | Spam nộp bài, query tìm kiếm nặng | Rate limit, timeout query, giới hạn tài nguyên sandbox chấm code |
| **E**levation of privilege | Leo quyền | Học sinh gọi API chấm điểm của giáo viên; mã nộp bài thoát sandbox | Phân quyền theo chức năng; sandbox không mạng, giới hạn CPU/RAM/thời gian, user không đặc quyền |

Làm threat modeling ở giai đoạn thiết kế mỗi tính năng có dữ liệu nhạy cảm hoặc thao tác quan trọng — 30 phút với bảng này đã tốt hơn không làm.

---

## 13. Kiểm thử bảo mật

| Loại | Công cụ ví dụ | Khi chạy |
|---|---|---|
| Secret scanning | gitleaks, GitHub secret scanning | pre-commit + CI |
| SAST (phân tích mã tĩnh) | Semgrep, CodeQL, SonarQube | Mỗi PR |
| SCA (thư viện) | Dependabot, Renovate, Trivy, OSV-Scanner | Mỗi PR + định kỳ |
| DAST (tấn công ứng dụng đang chạy) | OWASP ZAP, Burp Suite | Môi trường staging, định kỳ |
| Test phân quyền tự động | Test tích hợp: mỗi endpoint × mỗi vai trò × tài nguyên của người khác | Mỗi PR |
| Fuzzing input | Schemathesis (từ OpenAPI) | CI/định kỳ |
| Pentest | Bên thứ ba | Trước release lớn, hằng năm |
| IaC scan | Checkov, tfsec | Mỗi PR hạ tầng |

---

## 14. Lỗi thường gặp (đặc biệt ở code do AI agent viết)

- Kiểm tra quyền chỉ ở frontend/ẩn nút; endpoint backend không kiểm.
- Lấy `userId` từ body/query thay vì từ phiên đã xác thực.
- `req.body` đẩy thẳng vào ORM (mass assignment); trả nguyên entity (lộ `password_hash`).
- Nối chuỗi SQL ở `ORDER BY`/`LIKE`; `whereRaw` với input.
- CORS phản chiếu origin + credentials; `cors()` không tham số.
- Log nguyên `req.body`/headers; trả stack trace cho client.
- Secret mặc định trong code (`process.env.JWT_SECRET || 'secret'`) — fallback này là lỗ hổng.
- Thêm package không cần hoặc tên package không tồn tại.
- So sánh token bằng `===`; tạo token bằng `Math.random()` (phải dùng `crypto.randomBytes`/`randomUUID`).
- Tắt kiểm tra TLS (`rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED=0`) "để chạy được".
- `catch` nuốt lỗi rồi tiếp tục như thành công (fail-open).

## Checklist review

- [ ] Mỗi endpoint mới: yêu cầu xác thực mặc định; kiểm quyền chức năng **và** quyền trên đối tượng ở server; `userId` lấy từ phiên.
- [ ] Input validate bằng schema allowlist (`strict`), có giới hạn độ dài/kích thước; response dùng DTO tường minh.
- [ ] Mọi query tham số hóa; phần động (`ORDER BY`) qua allowlist; không `exec` với shell.
- [ ] URL do user cung cấp: chặn IP nội bộ sau resolve, không theo redirect, timeout, giới hạn kích thước.
- [ ] Cookie `HttpOnly; Secure; SameSite`; có chống CSRF cho thao tác thay đổi trạng thái dùng cookie; CORS allowlist cụ thể.
- [ ] Header bảo mật được đặt; không lộ stack trace/version.
- [ ] Không có secret trong code/config commit/log; không có fallback secret mặc định; secret đọc từ secret manager.
- [ ] Mật khẩu Argon2id/bcrypt; token lưu dạng hash; random bằng CSPRNG; so sánh constant-time; TLS không bị tắt.
- [ ] PII: tối thiểu hóa, có mục đích và đồng ý khi cần, có đường xóa/xuất; không gửi PII ra dịch vụ ngoài không được phê duyệt.
- [ ] Dependency mới được biện minh, có thật, phổ biến, không CVE nghiêm trọng; lockfile cập nhật.
- [ ] Upload: kiểm magic bytes, giới hạn kích thước, tên file mới, bucket private, quét virus, domain riêng.
- [ ] Log bảo mật được ghi; dữ liệu nhạy cảm bị redact; audit log cho thao tác admin/đổi điểm.
- [ ] Có test phân quyền âm tính (user A truy cập tài nguyên của user B → 403/404).
- [ ] Xử lý lỗi fail-closed; không nuốt ngoại lệ.
