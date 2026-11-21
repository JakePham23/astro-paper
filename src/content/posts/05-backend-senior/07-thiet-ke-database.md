---
title: "Thiết kế và vận hành cơ sở dữ liệu"
description: "nắm những quyết định về database ảnh hưởng lớn nhất tới tính đúng đắn và hiệu năng ở quy mô hàng triệu user — và đọc được code/migration do agent viết để phát hiện vấn đề."
pubDatetime: 2026-11-19T02:00:00Z
featured: false
tags:
  - backend
  - system-design
  - database
---
# Thiết kế và vận hành cơ sở dữ liệu

**Mục đích:** nắm những quyết định về database ảnh hưởng lớn nhất tới tính đúng đắn và hiệu năng ở quy mô hàng triệu user — và đọc được code/migration do agent viết để phát hiện vấn đề.
Ví dụ: **LearnHub** (5 triệu user, 200k đồng thời). Minh họa bằng PostgreSQL 16+; phần lớn khái niệm (index, isolation, locking, migration) áp dụng cho MySQL, SQL Server, Oracle với cú pháp khác.

**Liên quan:** [05-module-bai-viet-kiem-duyet.md](05-module-bai-viet-kiem-duyet.md) · [06-module-bai-kiem-tra-cham-bai.md](06-module-bai-kiem-tra-cham-bai.md) · [08-thiet-ke-api.md](08-thiet-ke-api.md) · [09-scale-trieu-user.md](09-scale-trieu-user.md) · [10-messaging-kafka.md](10-messaging-kafka.md) · [12-observability-reliability.md](12-observability-reliability.md) · [13-checklist-review-backend.md](13-checklist-review-backend.md)

---

## 1. Mô hình hóa: chuẩn hóa và phi chuẩn hóa

**Mặc định: chuẩn hóa (3NF)** — mỗi sự thật lưu một chỗ, ràng buộc toàn vẹn ở DB (`NOT NULL`, `UNIQUE`, `FOREIGN KEY`, `CHECK`). Ràng buộc ở DB là lớp bảo vệ cuối cùng khi code có bug hoặc có race.

**Phi chuẩn hóa có chủ đích** khi đo được đường đọc quá đắt:

| Kỹ thuật | Ví dụ LearnHub | Cái giá |
|---|---|---|
| Counter cache | `posts.like_count` | Phải đồng bộ; có job đối soát với `post_likes` |
| Sao chép trường | `comments.author_name` để khỏi join | Đổi tên user → phải cập nhật hàng loạt (hoặc chấp nhận tên cũ) |
| Bảng tổng hợp | `course_daily_stats` | Trễ dữ liệu; cần job tính |
| Materialized view | Bảng xếp hạng | `REFRESH MATERIALIZED VIEW CONCURRENTLY` định kỳ |
| JSONB | Cấu hình, thuộc tính linh hoạt | Khó ràng buộc, khó query/index phức tạp |

Quy tắc JSONB: dùng cho dữ liệu **không** dùng để join/lọc thường xuyên và có schema thay đổi; trường nào lọc thường xuyên thì tách thành cột.

**Kiểu dữ liệu:** `timestamptz` (không dùng `timestamp` không múi giờ); `numeric` cho tiền/điểm; `text` + `CHECK` độ dài thay `varchar(n)` tùy tiện; `citext` hoặc chuẩn hóa lowercase cho email; enum hoặc bảng tra cứu cho trạng thái.

## 2. Khóa chính: bigint hay UUID (v4/v7)

| | `bigint` identity | UUIDv4 | UUIDv7 |
|---|---|---|---|
| Kích thước | 8 byte | 16 byte | 16 byte |
| Lộ thông tin | Lộ số lượng, đoán được id kế tiếp | Không | Lộ thời điểm tạo (thường chấp nhận được) |
| Sinh ở client/service khác | Không (cần DB) | Có | Có |
| Locality của B-tree | Tốt (tăng dần) | **Kém**: chèn ngẫu nhiên → page split, cache kém, WAL lớn | Tốt (tăng theo thời gian) |
| Merge dữ liệu nhiều nguồn/shard | Dễ trùng | An toàn | An toàn |

