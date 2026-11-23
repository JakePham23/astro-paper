---
title: "Bảo mật database"
description: "bảo vệ dữ liệu ở tầng database theo nguyên tắc phòng thủ nhiều lớp: quyền tối thiểu, mạng, xác thực, mã hóa, kiểm toán, dữ liệu không phải production, và tuân thủ pháp lý."
pubDatetime: 2026-11-18T08:00:00Z
featured: false
tags:
  - database
  - data-engineering
  - security
---
# Bảo mật database

**Mục đích:** bảo vệ dữ liệu ở tầng database theo nguyên tắc phòng thủ nhiều lớp: quyền tối thiểu, mạng, xác thực, mã hóa, kiểm toán, dữ liệu không phải production, và tuân thủ pháp lý.
**Liên quan:** [05-backup-restore-dr.md](05-backup-restore-dr.md) · [07-cau-hinh-van-hanh-monitoring.md](07-cau-hinh-van-hanh-monitoring.md) · [08-migration-schema-evolution.md](08-migration-schema-evolution.md) · [09-redis-chuyen-sau.md](09-redis-chuyen-sau.md) · [12-checklist-review-database.md](12-checklist-review-database.md) · Ứng dụng: [../05-backend-senior/11-bao-mat.md](../05-backend-senior/11-bao-mat.md) · Phân quyền và multi-tenant: [../05-backend-senior/03-phan-quyen.md](../05-backend-senior/03-phan-quyen.md) · Hạ tầng: [../07-he-thong-server/](../07-he-thong-server/)

---

## 1. Mô hình đe dọa ngắn cho DB LearnHub

| Mối đe dọa | Ví dụ | Lớp phòng thủ |
|---|---|---|
| SQL injection từ ứng dụng | Tham số tìm kiếm nối chuỗi | Truy vấn tham số hóa + role ứng dụng ít quyền + RLS |
| Lộ thông tin đăng nhập DB | Chuỗi kết nối trong repo, log, ảnh Docker | Secret manager, credential ngắn hạn, mạng riêng |
| Truy cập từ Internet | DB có IP public, mật khẩu yếu | Subnet riêng, security group, không IP public |
| Người nội bộ / dev truy cập production | Xem điểm/thông tin cá nhân học sinh | Quyền tối thiểu, truy cập qua bastion có kiểm toán, dữ liệu ẩn danh cho dev |
| Rò rỉ backup/dump | Bucket S3 công khai, file dump trên laptop | Mã hóa, quyền bucket, không dump production ra máy cá nhân |
| Nghe lén mạng | Kết nối không TLS | Bắt buộc TLS |
| Leo thang trong DB | Role ứng dụng là superuser, function `SECURITY DEFINER` không an toàn | Role tách bạch, kiểm soát `search_path` |

## 2. Role và quyền tối thiểu

### 2.1 Tách role theo vai trò

| Role | Quyền | Dùng bởi |
|---|---|---|
| `learnhub_owner` (NOLOGIN) | Sở hữu schema và bảng | Không ai đăng nhập trực tiếp |
| `learnhub_migrator` | Thành viên của owner; chạy DDL | Job migration trong CI/CD |
| `learnhub_app` | `SELECT/INSERT/UPDATE/DELETE` trên bảng cần thiết; `USAGE` sequence | Ứng dụng |
| `learnhub_readonly` | `SELECT` (có thể trừ cột nhạy cảm) | Báo cáo, phân tích |
| `dba_<tên>` | Quyền quản trị cá nhân, có kiểm toán | DBA (không dùng chung tài khoản) |

Ứng dụng **không bao giờ** là superuser hay owner bảng (owner bỏ qua RLS mặc định và có thể `DROP`).

