---
title: "Transaction, lock và xử lý đồng thời trong PostgreSQL"
description: "hiểu chính xác PostgreSQL xử lý nhiều transaction cùng lúc thế nào để (1) không mất dữ liệu khi tranh chấp, (2) không làm treo cả hệ thống vì một câu ALTER TABLE, (3) chẩn đoán..."
pubDatetime: 2026-11-18T16:00:00Z
featured: false
tags:
  - database
  - data-engineering
---
# Transaction, lock và xử lý đồng thời trong PostgreSQL

**Mục đích:** hiểu chính xác PostgreSQL xử lý nhiều transaction cùng lúc thế nào để (1) không mất dữ liệu khi tranh chấp, (2) không làm treo cả hệ thống vì một câu `ALTER TABLE`, (3) chẩn đoán được khi có block/deadlock.
**Liên quan:** cơ bản ở [../05-backend-senior/07-thiet-ke-database.md](../05-backend-senior/07-thiet-ke-database.md) · [01-postgres-internals.md](01-postgres-internals.md) · [08-migration-schema-evolution.md](08-migration-schema-evolution.md) · [../05-backend-senior/06-module-bai-kiem-tra-cham-bai.md](../05-backend-senior/06-module-bai-kiem-tra-cham-bai.md)

---

## 1. Isolation level trong PostgreSQL

PostgreSQL chỉ thực sự có **3** mức (`READ UNCOMMITTED` được xử lý như `READ COMMITTED`).

| Mức | Snapshot lấy khi nào | Chống được | Còn có thể xảy ra | Lỗi cần retry |
|---|---|---|---|---|
| **Read Committed** (mặc định) | Mỗi **câu lệnh** | Dirty read | Non-repeatable read, phantom, lost update (nếu đọc-rồi-ghi ở ứng dụng), write skew | Không |
| **Repeatable Read** (snapshot isolation) | Câu lệnh đầu tiên của transaction | + non-repeatable read, phantom, lost update | Write skew | `40001` khi cập nhật dòng mà transaction khác đã sửa sau snapshot |
| **Serializable** (SSI) | Như RR + theo dõi phụ thuộc đọc-ghi | Mọi bất thường: kết quả tương đương chạy tuần tự | — | `40001` khi phát hiện xung đột |

Điểm đặc thù của PostgreSQL ở Read Committed: khi `UPDATE` gặp dòng vừa bị transaction khác sửa và commit, nó **đánh giá lại điều kiện WHERE trên phiên bản mới** rồi cập nhật. Vì vậy `UPDATE … SET x = x + 1` là an toàn; nhưng "đọc ở ứng dụng rồi ghi lại" thì không.

## 2. Demo bất thường

### Lost update (mất cập nhật) – Read Committed

```
T1: SELECT balance FROM wallets WHERE id = 1;   -- 100
T2: SELECT balance FROM wallets WHERE id = 1;   -- 100
T1: UPDATE wallets SET balance = 100 - 30 WHERE id = 1;  COMMIT;  -- 70
T2: UPDATE wallets SET balance = 100 - 50 WHERE id = 1;  COMMIT;  -- 50  ← mất khoản trừ 30
```

Cách chống (chọn một):

| Cách | Code |
|---|---|
| Cập nhật nguyên tử | `UPDATE wallets SET balance = balance - 30 WHERE id = 1 AND balance >= 30 RETURNING balance;` |
| Khóa bi quan | `SELECT … FOR UPDATE` trong cùng transaction rồi mới tính |
| Khóa lạc quan | `UPDATE … SET …, version = version + 1 WHERE id = 1 AND version = $v` → 0 dòng = xung đột, báo client |
| Repeatable Read / Serializable | Transaction thứ hai nhận `40001` → retry |

### Write skew – lọt cả Repeatable Read

LearnHub: quy tắc "mỗi kỳ thi phải luôn có ít nhất 1 giám thị trực".

```
-- Hiện có 2 giám thị A, B đang trực kỳ thi 9
T1 (A xin nghỉ): SELECT count(*) FROM proctors WHERE exam_id=9 AND on_duty;  -- 2 → ok
T2 (B xin nghỉ): SELECT count(*) FROM proctors WHERE exam_id=9 AND on_duty;  -- 2 → ok
T1: UPDATE proctors SET on_duty=false WHERE exam_id=9 AND user_id='A'; COMMIT;
T2: UPDATE proctors SET on_duty=false WHERE exam_id=9 AND user_id='B'; COMMIT;
-- Kết quả: 0 giám thị. Hai transaction sửa hai dòng khác nhau nên RR không phát hiện.
```