**Khuyến nghị:** UUIDv7 cho id lộ ra ngoài API (posts, attempts); `bigint` cho bảng nội bộ khối lượng lớn (log, sự kiện). Không bao giờ dựa vào "id khó đoán" để thay cho kiểm tra quyền.

## 3. Index

### 3.1 Các loại

| Loại | Dùng cho |
|---|---|
| B-tree (mặc định) | `=`, `<`, `>`, `BETWEEN`, `ORDER BY`, tiền tố `LIKE 'abc%'` |
| GIN | `jsonb` (`@>`), mảng, full-text `tsvector`, `pg_trgm` (`LIKE '%abc%'`) |
| GiST | Hình học, khoảng (range), exclusion constraint (chống trùng lịch) |
| BRIN | Bảng rất lớn, dữ liệu chèn theo thứ tự thời gian (log); index cực nhỏ |
| Hash | Chỉ `=`; hiếm khi hơn B-tree |

### 3.2 Index nhiều cột – thứ tự quan trọng

Index `(a, b, c)` dùng được cho `WHERE a=?`, `WHERE a=? AND b=?`, `WHERE a=? ORDER BY b`; **không** dùng tốt cho `WHERE b=?`.

Quy tắc sắp cột: cột lọc bằng `=` trước → cột lọc khoảng/sắp xếp sau. Ví dụ "bài của tác giả X, mới nhất trước": `(author_id, created_at DESC)`.

### 3.3 Covering, partial, expression

```sql
-- Covering: index chứa đủ cột cần → Index Only Scan, không đọc bảng
CREATE INDEX ix_enroll_user ON enrollments (user_id) INCLUDE (course_id, status);

-- Partial: chỉ đánh index phần hay truy vấn → nhỏ, nhanh
CREATE INDEX ix_attempts_due ON attempts (deadline_at) WHERE status = 'in_progress';

-- Expression: khớp đúng biểu thức trong WHERE
CREATE UNIQUE INDEX ux_users_email ON users (lower(email));
```

### 3.4 Cái giá của index

Mỗi index làm chậm mọi `INSERT/UPDATE/DELETE`, tốn đĩa, tốn RAM. Index không dùng đến là chi phí thuần — kiểm tra `pg_stat_user_indexes.idx_scan = 0`. Trên bảng lớn, tạo index bằng `CREATE INDEX CONCURRENTLY` (không khóa ghi; không chạy được trong transaction).

## 4. Đọc EXPLAIN ANALYZE

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title FROM posts
WHERE status='published' AND (published_at, id) < ('2026-11-01', '0193...')
ORDER BY published_at DESC, id DESC LIMIT 21;
```
```
Limit  (cost=0.43..2.10 rows=21) (actual time=0.031..0.090 rows=21 loops=1)
  ->  Index Scan using ix_posts_feed on posts  (actual rows=21 loops=1)
        Index Cond: (ROW(published_at, id) < ROW(...))
        Buffers: shared hit=24