```sql
-- Owner không đăng nhập
CREATE ROLE learnhub_owner NOLOGIN;
CREATE SCHEMA app AUTHORIZATION learnhub_owner;

-- Khóa schema public (PG15+ đã bỏ quyền CREATE mặc định cho PUBLIC; phiên bản cũ phải tự làm)
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE learnhub FROM PUBLIC;

-- Role ứng dụng
CREATE ROLE learnhub_app LOGIN PASSWORD '<password>';   -- tốt hơn: credential động (§6)
GRANT CONNECT ON DATABASE learnhub TO learnhub_app;
GRANT USAGE ON SCHEMA app TO learnhub_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO learnhub_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO learnhub_app;

-- Bảng tạo SAU NÀY bởi owner cũng tự cấp quyền
ALTER DEFAULT PRIVILEGES FOR ROLE learnhub_owner IN SCHEMA app
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO learnhub_app;
ALTER DEFAULT PRIVILEGES FOR ROLE learnhub_owner IN SCHEMA app
  GRANT USAGE ON SEQUENCES TO learnhub_app;

-- Bảng nhạy cảm: thu hẹp
REVOKE UPDATE, DELETE ON app.audit_log FROM learnhub_app;      -- log chỉ thêm
REVOKE ALL ON app.user_credentials FROM learnhub_readonly;     -- báo cáo không thấy hash mật khẩu

-- Cố định search_path để tránh chiếm đoạt hàm/bảng cùng tên
ALTER ROLE learnhub_app SET search_path = app;
```

Có thể dùng role có sẵn `pg_read_all_data` / `pg_write_all_data` (PG14+) cho tài khoản đọc toàn bộ, nhưng chúng rộng — với dữ liệu nhạy cảm, cấp theo bảng/cột.

### 2.2 Hàm `SECURITY DEFINER`

Chạy với quyền của người tạo — hữu ích nhưng nguy hiểm. Bắt buộc:

```sql
CREATE FUNCTION app.reset_attempt(p_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = app, pg_temp      -- tránh chiếm đoạt qua search_path
AS $$ UPDATE app.exam_attempts SET status = 'reset' WHERE id = p_id $$;
REVOKE EXECUTE ON FUNCTION app.reset_attempt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.reset_attempt(uuid) TO learnhub_support;
```

## 3. Xác thực kết nối: pg_hba.conf và SCRAM

```
# TYPE    DATABASE     USER               ADDRESS          METHOD
local     all          postgres                            peer
hostssl   learnhub     learnhub_app       10.0.10.0/24     scram-sha-256
hostssl   learnhub     learnhub_readonly  10.0.20.0/24     scram-sha-256
hostssl   replication  replicator         10.0.1.0/24      scram-sha-256
host      all          all                0.0.0.0/0        reject
```

- Thứ tự quan trọng: dòng đầu tiên khớp được áp dụng; dòng `reject` cuối chặn mọi thứ còn lại (kể cả kết nối không TLS vì các dòng cho phép đều là `hostssl`).
- `password_encryption = scram-sha-256` (mặc định từ PG14). Không dùng `md5` (PG18 đã đánh dấu deprecated) hay `trust`.
- Sau khi chuyển sang SCRAM, đặt lại mật khẩu để hash được lưu dạng SCRAM.
- Giới hạn theo user + database + dải mạng cụ thể, không `all all 0.0.0.0/0` cho phép.

## 4. TLS bắt buộc

Server:

```ini
ssl = on
ssl_cert_file = '/etc/postgresql/tls/server.crt'
ssl_key_file  = '/etc/postgresql/tls/server.key'
ssl_min_protocol_version = 'TLSv1.2'
```

Client phải **xác minh** chứng chỉ, không chỉ mã hóa. Dạng tham số libpq:

```
host=db.internal port=5432 dbname=learnhub user=learnhub_app sslmode=verify-full sslrootcert=/etc/ssl/db-ca.pem
```

| `sslmode` | Mã hóa | Chống giả mạo server |
|---|---|---|
| `disable`, `allow`, `prefer` (mặc định libpq) | Không chắc chắn | ❌ |
| `require` | ✅ | ❌ |
| `verify-ca` | ✅ | Một phần (không kiểm tra hostname) |
| `verify-full` | ✅ | ✅ |

