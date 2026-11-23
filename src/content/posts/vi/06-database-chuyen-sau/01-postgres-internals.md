---
title: "PostgreSQL internals – hiểu máy chạy bên trong"
description: "hiểu PostgreSQL lưu và đọc dữ liệu thế nào (process, bộ nhớ, MVCC, VACUUM, WAL) để giải thích được tại sao hệ thống chậm, phình to hoặc ngừng nhận ghi — và cấu hình đúng trước..."
pubDatetime: 2026-11-18T18:00:00Z
featured: false
tags:
  - database
  - data-engineering
  - postgresql
---
# PostgreSQL internals – hiểu máy chạy bên trong

**Mục đích:** hiểu PostgreSQL lưu và đọc dữ liệu thế nào (process, bộ nhớ, MVCC, VACUUM, WAL) để giải thích được *tại sao* hệ thống chậm, phình to hoặc ngừng nhận ghi — và cấu hình đúng trước khi sự cố xảy ra.
**Phiên bản:** PostgreSQL 16–18. Khác biệt giữa các bản được ghi chú tại chỗ.
**Liên quan:** cơ bản ở [../05-backend-senior/07-thiet-ke-database.md](../05-backend-senior/07-thiet-ke-database.md) · [02-index-query-tuning.md](02-index-query-tuning.md) · [03-transaction-lock-concurrency.md](03-transaction-lock-concurrency.md) · [07-cau-hinh-van-hanh-monitoring.md](07-cau-hinh-van-hanh-monitoring.md) · [../07-he-thong-server/](../07-he-thong-server/)

---

## 1. Mô hình process

PostgreSQL dùng **một process hệ điều hành cho mỗi kết nối** (không phải thread).

```
postmaster (tiến trình cha, lắng nghe cổng 5432)
├── backend process   ← 1 cho mỗi kết nối client
├── checkpointer      ← ghi trang bẩn xuống đĩa định kỳ
├── background writer ← ghi dần trang bẩn để backend không phải tự ghi
├── walwriter         ← đẩy WAL buffer xuống đĩa
├── autovacuum launcher + workers
├── stats / archiver / logical replication launcher
└── walsender         ← 1 cho mỗi replica / slot đang stream
```

**Hệ quả quan trọng:**

| Sự thật | Hệ quả thực tế |
|---|---|
| Mỗi kết nối là một process, tốn vài MB RAM + chi phí fork | 5.000 kết nối trực tiếp sẽ làm server nghẹt (context switch, RAM, lock contention trên `ProcArray`) |
| Số kết nối *đang làm việc* hiệu quả ≈ vài lần số core CPU | Máy 32 core: thường tối ưu ở 50–150 kết nối active |
| Kết nối idle vẫn tốn tài nguyên và làm chậm việc lấy snapshot | Luôn đặt **PgBouncer** (transaction pooling) trước PostgreSQL |

LearnHub: 40 pod app × pool 20 = 800 kết nối → qua PgBouncer còn ~100 kết nối thật vào DB. Chi tiết pooling ở [07-cau-hinh-van-hanh-monitoring.md](07-cau-hinh-van-hanh-monitoring.md).

## 2. Bộ nhớ: shared_buffers và cache của hệ điều hành

PostgreSQL đọc dữ liệu theo **trang 8 KB**. Một trang có thể nằm ở:

1. `shared_buffers` (bộ nhớ chung của PostgreSQL),
2. page cache của hệ điều hành (Linux),
3. đĩa.

Đây là **double buffering**: cùng một trang có thể nằm ở cả (1) và (2). Vì vậy:

- `shared_buffers` thường đặt **~25% RAM** (không phải 80%). Phần còn lại để OS cache.
- `effective_cache_size` ≈ 50–75% RAM: **không cấp phát gì**, chỉ báo cho planner biết "dữ liệu có khả năng nằm trong cache" → planner ưu tiên index scan hơn.
- `work_mem`: bộ nhớ cho **mỗi** thao tác sort/hash **trong mỗi** query (một query có thể dùng nhiều lần). 64 MB × 5 node sort × 200 kết nối = 64 GB → OOM. Đặt mặc định thấp, tăng theo session cho báo cáo.
- `maintenance_work_mem`: cho VACUUM, CREATE INDEX (0.5–2 GB là bình thường).

Đo tỉ lệ cache hit:

```sql
SELECT datname,
       round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2) AS cache_hit_pct
FROM pg_stat_database WHERE datname = current_database();
-- OLTP khỏe: > 99%. Lưu ý: blks_read có thể đến từ OS cache, không hẳn là đĩa.
```

PG16+ có `pg_stat_io` để xem I/O theo loại backend và ngữ cảnh — chính xác hơn khi điều tra.
PG18 thêm **I/O bất đồng bộ** (`io_method = worker | io_uring | sync`), cải thiện seq scan, bitmap heap scan và VACUUM trên đĩa có độ trễ cao (cloud).

## 3. Heap, trang và tuple

Bảng được lưu thành **heap**: các trang 8 KB không sắp xếp theo thứ tự nào. Mỗi trang chứa header, mảng con trỏ dòng (line pointer) và các **tuple** (phiên bản của một dòng).

Mỗi tuple có header ~23 byte, trong đó quan trọng nhất:

| Trường | Ý nghĩa |
|---|---|
| `xmin` | ID transaction đã **tạo** phiên bản này |
| `xmax` | ID transaction đã **xóa/thay thế** phiên bản này (0 nếu còn sống) |
| `ctid` | Vị trí vật lý `(trang, chỉ số)` — đổi khi dòng bị UPDATE |

```sql
SELECT ctid, xmin, xmax, id, title FROM posts WHERE id = 42;
```

## 4. MVCC – vì sao UPDATE = INSERT + DELETE

PostgreSQL **không ghi đè** dòng. `UPDATE` tạo **tuple mới**, đánh dấu tuple cũ bằng `xmax`. `DELETE` chỉ đặt `xmax`.

```
UPDATE posts SET like_count = like_count + 1 WHERE id = 42;

trước:  [xmin=100 xmax=0   like=10]          ← sống
sau:    [xmin=100 xmax=205 like=10]          ← chết (sau khi 205 commit)
        [xmin=205 xmax=0   like=11]          ← sống
```

**Snapshot**: khi một câu lệnh (Read Committed) hoặc transaction (Repeatable Read) bắt đầu, nó chụp lại "transaction nào đã commit". Một tuple **nhìn thấy được** nếu `xmin` đã commit trước snapshot và `xmax` chưa commit (hoặc bằng 0).

Lợi ích: **người đọc không chặn người ghi, người ghi không chặn người đọc**.
Cái giá: **tuple chết (dead tuple)** tích tụ → cần VACUUM dọn.

Bài học cho LearnHub: cột `like_count`, `view_count` trên `posts` bị UPDATE hàng nghìn lần/giây → mỗi lần sinh một tuple chết + có thể cập nhật mọi index. Đó là lý do nên đếm trong Redis rồi flush theo lô (xem [../05-backend-senior/05-module-bai-viet-kiem-duyet.md](../05-backend-senior/05-module-bai-viet-kiem-duyet.md)), hoặc tách counter sang bảng hẹp riêng.

## 5. Bloat – bảng và index phình to

Tuple chết chiếm chỗ cho tới khi VACUUM đánh dấu chỗ trống để tái sử dụng. VACUUM thường **không trả dung lượng cho OS** (trừ các trang trống ở cuối file). Nếu tốc độ tạo tuple chết > tốc độ dọn → **bloat**: bảng 10 GB dữ liệu thật chiếm 60 GB, seq scan chậm 6 lần, cache kém hiệu quả.

Theo dõi:

```sql
SELECT relname, n_live_tup, n_dead_tup,
       round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,
       last_autovacuum, last_autoanalyze, autovacuum_count
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC LIMIT 20;
```

Đo bloat chính xác: extension `pgstattuple` (`SELECT * FROM pgstattuple('posts');` — quét toàn bảng, chạy giờ thấp điểm) hoặc các truy vấn ước lượng bloat phổ biến.

Gỡ bloat nặng:

| Cách | Khóa | Ghi chú |
|---|---|---|
| `VACUUM FULL` | **ACCESS EXCLUSIVE** suốt quá trình | Viết lại toàn bảng. Production: gần như không bao giờ dùng trên bảng lớn |
| `CLUSTER` | ACCESS EXCLUSIVE | Như trên, thêm sắp xếp theo index |
| `pg_repack` (extension) | Chỉ khóa ngắn đầu/cuối | Cách chuẩn trên production; cần dung lượng trống ≈ kích thước bảng |
| `REINDEX CONCURRENTLY` | Không chặn ghi | Cho index phình (PG12+) |