Planning Time: 0.15 ms   Execution Time: 0.11 ms
```

| Nhìn vào | Ý nghĩa |
|---|---|
| `Seq Scan` trên bảng lớn | Thiếu index hoặc index không dùng được (hàm bọc cột, kiểu dữ liệu lệch, `OR`) |
| `rows=` ước lượng lệch xa `actual rows` | Thống kê cũ → `ANALYZE`; hoặc dữ liệu tương quan → `CREATE STATISTICS` |
| `Sort` với `external merge Disk` | Sắp xếp tràn đĩa → thêm index theo thứ tự, hoặc tăng `work_mem` có kiểm soát |
| `Nested Loop` với `loops=` rất lớn | Join sai chiến lược, thường do ước lượng sai |
| `Buffers: shared read` lớn | Đọc đĩa nhiều, dữ liệu không nằm trong cache |
| `Rows Removed by Filter` lớn | Index chưa đủ chọn lọc |

Luôn EXPLAIN trên **dữ liệu cỡ thật** (hoặc bản sao ẩn danh): kế hoạch trên bảng 100 hàng của môi trường dev không nói lên gì.

## 5. Transaction và mức cô lập

### 5.1 Các bất thường

| Bất thường | Mô tả | Ví dụ |
|---|---|---|
| Dirty read | Đọc dữ liệu chưa commit | (Postgres không bao giờ cho phép) |
| Non-repeatable read | Đọc lại một hàng, giá trị đã đổi | Đọc số dư 2 lần trong 1 transaction ra 2 số |
| Phantom | Chạy lại truy vấn, có thêm/mất hàng | Đếm lượt thi 2 lần ra 2 số |
| Lost update | Hai transaction đọc–sửa–ghi, một bản ghi đè bản kia | Hai người cùng sửa bài |
| Write skew | Hai transaction đọc cùng điều kiện, ghi hai hàng khác nhau, vi phạm ràng buộc chung | Hai request cùng thấy "còn 1 lượt" → tạo 2 lượt |

### 5.2 Mức cô lập trong PostgreSQL

| Mức | Chặn | Không chặn | Ghi chú |
|---|---|---|---|
| Read Committed (mặc định) | Dirty read | Non-repeatable, phantom, lost update, write skew | Mỗi câu lệnh thấy snapshot mới |
| Repeatable Read | + non-repeatable, phantom; lost update → lỗi serialization | Write skew | Phải bắt lỗi `40001` và retry |
| Serializable | Tất cả | — | Phải retry khi `40001`; chi phí cao hơn |

**Thực tế:** giữ Read Committed và giải quyết từng chỗ bằng (a) cập nhật nguyên tử `SET x = x + 1`, (b) điều kiện trong `UPDATE ... WHERE status = ...`, (c) ràng buộc `UNIQUE`, (d) khóa tường minh. Dùng Serializable cho đoạn logic phức tạp, kèm vòng retry.

```ts
async function withRetry<T>(fn: () => Promise<T>, max = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (e: any) {
      if (!['40001', '40P01'].includes(e.code) || i >= max) throw e;   // serialization failure, deadlock
      await sleep(2 ** i * 20 + Math.random() * 20);
    }
  }
}
```

### 5.3 Quy tắc transaction

- Ngắn: **không** gọi HTTP/API ngoài, gửi email, chờ người dùng bên trong transaction (giữ khóa và connection).
- Gửi sự kiện ra ngoài → outbox ([10-messaging-kafka.md](10-messaging-kafka.md)).
- Đặt `statement_timeout`, `idle_in_transaction_session_timeout`, `lock_timeout` để một truy vấn tồi không làm sập cả hệ thống.

## 6. Khóa: lạc quan và bi quan

| | Optimistic (cột `version`) | Pessimistic (`SELECT ... FOR UPDATE`) |
|---|---|---|
| Cách làm | `UPDATE ... WHERE id=? AND version=?`; 0 hàng → xung đột | Khóa hàng tới khi commit |
| Hợp khi | Xung đột hiếm; tương tác người dùng dài (form sửa bài) | Xung đột thường xuyên; đoạn ngắn trong server |
| Rủi ro | Người dùng phải làm lại | Deadlock, chờ khóa, giảm thông lượng |

Mẫu hàng đợi công việc trong DB:

```sql
SELECT id, payload FROM jobs
WHERE status = 'ready' AND run_at <= now()
ORDER BY run_at
LIMIT 10
FOR UPDATE SKIP LOCKED;      -- mỗi worker lấy lô khác nhau, không chờ nhau
```

Tránh deadlock: luôn khóa nhiều hàng theo **cùng một thứ tự** (ví dụ theo id tăng dần). Khóa theo khái niệm chưa có hàng (ví dụ "user X + exam Y") → `pg_advisory_xact_lock`.

## 7. Vấn đề N+1

```ts
// SAI: 1 truy vấn danh sách + N truy vấn tác giả
const posts = await db.any('SELECT * FROM posts ... LIMIT 20');
for (const p of posts) p.author = await db.one('SELECT * FROM users WHERE id=$1', [p.author_id]);

