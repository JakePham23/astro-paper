---
title: "Phân quyền (Authorization)"
description: "thiết kế và kiểm tra \"ai được làm gì với tài nguyên nào\": RBAC, ABAC, ReBAC, kiểm tra quyền sở hữu, chống IDOR/BOLA, cô lập multi-tenant, nơi đặt kiểm tra, policy engine, cache..."
pubDatetime: 2026-11-19T06:00:00Z
featured: false
tags:
  - backend
  - system-design
  - security
---
# Phân quyền (Authorization)

**Mục đích:** thiết kế và kiểm tra "ai được làm gì với tài nguyên nào": RBAC, ABAC, ReBAC, kiểm tra quyền sở hữu, chống IDOR/BOLA, cô lập multi-tenant, nơi đặt kiểm tra, policy engine, cache quyền, impersonation có audit.
**Liên quan:** [01-authentication.md](01-authentication.md) · [02-session-token.md](02-session-token.md) · [05-module-bai-viet-kiem-duyet.md](05-module-bai-viet-kiem-duyet.md) · [06-module-bai-kiem-tra-cham-bai.md](06-module-bai-kiem-tra-cham-bai.md) · [07-thiet-ke-database.md](07-thiet-ke-database.md) · [08-thiet-ke-api.md](08-thiet-ke-api.md) · [11-bao-mat.md](11-bao-mat.md) · [13-checklist-review-backend.md](13-checklist-review-backend.md)

> Ví dụ TypeScript + PostgreSQL + Redis; mô hình áp dụng cho mọi stack.

---

## 1. AuthN khác AuthZ

- **Authentication** trả lời "bạn là ai" → kết quả là `subject` (user id, các thuộc tính).
- **Authorization** trả lời "subject này có được thực hiện `action` trên `resource` trong `context` này không".

Theo OWASP API Security Top 10 (2023), **API1 Broken Object Level Authorization (BOLA)** và **API5 Broken Function Level Authorization** là hai lỗi hàng đầu. Gần như mọi vụ lộ dữ liệu qua API là do *đã đăng nhập* nhưng *không kiểm tra quyền trên đối tượng cụ thể*.

Mô hình tư duy: mọi quyết định = `allow(subject, action, resource, context)`.

---

## 2. Ba mô hình

| Mô hình | Quyết định dựa trên | Ví dụ LearnHub | Ưu | Nhược |
|---|---|---|---|---|
| **RBAC** (role-based) | Vai trò của user | `moderator` được ẩn bài viết | Dễ hiểu, dễ audit | "Bùng nổ role" khi có điều kiện ("giáo viên chỉ chấm lớp mình") |
| **ABAC** (attribute-based) | Thuộc tính subject/resource/context | "Sửa bài viết nếu là tác giả **và** bài tạo < 24 giờ **và** chưa bị khóa" | Linh hoạt | Khó audit "ai được làm gì" |
| **ReBAC** (relationship-based, kiểu Google Zanzibar) | Quan hệ trong đồ thị | "Xem bài nộp nếu là `teacher` của `class` mà `assignment` thuộc về" | Diễn đạt tự nhiên quyền phân cấp/chia sẻ | Cần hạ tầng (SpiceDB, OpenFGA), nhất quán dữ liệu |

### Quy tắc chọn

- Bắt đầu bằng **RBAC cho quyền chức năng** + **kiểm tra quyền sở hữu/quan hệ trong code** cho quyền trên đối tượng. Đủ cho đa số hệ thống, kể cả LearnHub giai đoạn đầu.
- Thêm thuộc tính (ABAC) khi điều kiện phụ thuộc trạng thái/thời gian.
- Chuyển sang **ReBAC + dịch vụ phân quyền riêng** khi: chia sẻ tài nguyên tùy ý (như Google Drive), cấu trúc lồng nhau sâu (tổ chức → khoa → lớp → nhóm), nhiều service cần cùng một nguồn quyền.

---

## 3. LearnHub: vai trò và ma trận quyền

Vai trò hệ thống: `student`, `teacher`, `moderator`, `admin`. Vai trò theo phạm vi: `teacher` **của lớp X**, `student` **trong lớp X** (bảng `class_members`).