## 6. VACUUM và autovacuum

VACUUM làm 4 việc:

1. Đánh dấu chỗ của tuple chết là có thể tái sử dụng (free space map).
2. Cập nhật **visibility map** — trang nào "mọi tuple đều nhìn thấy được với mọi người" → cho phép **index-only scan** và cho VACUUM sau bỏ qua trang đó.
3. **Freeze** tuple cũ (xem mục 7).
4. Dọn index trỏ tới tuple chết.

VACUUM **không** dọn được tuple chết mà một transaction đang mở vẫn có thể cần nhìn thấy. **Một transaction mở 6 tiếng chặn VACUUM dọn mọi thứ chết trong 6 tiếng đó trên toàn cluster.** (Xem [03-transaction-lock-concurrency.md](03-transaction-lock-concurrency.md).)

### Khi nào autovacuum chạy

```
ngưỡng vacuum  = autovacuum_vacuum_threshold (50)
               + autovacuum_vacuum_scale_factor (0.2) × số dòng
```

Bảng `answers` 500 triệu dòng → chỉ vacuum khi có **100 triệu** tuple chết. Quá muộn. Tinh chỉnh **theo bảng**:

```sql
ALTER TABLE answers SET (
  autovacuum_vacuum_scale_factor = 0.01,     -- 1%
  autovacuum_vacuum_threshold    = 10000,
  autovacuum_analyze_scale_factor = 0.005,
  autovacuum_vacuum_cost_limit   = 2000       -- cho chạy nhanh hơn
);
```

Bảng chỉ INSERT (log, `answers` lúc thi): PG13+ có `autovacuum_vacuum_insert_threshold` / `_scale_factor` để vacuum cả bảng chỉ insert (cần cho visibility map và freeze).

Cấu hình toàn cục điển hình cho server mạnh:

```ini
autovacuum_max_workers = 6            # mặc định 3; PG18 có thể đổi không cần restart (autovacuum_worker_slots)
autovacuum_naptime = 15s
autovacuum_vacuum_cost_limit = 2000   # mặc định 200 (khi -1) là rất chậm với SSD
autovacuum_vacuum_cost_delay = 2ms
log_autovacuum_min_duration = 1s      # ghi log để biết vacuum nào chậm
```

PG17: VACUUM dùng cấu trúc TidStore, tốn ít bộ nhớ hơn nhiều và không còn giới hạn 1 GB cho danh sách tuple chết.

**Sai lầm thường gặp:** tắt autovacuum "vì nó làm chậm" → vài tuần sau bloat và nguy cơ wraparound. Autovacuum chậm thì **tăng tốc nó**, không tắt.

## 7. Transaction ID wraparound – kẻ giết production

Transaction ID (XID) là số **32 bit** (~4,2 tỷ), so sánh theo vòng tròn: mỗi XID chỉ "nhìn thấy" ~2,1 tỷ XID trước nó là quá khứ. Nếu một tuple cũ hơn 2,1 tỷ transaction mà chưa được **freeze**, nó sẽ đột ngột trở thành "tương lai" → dữ liệu biến mất.

Để tránh, PostgreSQL **freeze** tuple cũ (đánh dấu "luôn nhìn thấy được"). Nếu freeze không theo kịp:

1. Vượt `autovacuum_freeze_max_age` (mặc định 200 triệu) → autovacuum **chống wraparound** chạy bắt buộc, không bị hủy, có thể rất nặng.
2. Còn ~40 triệu XID → log bắt đầu cảnh báo liên tục. Còn ~3 triệu (PG14+; bản cũ ~1 triệu) → **database từ chối mọi lệnh cấp XID mới** (tức là ngừng nhận ghi) cho tới khi VACUUM xong. Đây là sự cố downtime nhiều giờ đã xảy ra ở nhiều công ty lớn.

Theo dõi — **bắt buộc có cảnh báo**:

```sql
-- Mức database
SELECT datname, age(datfrozenxid) AS xid_age,
       round(100.0 * age(datfrozenxid) / 2000000000, 1) AS pct_to_wraparound
FROM pg_database ORDER BY 2 DESC;

-- Mức bảng
SELECT c.oid::regclass AS tbl, age(c.relfrozenxid) AS xid_age,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS size
FROM pg_class c WHERE c.relkind IN ('r','m','t')
ORDER BY age(c.relfrozenxid) DESC LIMIT 20;
```