Nhiều driver Node có tùy chọn `ssl: { rejectUnauthorized: false }` — agent hay thêm để "sửa lỗi kết nối". Đây là tắt xác minh chứng chỉ; **không chấp nhận** trên production. Sửa bằng cách cấp đúng CA.

Redis cũng cần TLS và xác thực (ACL, xem §10).

## 5. Cô lập mạng

- DB nằm trong **subnet riêng**, không IP public. Security group chỉ cho phép từ subnet ứng dụng và bastion/VPN.
- Truy cập quản trị qua bastion/SSM Session Manager/VPN có MFA và ghi log; không mở cổng 5432 ra Internet "tạm thời".
- PgBouncer cũng ở mạng riêng; không để nó thành cửa hậu với `auth_type = trust`.
- Chi tiết mạng: [../07-he-thong-server/](../07-he-thong-server/).

## 6. Quản lý và xoay vòng credential

| Cách | Mô tả | Ghi chú |
|---|---|---|
| Biến môi trường từ secret manager | App đọc lúc khởi động từ AWS Secrets Manager/Vault/K8s Secret (mã hóa at rest) | Mức tối thiểu chấp nhận được |
| Xoay vòng định kỳ với hai user | Tạo user mới → cập nhật secret → app nhận → xóa user cũ | Tránh downtime khi đổi mật khẩu |
| **Credential động** (Vault database secrets engine) | Mỗi instance app nhận user/mật khẩu riêng, TTL vài giờ, tự thu hồi | Lộ một credential ảnh hưởng hẹp, truy vết được theo instance |
| **IAM authentication** (RDS/Aurora, Cloud SQL, Entra ID cho Azure) | App xin token ngắn hạn (~15 phút) bằng danh tính cloud | Không có mật khẩu tĩnh; cần TLS; chú ý giới hạn tốc độ tạo kết nối mới |

Không bao giờ: mật khẩu trong code, trong `docker-compose.yml` commit vào repo, trong log, trong URL dán vào ticket. Plugin `aiic-astec` của repo này có gitleaks để bắt lỗi kiểu này khi commit.

## 7. Row Level Security (RLS) cho multi-tenant

LearnHub B2B: nhiều trường (tenant) dùng chung bảng. RLS là lớp phòng thủ thứ hai bên cạnh `WHERE tenant_id = ...` trong code.

```sql
ALTER TABLE app.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.posts FORCE ROW LEVEL SECURITY;   -- áp dụng cả cho owner bảng

CREATE POLICY tenant_isolation ON app.posts
  USING      (tenant_id = current_setting('app.tenant_id')::bigint)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::bigint);
```

Ứng dụng đặt tenant **trong transaction** (bắt buộc khi dùng PgBouncer transaction mode):

```ts
await db.tx(async (t) => {
  await t.query(`SELECT set_config('app.tenant_id', $1, true)`, [String(tenantId)]); // true = chỉ trong transaction
  return t.query(`SELECT id, title FROM app.posts WHERE id = $1`, [postId]);
});
```

Bẫy:

| Bẫy | Hệ quả | Cách tránh |
|---|---|---|
| Role có `BYPASSRLS` hoặc là superuser | Bỏ qua mọi policy | Role ứng dụng không có các thuộc tính này |
| Owner bảng | Mặc định không bị RLS | `FORCE ROW LEVEL SECURITY`, app không phải owner |
| Tenant chưa đặt | `current_setting('app.tenant_id')` báo lỗi (tốt); dạng `current_setting(..., true)` trả NULL → không hàng nào khớp (tốt) | Đừng viết policy kiểu `OR setting IS NULL`; test trường hợp thiếu tenant |
| `SET` cấp phiên qua pooler | Tenant của request trước rò sang request sau | `set_config(..., true)` trong transaction |
| Chỉ có `USING`, thiếu `WITH CHECK` | Với policy `FOR ALL`, `USING` cũng được dùng làm check; nhưng policy riêng cho INSERT/UPDATE thiếu check sẽ cho ghi sang tenant khác | Luôn khai báo rõ cả hai |
| Hàm không `LEAKPROOF` trong điều kiện truy vấn | Planner có thể không đẩy điều kiện người dùng xuống trước policy → kém hiệu năng | Kiểm tra `EXPLAIN` |
| View được tạo bởi owner | Chạy với quyền owner, bỏ qua RLS | PG15+: `CREATE VIEW ... WITH (security_invoker = true)` |
| Hiệu năng | Mỗi truy vấn thêm điều kiện | Index bắt đầu bằng `tenant_id` |