| Hành động | student | teacher | moderator | admin | Điều kiện đối tượng |
|---|---|---|---|---|---|
| Xem bài viết công khai | ✓ | ✓ | ✓ | ✓ | `status = published` |
| Tạo bài viết | ✓ | ✓ | ✓ | ✓ | Tài khoản không bị cấm đăng |
| Sửa bài viết | chủ bài | chủ bài | — | — | `author_id = me`, chưa bị khóa |
| Xóa bài viết | chủ bài | chủ bài | ✓ (ẩn, có lý do) | ✓ | |
| Ẩn/khôi phục bài, xử lý báo cáo | — | — | ✓ | ✓ | Không xử lý bài của chính mình |
| Tạo đề kiểm tra | — | lớp mình | — | ✓ | `teacher` của `class_id` |
| Làm bài kiểm tra | lớp mình | — | — | — | Là thành viên lớp, trong thời gian mở |
| Xem bài nộp | của mình | lớp mình | — | ✓ (có audit) | |
| Chấm điểm | — | lớp mình | — | — | Không chấm khi chưa hết hạn nộp (tùy cấu hình) |
| Xem điểm | của mình | lớp mình | — | ✓ | |
| Đổi vai trò user | — | — | — | ✓ | Không tự nâng quyền mình; cần step-up |
| Impersonate | — | — | — | ✓ (giới hạn) | Có lý do, có audit, chỉ đọc mặc định |

Ma trận này phải nằm trong tài liệu và **có test cho từng ô** (test ma trận quyền).

---

## 4. Lược đồ dữ liệu

```sql
-- RBAC
CREATE TABLE roles        (id SMALLSERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL);
CREATE TABLE permissions  (id SMALLSERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL);  -- 'post:moderate', 'user:role:assign'
CREATE TABLE role_permissions (role_id SMALLINT REFERENCES roles(id), permission_id SMALLINT REFERENCES permissions(id),
                               PRIMARY KEY (role_id, permission_id));
CREATE TABLE user_roles   (user_id BIGINT REFERENCES users(id), role_id SMALLINT REFERENCES roles(id),
                           tenant_id BIGINT NOT NULL,                                -- vai trò theo tenant (trường)
                           granted_by BIGINT, granted_at TIMESTAMPTZ DEFAULT now(),
                           PRIMARY KEY (user_id, role_id, tenant_id));

-- Quan hệ theo phạm vi (ReBAC đơn giản trong DB)
CREATE TABLE class_members (
  class_id  BIGINT NOT NULL REFERENCES classes(id),
  user_id   BIGINT NOT NULL REFERENCES users(id),
  relation  TEXT   NOT NULL CHECK (relation IN ('teacher','assistant','student')),
  PRIMARY KEY (class_id, user_id, relation)
);
CREATE INDEX ON class_members (user_id);
```

Quyền là **chuỗi ổn định** (`resource:action`), code kiểm tra *permission*, không kiểm tra *role name*. `if (user.role === 'admin')` rải khắp code là nợ kỹ thuật: thêm role mới phải sửa mọi chỗ.

---

## 5. Kiểm tra quyền trên đối tượng – chống IDOR/BOLA

### 5.1 Lỗi

```ts
// SAI: chỉ kiểm tra đã đăng nhập
app.get("/v1/submissions/:id", authenticate, async (req, res) => {
  const s = await db.one("SELECT * FROM submissions WHERE id = $1", [req.params.id]);
  res.json(s); // học viên A đổi id → đọc bài của học viên B
});
```

ID tuần tự làm việc dò dễ hơn, nhưng **UUID không phải biện pháp phân quyền** — ID vẫn lộ qua URL, log, chia sẻ.

### 5.2 Đúng: tải đối tượng → kiểm tra policy → trả về

```ts
// policy tập trung, thuần (pure), dễ test
export const can = {
  readSubmission(u: Subject, s: Submission, rel: ClassRelation | null) {
    if (s.student_id === u.id) return true;
    if (rel === "teacher" || rel === "assistant") return true;
    return u.permissions.has("submission:read:any"); // admin, có audit
  },
};

app.get("/v1/submissions/:id", authenticate, async (req, res) => {
  const s = await repo.findSubmission(req.params.id);
  if (!s) return res.status(404).json({ error: "not_found" });
  const rel = await repo.classRelation(s.class_id, req.auth.userId);
  if (!can.readSubmission(req.auth, s, rel)) return res.status(404).json({ error: "not_found" }); // 404 để không lộ sự tồn tại
  if (s.student_id !== req.auth.userId && !rel) audit.log("submission_read_privileged", { id: s.id, by: req.auth.userId });
  res.json(toSubmissionDto(s)); // DTO: chỉ trả trường được phép
});
```

### 5.3 Với danh sách: lọc trong truy vấn