Chống: `SERIALIZABLE` (một bên nhận `40001`), hoặc khóa một dòng "cha" chung (`SELECT … FROM exams WHERE id = 9 FOR UPDATE`) trước khi kiểm tra, hoặc ràng buộc ở DB nếu biểu diễn được.

### Retry 40001 – bắt buộc khi dùng RR/Serializable

```ts
async function withSerializableRetry<T>(fn: (tx: Tx) => Promise<T>, maxAttempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.transaction({ isolationLevel: 'serializable' }, fn);
    } catch (e: any) {
      const retryable = e.code === '40001' || e.code === '40P01'; // serialization_failure, deadlock_detected
      if (!retryable || attempt >= maxAttempts) throw e;
      await sleep(Math.random() * 20 * 2 ** attempt);              // backoff + jitter
    }
  }
}
```

Quy tắc: **toàn bộ transaction** phải chạy lại (đọc lại dữ liệu), không chỉ câu lệnh lỗi. Không gửi email/gọi API bên ngoài *bên trong* hàm được retry.

## 3. Lock mức dòng

| Lệnh | Mức khóa dòng | Chặn |
|---|---|---|
| `UPDATE`, `DELETE`, `SELECT … FOR UPDATE` | FOR UPDATE | Mọi khóa dòng khác |
| `UPDATE` không đổi cột khóa (key), `SELECT … FOR NO KEY UPDATE` | FOR NO KEY UPDATE | Ít hơn: không chặn FOR KEY SHARE (của FK) |
| `SELECT … FOR SHARE` | FOR SHARE | Ghi |
| Kiểm tra FK khi insert dòng con | FOR KEY SHARE | Xóa/đổi khóa của dòng cha |

Đọc thường (`SELECT`) **không** lấy khóa dòng và không bị chặn bởi ghi (MVCC).

Biến thể:

- `FOR UPDATE NOWAIT` → lỗi ngay nếu dòng đang bị khóa (dùng cho UI "đang có người sửa").
- `FOR UPDATE SKIP LOCKED` → bỏ qua dòng bị khóa (dùng cho hàng đợi job).

### Hàng đợi job bằng SKIP LOCKED

```sql
-- Worker lấy tối đa 10 bài thi code cần chấm, không tranh nhau
WITH next AS (
  SELECT id FROM grading_jobs
  WHERE status = 'queued' AND run_after <= now()
  ORDER BY priority DESC, id
  FOR UPDATE SKIP LOCKED
  LIMIT 10
)
UPDATE grading_jobs g
SET status = 'running', locked_by = $1, locked_at = now(), attempts = attempts + 1
FROM next WHERE g.id = next.id
RETURNING g.*;
```

Cần thêm: job "running" quá lâu (worker chết) → trả về `queued`; index partial `WHERE status = 'queued'`; dọn job xong định kỳ để tránh bloat. Phù hợp tới vài nghìn job/giây; vượt mức đó cân nhắc hàng đợi chuyên dụng ([../05-backend-senior/10-messaging-kafka.md](../05-backend-senior/10-messaging-kafka.md)).

## 4. Lock mức bảng – bảng phải nhớ

| Lock mode | Lấy bởi | Xung đột với (chặn) |
|---|---|---|
| ACCESS SHARE | `SELECT` | Chỉ ACCESS EXCLUSIVE |
| ROW SHARE | `SELECT … FOR UPDATE/SHARE` | EXCLUSIVE, ACCESS EXCLUSIVE |
| ROW EXCLUSIVE | `INSERT`, `UPDATE`, `DELETE`, `MERGE` | SHARE và mạnh hơn |
| SHARE UPDATE EXCLUSIVE | `VACUUM` (không FULL), `ANALYZE`, `CREATE INDEX CONCURRENTLY`, một số `ALTER TABLE` (`SET STATISTICS`, `VALIDATE CONSTRAINT`) | Chính nó và mạnh hơn — **không chặn đọc/ghi thường** |
| SHARE | `CREATE INDEX` (không concurrently) | **Mọi ghi** |
| SHARE ROW EXCLUSIVE | `CREATE TRIGGER`, một số `ALTER TABLE` (thêm FK phía bảng được tham chiếu) | Ghi |
| EXCLUSIVE | `REFRESH MATERIALIZED VIEW CONCURRENTLY` | Ghi và khóa dòng |
| **ACCESS EXCLUSIVE** | Phần lớn `ALTER TABLE` (thêm cột, đổi kiểu, `SET NOT NULL`, thêm constraint không `NOT VALID`), `DROP`, `TRUNCATE`, `VACUUM FULL`, `CLUSTER`, `REINDEX` (không concurrently), `LOCK TABLE` | **Mọi thứ, kể cả SELECT** |