Ngưỡng cảnh báo gợi ý: **warning ở 500 triệu, critical ở 1 tỷ**.

Nguyên nhân thường gặp khiến freeze không tiến triển:

| Nguyên nhân | Kiểm tra |
|---|---|
| Transaction mở rất lâu | `pg_stat_activity` (`xact_start`, `backend_xmin`) |
| Prepared transaction bị bỏ quên | `SELECT * FROM pg_prepared_xacts;` |
| Replication slot không dùng nữa giữ `xmin` | `SELECT slot_name, active, xmin, catalog_xmin FROM pg_replication_slots;` |
| Standby bật `hot_standby_feedback` và có query dài | `pg_stat_replication.backend_xmin` |
| Autovacuum quá chậm / bị hủy liên tục | log autovacuum |

Ngoài XID còn **MultiXact ID** (dùng khi nhiều transaction cùng khóa một dòng, ví dụ `SELECT … FOR SHARE`, FK) cũng có wraparound — theo dõi `mxid_age(datminmxid)`.

## 8. HOT update và fillfactor

Bình thường, UPDATE tạo tuple mới → **mọi index** của bảng phải thêm entry trỏ tới vị trí mới (tốn ghi, sinh bloat index).

**HOT (Heap-Only Tuple)**: nếu (a) không cột nào được index bị thay đổi **và** (b) tuple mới vừa trong **cùng trang** → không cần cập nhật index. Nhanh hơn rất nhiều.

Tăng tỉ lệ HOT:

- Không index các cột hay bị cập nhật (`updated_at`, `like_count`) nếu không thật cần.
- Để chừa chỗ trong trang: `ALTER TABLE posts SET (fillfactor = 85);` (chỉ áp dụng cho trang mới ghi; muốn áp dụng toàn bảng cần viết lại bằng `pg_repack`).

```sql
SELECT relname, n_tup_upd, n_tup_hot_upd,
       round(100.0 * n_tup_hot_upd / nullif(n_tup_upd, 0), 1) AS hot_pct
FROM pg_stat_user_tables ORDER BY n_tup_upd DESC LIMIT 10;
```

## 9. TOAST – giá trị lớn

Giá trị lớn hơn ~2 KB (`text`, `jsonb`, `bytea`) được nén và/hoặc tách ra bảng TOAST riêng.

- `SELECT *` trên `posts` kéo theo cả `body` (có thể vài trăm KB) → chậm, tốn mạng. **Chỉ chọn cột cần**; trang danh sách không cần `body`.
- Cập nhật một trường nhỏ trong `jsonb` lớn → viết lại toàn bộ giá trị.
- PG14+: nén `lz4` nhanh hơn `pglz`: `ALTER TABLE posts ALTER COLUMN body SET COMPRESSION lz4;` hoặc `default_toast_compression = lz4`.
- Không lưu file (ảnh, PDF bài nộp) trong DB → object storage, DB chỉ giữ khóa/metadata.

## 10. WAL và checkpoint

**WAL (Write-Ahead Log)**: mọi thay đổi được ghi vào WAL và `fsync` **trước** khi trả COMMIT. Trang dữ liệu thì ghi xuống đĩa sau. Khi crash, PostgreSQL phát lại WAL từ checkpoint cuối.

WAL cũng là nền của **replication** và **PITR** ([04](04-replication-ha.md), [05](05-backup-restore-dr.md)).

**Checkpoint**: ghi mọi trang bẩn xuống đĩa, đánh dấu điểm bắt đầu phát lại.

```ini
checkpoint_timeout = 15min           # mặc định 5min
max_wal_size = 16GB                  # mặc định 1GB — quá nhỏ cho hệ ghi nhiều
checkpoint_completion_target = 0.9   # dàn trải I/O
wal_compression = lz4                # PG15+
```

**Full-page writes**: lần đầu một trang bị sửa sau checkpoint, cả trang 8 KB được ghi vào WAL. Checkpoint càng dày → WAL càng lớn. Dấu hiệu checkpoint quá dày: log có `checkpoints are occurring too frequently`; PG17+ xem `pg_stat_checkpointer` (`num_requested` cao hơn nhiều `num_timed`).

Trade-off: checkpoint thưa → ít I/O hơn nhưng **phục hồi sau crash lâu hơn** (phải phát lại nhiều WAL hơn).