Viết test tự động: đặt tenant A, truy vấn mọi bảng có RLS, không được thấy hay ghi được dữ liệu tenant B.

## 8. Mã hóa

| Lớp | Bảo vệ khỏi | Không bảo vệ khỏi | Cách làm |
|---|---|---|---|
| Đường truyền (TLS) | Nghe lén mạng | Ai đã vào được DB | §4 |
| Lưu trữ (đĩa/volume, TDE) | Mất đĩa, snapshot bị lấy cắp | Người có quyền truy vấn, SQL injection | EBS/RDS encryption bằng KMS; PostgreSQL cộng đồng chưa có TDE sẵn (có ở một số bản phân phối thương mại) |
| Cột trong DB (`pgcrypto`) | Người đọc bảng nhưng không có khóa | Khóa đi kèm câu SQL → có thể xuất hiện trong log/`pg_stat_statements` | Ít khuyến nghị |
| **Ứng dụng (envelope encryption)** | DBA, dump, SQL injection đọc bảng | Kẻ chiếm được cả app và quyền KMS | App mã hóa bằng data key, data key được KMS bọc; lưu ciphertext + key id |

Áp dụng LearnHub:
- Mật khẩu: **không mã hóa — băm** (Argon2id), xem [../05-backend-senior/01-authentication.md](../05-backend-senior/01-authentication.md).
- Số CCCD, số điện thoại phụ huynh, ghi chú sức khỏe/hỗ trợ đặc biệt (nếu có): mã hóa ở ứng dụng. Cần tra cứu chính xác thì lưu thêm **blind index** (HMAC với khóa riêng) để `WHERE phone_hmac = $1`.
- Mã hóa ở ứng dụng làm mất khả năng tìm kiếm/sắp xếp trên cột đó — chỉ áp dụng cho trường thật sự nhạy cảm.
- Xoay vòng khóa: lưu `key_id` cùng ciphertext để giải mã dữ liệu cũ và mã hóa lại dần.

## 9. Kiểm toán (audit)

| Mức | Công cụ | Ghi gì |
|---|---|---|
| Ứng dụng | Bảng `audit_log` (ai, làm gì, đối tượng nào, khi nào, từ đâu) | Hành động nghiệp vụ: sửa điểm, xem hồ sơ học sinh, đổi quyền |
| Database | **pgAudit** (`shared_preload_libraries = 'pgaudit'`) | Câu lệnh theo lớp: `ddl, role` cho mọi người; `read, write` cho role nhạy cảm hoặc theo bảng (object audit) |
| Hạ tầng | CloudTrail / log của dịch vụ managed | Ai đổi cấu hình, snapshot, security group |

```sql
ALTER SYSTEM SET pgaudit.log = 'ddl, role';   -- mọi DDL và thay đổi quyền
ALTER ROLE dba_nguyen SET pgaudit.log = 'all'; -- mọi thứ DBA cá nhân làm
SELECT pg_reload_conf();
```

Log kiểm toán gửi tới hệ thống tập trung mà người bị kiểm toán không sửa/xóa được. Mọi phiên truy cập production của con người đều được ghi.

## 10. Bảo mật Redis

- Không mở ra Internet (sự cố kinh điển: Redis không mật khẩu bị chiếm để ghi SSH key qua `CONFIG SET dir`).
- Bật ACL (Redis 6+), mỗi ứng dụng một user, giới hạn key pattern và nhóm lệnh:

```
ACL SETUSER learnhub_app on ><password> ~cache:* ~sess:* ~rl:* ~lb:* +@read +@write +@fast -@dangerous
ACL SETUSER default off
```

- TLS (`tls-port`), `protected-mode yes`, vô hiệu hóa lệnh nguy hiểm trên bản tự vận hành.
- Dữ liệu cá nhân trong cache vẫn là dữ liệu cá nhân: đặt TTL, không cache trường nhạy cảm không cần thiết.

## 11. Dữ liệu cho môi trường không phải production

Quy tắc: **dữ liệu thật không rời production**. Dev, test, staging, và môi trường agent làm việc dùng dữ liệu tổng hợp hoặc đã ẩn danh.

| Kỹ thuật | Ví dụ |
|---|---|
| Thay thế nhất quán | Tên → tên giả sinh từ hash của id (cùng id → cùng tên giả để giữ quan hệ) |
| Che một phần | Số điện thoại → `09xx xxx 123` |
| Xáo trộn | Hoán đổi giá trị giữa các hàng (giữ phân phối) |
| Tổng quát hóa | Ngày sinh → năm sinh |
| Xóa | Ghi chú tự do, file đính kèm |
| Dữ liệu tổng hợp | Sinh hoàn toàn bằng script/factory |

Công cụ: PostgreSQL Anonymizer (extension `anon`, masking động và tĩnh), `pg_dump` qua bước biến đổi, dịch vụ masking của cloud. Bước ẩn danh chạy **trong** vùng production; chỉ kết quả đã ẩn danh mới được xuất ra.

Không đưa dump production vào prompt của agent hoặc dán dữ liệu cá nhân thật vào hội thoại với công cụ AI — guardrail PII của plugin `aiic-astec` tồn tại vì lý do này.

## 12. Phòng thủ nhiều lớp trước SQL injection

Lớp chính ở ứng dụng: **truy vấn tham số hóa** ([../05-backend-senior/11-bao-mat.md](../05-backend-senior/11-bao-mat.md)). Ở tầng DB, giảm thiệt hại khi lớp đó thất bại:

- Role ứng dụng không có DDL, không superuser → không `DROP TABLE`, không `COPY ... TO PROGRAM`, không đọc file hệ thống.
- RLS giới hạn hàng đọc được.
- Cột nhạy cảm mã hóa ở ứng dụng → đọc được bảng vẫn không có bản rõ.
- `statement_timeout` giới hạn truy vấn kéo dài cố ý (`pg_sleep`).
- Tên bảng/cột động (sắp xếp theo cột người dùng chọn) không tham số hóa được → **allowlist** phía app; trong SQL động dùng `format('%I', ...)`/`quote_ident`.
- Giám sát lỗi cú pháp SQL bất thường trong log (dấu hiệu dò quét).

## 13. Bảo mật backup

- Mã hóa backup (KMS), bucket không công khai, chặn xóa (Object Lock/WORM) để ransomware không xóa được cả backup.
- Quyền ghi backup tách khỏi quyền đọc/khôi phục; tốt nhất sao lưu sang **tài khoản cloud khác**.
- Thời hạn lưu theo chính sách, xóa khi hết hạn (dữ liệu cá nhân không được lưu vô thời hạn).
- Môi trường khôi phục thử có cùng mức bảo mật như production.
- Chi tiết: [05-backup-restore-dr.md](05-backup-restore-dr.md).

## 14. Pháp lý: Nghị định 13/2023/NĐ-CP và Luật Bảo vệ dữ liệu cá nhân – hệ quả kỹ thuật

> Tóm tắt kỹ thuật, không phải tư vấn pháp lý. Luật Bảo vệ dữ liệu cá nhân (số 91/2025/QH15) có hiệu lực từ 01/01/2026 và thay thế nhiều quy định của Nghị định 13 — xác nhận yêu cầu cụ thể với bộ phận pháp chế.