Tra cứu chính xác từng dạng `ALTER TABLE` trong tài liệu PostgreSQL của đúng phiên bản bạn chạy.

## 5. Hàng đợi khóa – vì sao một ALTER nhỏ làm sập hệ thống

Kịch bản thật:

```
10:00:00  Báo cáo chạy SELECT dài 5 phút trên posts       → giữ ACCESS SHARE
10:00:30  Migration: ALTER TABLE posts ADD COLUMN x int   → cần ACCESS EXCLUSIVE → XẾP HÀNG chờ
10:00:31  Mọi SELECT/INSERT mới vào posts                  → XẾP HÀNG SAU ALTER (không chen được)
10:00:31 → 10:05:00  API đọc bài viết treo, pool kết nối cạn, toàn site lỗi 5xx
```

`ADD COLUMN` (không default biến động) chỉ mất vài ms để thực thi — nhưng **thời gian chờ khóa** mới là vấn đề.

Phòng tránh — mọi migration DDL trên production:

```sql
SET lock_timeout = '3s';          -- không lấy được khóa trong 3s thì bỏ, đừng làm tắc hàng đợi
SET statement_timeout = '15min';
ALTER TABLE posts ADD COLUMN x int;
```

Kèm **retry có backoff** trong công cụ migration. Chi tiết quy trình ở [08-migration-schema-evolution.md](08-migration-schema-evolution.md).

## 6. Deadlock

Deadlock: T1 giữ A chờ B, T2 giữ B chờ A. PostgreSQL phát hiện sau `deadlock_timeout` (mặc định 1s), **hủy một transaction** với lỗi `40P01`.

```
ERROR:  deadlock detected
DETAIL:  Process 4121 waits for ShareLock on transaction 99812; blocked by process 4188.
         Process 4188 waits for ShareLock on transaction 99807; blocked by process 4121.
HINT:  See server log for query details.
CONTEXT:  while updating tuple (12,7) in relation "exam_attempts"
```

Log server (bật `log_lock_waits = on`) cho biết câu lệnh của cả hai process.

Phòng tránh:

| Kỹ thuật | Ví dụ |
|---|---|
| **Luôn khóa theo thứ tự cố định** | Cập nhật nhiều dòng: `ORDER BY id` trong `SELECT … FOR UPDATE` trước khi sửa |
| Transaction ngắn | Không chờ người dùng/API ngoài khi đang giữ khóa |
| Gom thao tác | Một câu `UPDATE … WHERE id = ANY($1)` thay vì nhiều câu theo thứ tự ngẫu nhiên |
| Retry ở ứng dụng | `40P01` là lỗi có thể retry |

Deadlock thỉnh thoảng là bình thường ở hệ tải cao; deadlock lặp lại có mẫu là lỗi thiết kế.

## 7. Advisory lock

Khóa theo **số tùy ý** do ứng dụng định nghĩa, không gắn với bảng.

```sql
-- Chỉ một instance chạy job "publish kết quả kỳ thi 9" tại một thời điểm
SELECT pg_try_advisory_lock(hashtext('publish_results'), 9);   -- true/false ngay
-- ... làm việc ...
SELECT pg_advisory_unlock(hashtext('publish_results'), 9);

-- Dạng gắn transaction, tự nhả khi COMMIT/ROLLBACK (an toàn hơn)
SELECT pg_advisory_xact_lock(hashtext('publish_results'), 9);
```

Bẫy với **PgBouncer transaction pooling**: khóa mức session (`pg_advisory_lock`) có thể rơi lại trên kết nối server khác/không bao giờ được nhả. Dùng dạng `_xact_` trong transaction pooling.

## 8. Transaction dài và "idle in transaction"

Một transaction mở lâu (kể cả không làm gì):

- Giữ khóa → chặn DDL và ghi khác.
- Giữ `backend_xmin` → **VACUUM không dọn được tuple chết toàn cluster** → bloat, nguy cơ wraparound ([01](01-postgres-internals.md)).
- Chiếm một kết nối trong pool.

Nguyên nhân hay gặp: code mở transaction rồi gọi HTTP ra ngoài; lỗi không rollback; công cụ GUI (DBeaver/pgAdmin) để auto-commit tắt.

```sql
-- Transaction mở lâu nhất
SELECT pid, usename, application_name, state,
       now() - xact_start  AS xact_age,
       now() - state_change AS state_age,
       backend_xmin, left(query, 100) AS last_query
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY xact_start LIMIT 10;
```

Bảo vệ:

```ini
statement_timeout = 30s                       # mặc định cho role ứng dụng (đặt theo role, không toàn cục cho mọi người)
idle_in_transaction_session_timeout = 60s
lock_timeout = 10s
transaction_timeout = 5min                    # PG17+
idle_session_timeout = 0                      # cẩn thận với pooler; thường để 0
```

```sql
ALTER ROLE learnhub_app SET statement_timeout = '5s';
ALTER ROLE learnhub_report SET statement_timeout = '10min';
```

## 9. Chẩn đoán đang bị chặn

```sql
-- Ai đang chặn ai
SELECT blocked.pid                     AS blocked_pid,
       now() - blocked.query_start     AS blocked_for,
       left(blocked.query, 80)         AS blocked_query,
       blocking.pid                    AS blocking_pid,
       blocking.state                  AS blocking_state,
       now() - blocking.xact_start     AS blocking_xact_age,
       left(blocking.query, 80)        AS blocking_query
FROM pg_stat_activity blocked
JOIN LATERAL unnest(pg_blocking_pids(blocked.pid)) AS b(pid) ON true
JOIN pg_stat_activity blocking ON blocking.pid = b.pid
ORDER BY blocked_for DESC;
```

```sql
-- Khóa đang chờ, chi tiết theo đối tượng
SELECT l.pid, l.locktype, l.mode, l.granted, l.relation::regclass, a.wait_event_type, a.wait_event
FROM pg_locks l JOIN pg_stat_activity a USING (pid)
WHERE NOT l.granted;
```

Xử lý khẩn: `SELECT pg_cancel_backend(pid);` (hủy câu lệnh) trước; nếu không được mới `pg_terminate_backend(pid)` (ngắt kết nối). Ghi lại pid, câu lệnh, ai ra quyết định — đưa vào postmortem.

## 10. Ví dụ LearnHub: nộp bài đúng một lần

```sql
BEGIN;
-- Khóa attempt, đảm bảo chỉ một request nộp được
SELECT id, status, deadline_at FROM exam_attempts
WHERE id = $1 AND user_id = $2
FOR UPDATE;
-- Ứng dụng kiểm tra: status = 'in_progress' và now() <= deadline_at + grace
UPDATE exam_attempts
SET status = 'submitted', submitted_at = now()
WHERE id = $1 AND status = 'in_progress';      -- điều kiện trạng thái là lớp bảo vệ thứ hai
INSERT INTO grading_jobs (attempt_id) VALUES ($1)
ON CONFLICT (attempt_id) DO NOTHING;           -- unique(attempt_id): idempotent
COMMIT;
```

Ba lớp bảo vệ: khóa dòng, điều kiện trạng thái trong `UPDATE`, ràng buộc unique. Hai request nộp đồng thời → request thứ hai thấy `status = 'submitted'` và trả kết quả cũ (idempotent), không tạo job thứ hai.

## 11. Lỗi agent hay mắc

| Lỗi | Hậu quả |
|---|---|
| "Đọc → kiểm tra → ghi" không khóa, không ràng buộc | Lost update, double submit, vượt số lượng |
| Bật `SERIALIZABLE` nhưng không viết retry | Người dùng nhận lỗi 500 ngẫu nhiên |
| Gọi API ngoài / gửi email trong transaction | Transaction dài; retry gửi email nhiều lần |
| Migration DDL không `lock_timeout` | Treo toàn site vì hàng đợi khóa |
| Khóa nhiều dòng không theo thứ tự | Deadlock lặp lại |
| `pg_advisory_lock` mức session qua PgBouncer transaction mode | Khóa không bao giờ nhả |
| Dùng `pg_terminate_backend` như cách xử lý thường xuyên | Che giấu lỗi thiết kế |

## Checklist review

- [ ] Mọi luồng "đọc-kiểm tra-ghi" có tranh chấp đều dùng cập nhật nguyên tử, khóa dòng, optimistic version hoặc ràng buộc DB.
- [ ] Isolation cao hơn Read Committed có hàm retry cho `40001`/`40P01`, retry toàn transaction.
- [ ] Không có I/O ngoài (HTTP, email, file lớn) bên trong transaction DB.
- [ ] Khóa nhiều dòng theo thứ tự xác định.
- [ ] Hàng đợi trên Postgres dùng `FOR UPDATE SKIP LOCKED`, có xử lý job treo và index partial.
- [ ] DDL có `lock_timeout` + retry; biết lệnh nào lấy ACCESS EXCLUSIVE.
- [ ] Role ứng dụng có `statement_timeout`, `idle_in_transaction_session_timeout`.
- [ ] `log_lock_waits = on`; có truy vấn/dashboard xem blocking và transaction dài.
- [ ] Advisory lock dùng dạng `_xact_` khi qua pooler transaction mode.