```sql
-- Giáo viên xem bài nộp: điều kiện quyền nằm trong WHERE, không lọc sau khi tải
SELECT s.id, s.student_id, s.submitted_at, s.score
FROM submissions s
JOIN class_members cm ON cm.class_id = s.class_id
WHERE s.assignment_id = $1
  AND cm.user_id = $2 AND cm.relation IN ('teacher','assistant')
ORDER BY s.submitted_at
LIMIT 50;
```

Lọc sau khi tải (load 1000 dòng rồi `filter`) vừa chậm vừa làm hỏng phân trang (trang có 3 dòng thay vì 50) và dễ quên.

### 5.4 403 hay 404?

- **404** khi user không được biết đối tượng có tồn tại (bài nộp người khác, tài nguyên tenant khác).
- **403** khi user biết đối tượng tồn tại nhưng thiếu quyền hành động (ví dụ học viên thấy bài viết nhưng không được ẩn nó).

### 5.5 Field-level authorization và mass assignment

- Đầu ra: DTO theo vai trò (học viên không thấy `grader_notes`; người lạ không thấy `email`).
- Đầu vào: allowlist trường được sửa. `UPDATE users SET ... = req.body` cho phép gửi `{"role":"admin"}`.

---

## 6. Multi-tenant (nhiều trường học trên một hệ thống)

| Mô hình | Cô lập | Chi phí | Khi dùng |
|---|---|---|---|
| DB riêng mỗi tenant | Mạnh nhất | Cao, vận hành khó | Khách hàng lớn yêu cầu hợp đồng |
| Schema riêng mỗi tenant | Khá | Migration N lần | Vài trăm tenant |
| **Chung bảng, cột `tenant_id`** | Phụ thuộc code + RLS | Thấp | Hàng nghìn tenant — mặc định cho LearnHub |

### Postgres Row-Level Security làm lớp phòng thủ thứ hai

```sql
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts FORCE ROW LEVEL SECURITY;           -- áp dụng cả với chủ bảng
CREATE POLICY tenant_isolation ON posts
  USING (tenant_id = current_setting('app.tenant_id')::bigint)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::bigint);
```

```ts
// Mỗi transaction đặt tenant từ session đã xác thực, KHÔNG từ request body/header client gửi
await db.tx(async (t) => {
  await t.none("SELECT set_config('app.tenant_id', $1, true)", [String(req.auth.tenantId)]); // true = chỉ trong transaction
  ...
});
```

Lưu ý: role DB của ứng dụng không được là superuser hoặc có `BYPASSRLS`; với connection pool (PgBouncer transaction mode) phải dùng `set_config(..., true)` trong transaction, không `SET` cấp session. Mọi index quan trọng bắt đầu bằng `tenant_id`. Cache key phải chứa tenant: `t:{tenant}:course:{id}`.

---

## 7. Đặt kiểm tra quyền ở đâu

| Lớp | Kiểm tra gì | Không kiểm tra gì |
|---|---|---|
| API Gateway | Đã xác thực, scope thô (`courses:read`), rate limit | Quyền trên đối tượng (gateway không biết dữ liệu) |
| **Service (bắt buộc)** | Permission chức năng + quyền trên đối tượng + trường dữ liệu | |
| Database (RLS) | Cô lập tenant, lưới an toàn | Logic nghiệp vụ phức tạp |
| Frontend | Ẩn nút cho UX | **Không bao giờ** là biện pháp bảo mật |

Nguyên tắc: **deny by default**. Route mới không khai báo policy → bị từ chối (middleware bắt buộc, test quét toàn bộ route xem route nào thiếu policy).

```ts
// Khai báo quyền ngay tại route, thiếu là lỗi khởi động
router.post("/v1/posts/:id/hide", requirePermission("post:moderate"), loadPost, async (req, res) => { ... });
```

---

## 8. Policy engine – khi nào đáng

| Công cụ | Ngôn ngữ | Phù hợp |
|---|---|---|
| Code thuần (hàm policy) | TypeScript | Một service, quy tắc vừa phải — **mặc định** |
| Casbin | Mô hình PERM (RBAC/ABAC) | Thư viện nhúng, nhiều ngôn ngữ |
| OPA (Rego) | Rego | Nhiều service/đa ngôn ngữ, quy tắc tập trung, cả hạ tầng (Kubernetes admission) |
| AWS Cedar / Amazon Verified Permissions | Cedar | Policy dễ đọc, có phân tích hình thức |
| SpiceDB / OpenFGA | Zanzibar ReBAC | Quan hệ phức tạp, chia sẻ, phân cấp sâu |