// ĐÚNG: 2 truy vấn
const ids = [...new Set(posts.map(p => p.author_id))];
const authors = await db.any('SELECT id, display_name, avatar_url FROM users WHERE id = ANY($1)', [ids]);
```

ORM (Prisma, TypeORM, Hibernate, EF) dễ sinh N+1 qua lazy loading. Phát hiện: log số truy vấn mỗi request, cảnh báo khi > ngưỡng; GraphQL dùng DataLoader. Cũng tránh `SELECT *` — chỉ lấy cột cần.

## 8. Connection pooling

Mỗi connection PostgreSQL là một **tiến trình** (vài MB RAM); vài nghìn connection làm DB chậm vì chuyển ngữ cảnh. 200 pod × pool 20 = 4.000 connection → quá tải.

- Pool trong ứng dụng nhỏ (10–20/instance), cộng **PgBouncer** (transaction pooling) giữa app và DB → DB chỉ cần vài trăm connection thật.
- Transaction pooling nghĩa là **không** dùng được trạng thái gắn session qua nhiều transaction: `SET` session, advisory lock cấp session, `LISTEN`, temp table. (Prepared statement: PgBouncer ≥ 1.21 hỗ trợ ở transaction mode khi bật `max_prepared_statements`.)
- Kích thước pool tối ưu thường ≈ `số core × 2–4` phía DB, không phải "càng nhiều càng tốt".
- Giám sát: thời gian chờ lấy connection; nếu tăng → truy vấn chậm hoặc transaction quá dài, không phải "tăng pool".

## 9. Migration không downtime (expand / contract)

Trong lúc deploy, phiên bản code cũ và mới **chạy cùng lúc**. Mỗi migration phải tương thích với cả hai.

Ví dụ đổi tên `users.fullname` → `display_name`:

| Bước | Deploy | Việc |
|---|---|---|
| 1. Expand | Migration | `ADD COLUMN display_name text` (nullable, không default nặng) |
| 2 | Code v2 | Ghi **cả hai** cột, đọc cột cũ |
| 3 | Job | Backfill theo lô 1.000–10.000 hàng, có nghỉ giữa các lô |
| 4 | Code v3 | Đọc cột mới, vẫn ghi cả hai |
| 5 | Migration | Thêm `NOT NULL` (an toàn: `ADD CONSTRAINT ... CHECK (...) NOT VALID` → `VALIDATE CONSTRAINT`) |
| 6. Contract | Code v4 → migration | Ngừng ghi cột cũ, sau đó `DROP COLUMN` |

Thao tác nguy hiểm trên bảng lớn và cách an toàn:

| Nguy hiểm | Vì sao | An toàn |
|---|---|---|
| `CREATE INDEX` | Khóa ghi suốt thời gian tạo | `CREATE INDEX CONCURRENTLY` |
| `ADD COLUMN ... DEFAULT volatile` / đổi kiểu cột | Viết lại cả bảng | Cột nullable + backfill; kiểu mới = cột mới |
| `ADD FOREIGN KEY` | Quét toàn bảng dưới khóa | `NOT VALID` rồi `VALIDATE CONSTRAINT` |
| `UPDATE` toàn bảng một lệnh | Transaction khổng lồ, bloat, lag replica | Backfill theo lô |
| Bất kỳ DDL nào | Chờ khóa `ACCESS EXCLUSIVE` chặn mọi truy vấn xếp sau | `SET lock_timeout = '3s'` + retry |
| Xóa/đổi tên cột code cũ còn dùng | Code cũ lỗi trong lúc deploy | Expand/contract |

Migration phải nằm trong source control, chạy tự động trong pipeline, có cách khôi phục (hoặc chỉ tiến, "roll forward", với migration được thiết kế an toàn).

## 10. Soft delete

| Ưu | Nhược |
|---|---|
| Khôi phục được, audit, khiếu nại | Mọi truy vấn phải nhớ lọc `deleted_at IS NULL` |
| Giữ khóa ngoại không gãy | `UNIQUE` bị ảnh hưởng (email đã xóa chặn đăng ký lại) |
| | Dữ liệu cá nhân vẫn còn → vướng yêu cầu xóa dữ liệu |

Cách làm tốt: partial unique index `UNIQUE (lower(email)) WHERE deleted_at IS NULL`; view hoặc repository mặc định lọc; job **xóa cứng/ẩn danh hóa** sau thời hạn lưu trữ; hoặc chuyển bản ghi đã xóa sang bảng lưu trữ riêng.

## 11. Read replica và độ trễ sao chép

Replica nhận WAL từ primary, thường trễ mili-giây nhưng có thể lên tới giây/phút khi primary ghi nhiều hoặc có truy vấn dài trên replica.

Lỗi kinh điển **read-your-writes**: user sửa hồ sơ (ghi primary), trang tải lại đọc replica → thấy dữ liệu cũ → tưởng lưu thất bại.

Cách xử lý:
- Đọc từ primary trong N giây sau khi user ghi (đánh dấu trong session/cookie).
- Dữ liệu dùng để **ra quyết định** (số dư, số lượt thi, quyền) luôn đọc primary.
- Truyền LSN: sau khi ghi lấy `pg_current_wal_lsn()`, replica chỉ phục vụ khi `pg_last_wal_replay_lsn() >= lsn`.
- Giám sát độ trễ; vượt ngưỡng thì loại replica khỏi pool đọc.

## 12. Partitioning và sharding

**Partitioning** (một DB, chia bảng thành nhiều bảng con):

```sql
CREATE TABLE attempt_events (
  id bigint GENERATED ALWAYS AS IDENTITY, attempt_id uuid NOT NULL, type text NOT NULL,
  payload jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)                      -- khóa chính phải chứa cột partition
) PARTITION BY RANGE (created_at);
CREATE TABLE attempt_events_2026_11 PARTITION OF attempt_events
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
```

Lợi ích: xóa dữ liệu cũ bằng `DROP/DETACH PARTITION` (tức thì, không bloat), truy vấn theo thời gian chỉ quét partition liên quan. Dùng khi bảng > vài trăm triệu hàng hoặc có chính sách hết hạn dữ liệu. Tạo partition trước bằng job (hoặc `pg_partman`). Truy vấn **không** lọc theo khóa partition sẽ quét tất cả.

**Sharding** (nhiều DB): chỉ khi một primary (đã scale dọc, có replica, có cache) không chịu được tải **ghi** hoặc dung lượng. Phức tạp: truy vấn chéo shard, transaction phân tán, cân bằng lại. Cân nhắc Citus, hoặc chia theo dịch vụ/miền trước. Với 5 triệu user, một cụm PostgreSQL tốt + replica + cache thường đủ.

## 13. Khi nào dùng NoSQL

| Hệ | Mạnh ở | Dùng khi | Không dùng khi |
|---|---|---|---|
| **PostgreSQL** | Quan hệ, transaction, ràng buộc, JSONB, FTS | Mặc định cho dữ liệu nghiệp vụ | Ghi cực lớn phân tán toàn cầu |
| **MongoDB** | Tài liệu linh hoạt, schema thay đổi | Nội dung có cấu trúc lồng nhau đa dạng, đọc theo tài liệu | Cần join/transaction nhiều thực thể thường xuyên |
| **DynamoDB** | Key-value/tài liệu, scale tự động, độ trễ ổn định | Mẫu truy cập biết trước, theo khóa; serverless AWS | Truy vấn ad-hoc, báo cáo; mẫu truy cập chưa rõ |
| **Cassandra/ScyllaDB** | Ghi cực lớn, nhiều datacenter | Time-series, log sự kiện, tin nhắn khối lượng lớn | Cần nhất quán mạnh, truy vấn linh hoạt |
| **Redis** | Bộ nhớ, cấu trúc dữ liệu | Cache, session, rate limit, counter, leaderboard | Nguồn sự thật duy nhất cho dữ liệu quan trọng |
| **ClickHouse/BigQuery** | Phân tích cột | Báo cáo, thống kê trên tỷ hàng | OLTP |

Quy tắc: bắt đầu với PostgreSQL; thêm hệ khác khi có **mẫu truy cập cụ thể** mà Postgres phục vụ kém, đã đo đạc, và đội có khả năng vận hành hệ đó.

## 14. Sao lưu và khôi phục

- **Backup vật lý + WAL archiving** (pgBackRest, WAL-G, hoặc dịch vụ quản lý như RDS/Cloud SQL) → **PITR**: khôi phục tới bất kỳ thời điểm nào, ví dụ ngay trước lệnh `DELETE` nhầm.
- `pg_dump` (logic) chỉ phù hợp DB nhỏ hoặc chuyển dữ liệu; chậm với DB lớn.
- Xác định **RPO** (chấp nhận mất tối đa bao nhiêu dữ liệu) và **RTO** (khôi phục trong bao lâu) — đây là quyết định nghiệp vụ.
- Backup lưu ở vùng/tài khoản khác, mã hóa, bất biến (chống ransomware).
- **Diễn tập khôi phục định kỳ** — backup chưa từng khôi phục thử coi như không có.
- Replica **không phải** backup: lệnh xóa nhầm được sao chép sang replica ngay.

## 15. Lỗi agent AI hay mắc

1. Thiếu index cho khóa ngoại và cột lọc chính; hoặc thêm index thừa cho mọi cột.
2. `SELECT count(*)` rồi `INSERT` để "kiểm tra trùng" thay vì `UNIQUE` + `ON CONFLICT`.
3. Gọi API ngoài bên trong transaction.
4. Migration `CREATE INDEX` không `CONCURRENTLY`, đổi kiểu cột/đổi tên cột trực tiếp trên bảng lớn.
5. N+1 qua ORM; `SELECT *`.
6. Dùng `OFFSET` lớn; `LIKE '%x%'` không có trigram index.
7. Ghép chuỗi SQL với input người dùng (SQL injection) — luôn dùng tham số.
8. Dùng float cho tiền/điểm; `timestamp` không múi giờ.
9. Đọc replica cho dữ liệu quyết định.
10. Không đặt timeout; không xử lý lỗi `40001`/deadlock.

## Checklist review

- [ ] Ràng buộc toàn vẹn ở DB (`NOT NULL`, `UNIQUE`, FK, `CHECK`) cho mọi bất biến quan trọng, không chỉ kiểm tra ở code.
- [ ] Mọi truy vấn mới đã có `EXPLAIN ANALYZE` trên dữ liệu cỡ thật; index khớp thứ tự lọc/sắp xếp.
- [ ] Không có N+1; không `SELECT *` ở đường nóng; phân trang bằng cursor.
- [ ] Race condition được xử lý bằng ràng buộc/cập nhật có điều kiện/khóa; có test đồng thời.
- [ ] Transaction ngắn, không gọi dịch vụ ngoài; có timeout; xử lý retry cho serialization/deadlock khi cần.
- [ ] Migration an toàn khi code cũ và mới chạy song song (expand/contract), `CONCURRENTLY`, `NOT VALID`, backfill theo lô, `lock_timeout`.
- [ ] Truy vấn tham số hóa; không ghép chuỗi SQL.
- [ ] Kiểu dữ liệu đúng (`timestamptz`, `numeric`, id phù hợp).
- [ ] Soft delete lọc nhất quán, unique là partial index, có chính sách xóa cứng.
- [ ] Đọc replica chỉ cho dữ liệu chấp nhận trễ; có xử lý read-your-writes.
- [ ] Có kế hoạch backup/PITR, RPO/RTO được xác nhận, đã diễn tập khôi phục.