| Yêu cầu | Hệ quả cho DB |
|---|---|
| Phân loại dữ liệu cá nhân **cơ bản** và **nhạy cảm** (sức khỏe, tài chính, vị trí, dữ liệu trẻ em…) | Gắn nhãn cột/bảng; dữ liệu nhạy cảm mã hóa và kiểm toán truy cập |
| Dữ liệu **trẻ em** cần đồng ý của cha mẹ/người giám hộ | LearnHub có học sinh: lưu bằng chứng đồng ý (ai, khi nào, phiên bản điều khoản) |
| Quyền của chủ thể: truy cập, chỉnh sửa, xóa, rút đồng ý | Làm được "xuất mọi dữ liệu của user X" và "xóa/ẩn danh user X" trên DB, replica, search index, OLAP, cache; backup hết hạn theo chu kỳ |
| Tối thiểu hóa, giới hạn mục đích và thời gian lưu | Chính sách retention theo bảng (partition + DETACH giúp thực thi) |
| Biện pháp bảo vệ và ghi nhật ký | Quyền tối thiểu, mã hóa, audit log |
| Thông báo vi phạm trong thời hạn (NĐ 13: 72 giờ) | Phải **phát hiện** được: audit, cảnh báo truy cập bất thường, giám sát xuất dữ liệu lớn |
| Đánh giá tác động, chuyển dữ liệu ra nước ngoài | Biết dữ liệu nằm ở region nào; ghi trong hồ sơ |

## 15. Sai lầm hay gặp (kể cả của agent)

- Dùng `postgres` (superuser) làm user của ứng dụng.
- `sslmode=require` hoặc `rejectUnauthorized: false` cho "tiện".
- `pg_hba.conf` có `host all all 0.0.0.0/0 md5` hoặc `trust`.
- Mật khẩu DB trong `.env` commit vào repo, trong docker-compose, trong log khởi động.
- Bật RLS nhưng app kết nối bằng owner bảng hoặc role `BYPASSRLS`.
- `SET app.tenant_id` cấp phiên qua PgBouncer.
- Mã hóa mật khẩu (hai chiều) thay vì băm.
- Dump production về máy dev để "debug nhanh".
- Agent chạy lệnh trên DB production với quyền cao vì "chỉ là SELECT".
- Không có cách xóa dữ liệu một user khỏi mọi hệ thống phái sinh.

## Checklist review

- [ ] Ứng dụng dùng role riêng, không superuser, không owner, không `BYPASSRLS`; `search_path` cố định.
- [ ] `ALTER DEFAULT PRIVILEGES` được cấu hình; quyền trên bảng nhạy cảm được thu hẹp (audit chỉ thêm, readonly không thấy credential).
- [ ] `pg_hba.conf` dùng `hostssl` + `scram-sha-256`, giới hạn theo dải mạng, có dòng `reject` cuối.
- [ ] Client kết nối với `sslmode=verify-full` (hoặc tương đương); không tắt xác minh chứng chỉ.
- [ ] DB không có IP public; truy cập quản trị qua bastion/VPN có kiểm toán.
- [ ] Không có credential trong code, config commit, log; có xoay vòng hoặc credential động/IAM.
- [ ] RLS (nếu dùng): `FORCE`, `USING` + `WITH CHECK`, tenant đặt bằng `set_config(..., true)` trong transaction, có test chéo tenant, view dùng `security_invoker`.
- [ ] Trường nhạy cảm mã hóa ở ứng dụng với khóa trong KMS; mật khẩu được băm.
- [ ] pgAudit hoặc tương đương ghi DDL, thay đổi quyền và truy cập của người vào production.
- [ ] Redis có ACL, TLS, không mở Internet, user `default` bị tắt.
- [ ] Môi trường không phải production dùng dữ liệu ẩn danh/tổng hợp; không có dump production ngoài vùng an toàn.
- [ ] Backup mã hóa, chống xóa, ở tài khoản/khu vực tách biệt, có thời hạn lưu.
- [ ] Có quy trình xuất và xóa dữ liệu của một user trên mọi kho (DB, replica, search, OLAP, cache).