Dùng khi: nhiều service cần cùng quy tắc, đội an ninh/pháp chế cần đọc và duyệt policy, cần thay đổi policy không deploy code. Không dùng khi: một monolith, quy tắc ít — thêm độ trễ mạng và một hệ thống phải vận hành.

---

## 9. Cache quyền và vô hiệu hóa

- Cache `perms:{tenant}:{uid}` (tập permission) trong Redis TTL 5 phút + **phiên bản**: khi đổi role → tăng `perm_ver:{uid}` và xóa key. Request so phiên bản.
- Thu hồi quyền phải có hiệu lực **nhanh** (giây–phút) với quyền nguy hiểm (admin, moderator). Ghi rõ SLA thu hồi trong NFR.
- JWT chứa role → role thu hồi chỉ có hiệu lực khi token hết hạn. Đó là lý do không nhét quyền chi tiết vào JWT dài hạn.
- Quan hệ đối tượng (thành viên lớp) cache ngắn hơn hoặc vô hiệu hóa theo sự kiện (`class.member.removed` → xóa cache).

---

## 10. Admin impersonation ("đăng nhập thay")

Hỗ trợ khách hàng cần "xem như user X". Làm đúng:

1. Chỉ permission `user:impersonate`, có step-up, nhập **lý do** (ticket).
2. Tạo session riêng có `actor_id` (admin) và `subject_id` (user): `act` claim theo RFC 8693.
3. Mặc định **chỉ đọc**; chặn đổi mật khẩu, email, thanh toán, xóa.
4. Thời hạn ngắn (30 phút), banner rõ trên giao diện.
5. Mọi hành động ghi audit với cả `actor_id` và `subject_id`; thông báo cho user (tùy chính sách).
6. Không impersonate admin khác.

---

## 11. Audit log cho phân quyền

Ghi: cấp/thu hồi role (ai, cho ai, khi nào, lý do), truy cập dữ liệu bằng quyền đặc biệt, impersonation, quyết định từ chối bất thường (nhiều 403/404 liên tiếp — dấu hiệu dò IDOR). Audit log chỉ ghi thêm (append-only), tách quyền khỏi người bị audit.

---

## 12. Lỗi agent AI hay mắc

| Lỗi | Ví dụ |
|---|---|
| Chỉ kiểm tra đã đăng nhập | `GET /submissions/:id` không kiểm tra chủ sở hữu |
| Tin `userId`/`tenantId`/`role` từ body hoặc query | `POST /posts {"author_id": 42}` |
| Kiểm tra quyền ở danh sách nhưng quên ở chi tiết, hoặc quên ở update/delete | |
| `if (user.role === 'admin')` rải rác | Thêm role là sót |
| Lọc quyền sau khi tải dữ liệu | Chậm, sai phân trang |
| Trả toàn bộ entity ORM ra JSON | Lộ `password_hash`, `email`, ghi chú nội bộ |
| Cập nhật bằng spread `req.body` | Mass assignment `{"role":"admin"}` |
| Ẩn nút ở frontend và coi là xong | |
| Moderator xử lý báo cáo về chính mình | Xung đột lợi ích |
| Test chỉ cho đường thành công | Không có test "user khác bị từ chối" |

## Checklist review

- [ ] Có ma trận quyền (vai trò × hành động × điều kiện) và test cho từng ô, đặc biệt các ô **bị từ chối**.
- [ ] Mọi endpoint có policy khai báo; mặc định từ chối; có test quét route thiếu policy.
- [ ] Mọi truy cập theo ID kiểm tra quyền trên đối tượng (chủ sở hữu/quan hệ/tenant); trả 404 khi không được biết sự tồn tại.
- [ ] Danh sách lọc quyền trong truy vấn SQL, không lọc sau.
- [ ] `userId`, `tenantId`, `role` lấy từ session đã xác thực, không từ input client.
- [ ] Đầu vào dùng allowlist trường; đầu ra dùng DTO theo vai trò.
- [ ] Code kiểm tra permission, không kiểm tra tên role rải rác.
- [ ] Multi-tenant: `tenant_id` trong mọi bảng/index/cache key; RLS bật với `FORCE`; role DB không `BYPASSRLS`; `set_config` theo transaction.
- [ ] Cache quyền có phiên bản/vô hiệu hóa; thu hồi quyền nguy hiểm có hiệu lực trong thời gian đã cam kết.
- [ ] Impersonation: permission riêng, lý do, chỉ đọc mặc định, thời hạn ngắn, audit actor + subject.
- [ ] Đổi role cần step-up, không tự nâng quyền mình, có audit.