`synchronous_commit = off` cho phép trả COMMIT trước khi WAL được flush: nhanh hơn, có thể **mất vài trăm ms giao dịch cuối** khi crash (không hỏng dữ liệu). Có thể đặt theo transaction cho dữ liệu ít quan trọng (log xem bài), **không** cho nộp bài thi.

## 11. Planner và thống kê

Planner chọn kế hoạch có **chi phí ước lượng** thấp nhất, dựa trên thống kê trong `pg_statistic` (xem qua `pg_stats`): tỉ lệ null, số giá trị khác nhau (`n_distinct`), giá trị phổ biến nhất (MCV), histogram.

- Thống kê được cập nhật bởi `ANALYZE` (autovacuum tự chạy).
- **Sau khi nạp dữ liệu lớn hoặc sau `pg_upgrade`**: chạy `ANALYZE` thủ công, nếu không planner dùng thống kê cũ → kế hoạch tệ. (PG18 giữ được thống kê qua `pg_upgrade`.)
- Planner giả định các cột **độc lập** → sai với cột tương quan (ví dụ `country` và `city`). Giải pháp: extended statistics ([02](02-index-query-tuning.md)).

## 12. Câu chuyện sự cố mẫu

**"DB ngừng nhận ghi lúc 2 giờ sáng"** — log: `database is not accepting commands to avoid wraparound data loss`. Nguyên nhân: một replication slot logical tạo cho thử nghiệm CDC 3 tháng trước, consumer đã tắt. Slot giữ `catalog_xmin` → autovacuum không freeze được → XID age tăng dần tới giới hạn. Đồng thời slot giữ WAL làm đầy 70% đĩa.
**Bài học:** cảnh báo `age(datfrozenxid)`, cảnh báo slot `active = false`, đặt `max_slot_wal_keep_size`, xóa slot khi ngừng dùng.

**"Bảng posts 8 GB thành 90 GB"** — một job báo cáo mở transaction `REPEATABLE READ` chạy 10 tiếng mỗi đêm. Mỗi đêm VACUUM không dọn được gì.
**Bài học:** báo cáo chạy trên replica, `idle_in_transaction_session_timeout`, giám sát transaction dài.

## 13. Lỗi agent hay mắc

| Lỗi | Vì sao sai |
|---|---|
| Đề xuất `VACUUM FULL` để "dọn bảng" trên production | Khóa toàn bảng hàng giờ |
| Đặt `shared_buffers` = 75% RAM | Double buffering, thiếu RAM cho OS và `work_mem` |
| Đặt `work_mem = 1GB` toàn cục | Nhân theo số node × số kết nối → OOM killer giết postmaster |
| Tắt autovacuum để tăng tốc nạp dữ liệu rồi quên bật lại | Bloat + wraparound |
| `fsync = off` "cho nhanh" | Crash = hỏng dữ liệu, không phục hồi được |
| Tăng `max_connections` lên 5000 thay vì dùng pooler | Hiệu năng giảm, RAM cạn |
| Không chạy `ANALYZE` sau khi nạp/migrate lớn | Kế hoạch truy vấn tệ |

## Checklist review

- [ ] Có PgBouncer/pooler; `max_connections` hợp lý (vài trăm), không nghìn.
- [ ] `shared_buffers` ~25% RAM, `effective_cache_size` ~50–75%, `work_mem` mặc định thấp.
- [ ] Autovacuum bật, đã tăng `cost_limit`/workers; bảng lớn, ghi nhiều có cấu hình riêng theo bảng.
- [ ] Có cảnh báo `age(datfrozenxid)` và `mxid_age(datminmxid)`.
- [ ] Có cảnh báo transaction dài, slot không active, prepared transaction tồn đọng.
- [ ] Cột hay cập nhật không bị index vô cớ; xem xét `fillfactor` cho bảng UPDATE nhiều.
- [ ] Truy vấn không `SELECT *` trên bảng có cột lớn (TOAST).
- [ ] `max_wal_size`/`checkpoint_timeout` phù hợp tải ghi; không có cảnh báo checkpoint quá dày.
- [ ] `fsync`, `full_page_writes` luôn bật; `synchronous_commit = off` chỉ dùng có chủ đích, theo transaction.
- [ ] Không đề xuất `VACUUM FULL`/`CLUSTER` trên bảng lớn production — dùng `pg_repack`.
