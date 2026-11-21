---
title: "Cấu hình, vận hành và giám sát PostgreSQL"
description: "cấu hình PostgreSQL cho máy chủ thật, quản lý kết nối, biết theo dõi chỉ số nào với ngưỡng cảnh báo nào, và các việc DBA phải làm định kỳ."
pubDatetime: 2026-11-18T12:00:00Z
featured: false
tags:
  - database
  - data-engineering
  - observability
---
# Cấu hình, vận hành và giám sát PostgreSQL

**Mục đích:** cấu hình PostgreSQL cho máy chủ thật, quản lý kết nối, biết theo dõi chỉ số nào với ngưỡng cảnh báo nào, và các việc DBA phải làm định kỳ.
**Liên quan:** [01-postgres-internals.md](01-postgres-internals.md) · [02-index-query-tuning.md](02-index-query-tuning.md) · [03-transaction-lock-concurrency.md](03-transaction-lock-concurrency.md) · [04-replication-ha.md](04-replication-ha.md) · [05-backup-restore-dr.md](05-backup-restore-dr.md) · [11-bao-mat-database.md](11-bao-mat-database.md) · [12-checklist-review-database.md](12-checklist-review-database.md) · Server: [../07-he-thong-server/](../07-he-thong-server/) · Quan sát chung: [../05-backend-senior/12-observability-reliability.md](../05-backend-senior/12-observability-reliability.md)

---

## 1. Nguyên tắc

- Mặc định của PostgreSQL được đặt cho máy rất nhỏ (`shared_buffers = 128MB`). Phải chỉnh cho production.
- **Chỉnh có lý do, đo trước và sau.** Mỗi thay đổi ghi lại: tham số, giá trị cũ/mới, lý do, chỉ số kỳ vọng.
- Phân biệt tham số cần **restart** (`shared_buffers`, `max_connections`, `huge_pages`, `shared_preload_libraries`) và tham số chỉ cần **reload** (`SELECT pg_reload_conf();`). Xem cột `context` trong `pg_settings`:

```sql
SELECT name, setting, unit, context, pending_restart FROM pg_settings
WHERE name IN ('shared_buffers','work_mem','max_connections');
```

- Dùng `ALTER SYSTEM SET ...` (ghi vào `postgresql.auto.conf`) hoặc quản lý file cấu hình bằng công cụ hạ tầng (Ansible/Terraform/Patroni). Đừng trộn lẫn hai cách — dễ bị ghi đè không biết.
- Dịch vụ managed (RDS, Cloud SQL, Azure) đổi qua parameter group; một số tham số bị khóa.

## 2. Định cỡ cấu hình – ví dụ máy LearnHub primary

Máy: 32 vCPU, 128 GB RAM, NVMe SSD, Linux, chỉ chạy PostgreSQL.

| Tham số | Giá trị | Lý do |
|---|---|---|
| `shared_buffers` | `32GB` (~25% RAM) | Bộ đệm của PG; phần còn lại để OS page cache (PG đọc qua OS). >40% hiếm khi có lợi |
| `effective_cache_size` | `96GB` (~75% RAM) | Chỉ là **gợi ý** cho planner về tổng cache (PG + OS); không cấp phát bộ nhớ |
| `work_mem` | `32MB` | Bộ nhớ cho **mỗi** thao tác sort/hash **mỗi** node trong plan, mỗi kết nối. Xem công thức dưới |
| `hash_mem_multiplier` | `2.0` (mặc định PG15+) | Hash join/aggregate được dùng `work_mem × hệ số` |
| `maintenance_work_mem` | `2GB` | VACUUM, CREATE INDEX, ALTER ... ADD FK. Lớn giúp tạo index nhanh |
| `autovacuum_work_mem` | `1GB` | Mỗi worker autovacuum (mặc định = maintenance_work_mem → nhân với số worker!) |
| `max_connections` | `300` | Thấp; kết nối thật đi qua PgBouncer (mục 3) |
| `wal_buffers` | `-1` (tự động, ~16MB) | Đủ cho hầu hết |
| `max_wal_size` | `16GB` | Tăng để checkpoint không bị kích hoạt do WAL quá thường xuyên |
| `min_wal_size` | `2GB` | |
| `checkpoint_timeout` | `15min` | Checkpoint thưa hơn → ít full-page write; đổi lại recovery sau crash lâu hơn |
| `checkpoint_completion_target` | `0.9` (mặc định PG14+) | Rải ghi checkpoint đều |
| `random_page_cost` | `1.1` | SSD/NVMe: đọc ngẫu nhiên gần bằng tuần tự. Giá trị mặc định 4.0 dành cho HDD khiến planner né index |
| `effective_io_concurrency` | `200` | SSD; ảnh hưởng bitmap heap scan (và từ PG18 là I/O bất đồng bộ cùng `io_method`) |
| `max_worker_processes` | `32` | |
| `max_parallel_workers` | `16` | Tổng worker song song |
| `max_parallel_workers_per_gather` | `2`–`4` | OLTP: thấp để không một truy vấn chiếm hết CPU |
| `default_statistics_target` | `100` (mặc định); tăng theo cột cụ thể | `ALTER TABLE ... ALTER COLUMN ... SET STATISTICS 500` cho cột phân phối lệch |
| `jit` | `off` cho OLTP | JIT tốn thời gian biên dịch với truy vấn ngắn; bật cho phân tích |

### 2.1 Bài toán work_mem

Rủi ro: `work_mem` là **trần cho mỗi node**, không phải mỗi kết nối. Một truy vấn có 3 sort + 2 hash join, chạy song song 2 worker, có thể dùng `(3 + 2×2) × 3 tiến trình × work_mem`.

Ước lượng an toàn:

```
RAM khả dụng cho truy vấn ≈ RAM − shared_buffers − OS/cache tối thiểu
                          ≈ 128 − 32 − 32 = 64 GB
Số kết nối thực sự chạy đồng thời (active) ≈ 60 (sau PgBouncer)
Giả định mỗi truy vấn dùng ~3 node bộ nhớ
work_mem ≈ 64 GB / (60 × 3) ≈ 350 MB  → chọn 32–64MB toàn cục cho an toàn,
                                          tăng riêng cho job báo cáo:
SET LOCAL work_mem = '512MB';   -- trong transaction của job
ALTER ROLE reporting SET work_mem = '256MB';
```

Dấu hiệu `work_mem` nhỏ: `EXPLAIN (ANALYZE, BUFFERS)` có `Sort Method: external merge Disk: ...`; `log_temp_files = 0` ghi log file tạm. Dấu hiệu quá lớn: OOM killer giết tiến trình postgres → **toàn bộ server restart** (postmaster khởi động lại mọi backend).

### 2.2 Autovacuum cho bảng lớn

Mặc định: vacuum khi 20% hàng "chết" (`autovacuum_vacuum_scale_factor = 0.2`). Với bảng 1 tỷ hàng = 200 triệu hàng chết mới vacuum → bloat lớn, vacuum chạy hàng giờ.

```ini
autovacuum_max_workers = 6               # mặc định 3; PG18 có thể đổi không cần restart tới autovacuum_worker_slots
autovacuum_naptime = 15s
autovacuum_vacuum_cost_limit = 2000      # mặc định 200 (-1 → vacuum_cost_limit) quá chậm cho SSD
autovacuum_vacuum_cost_delay = 2ms       # mặc định PG12+
log_autovacuum_min_duration = 10s
```

Theo bảng (bảng nóng như `sessions`, `answers` partition hiện tại):

```sql
ALTER TABLE sessions SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_vacuum_threshold = 10000,
  autovacuum_analyze_scale_factor = 0.02
);
-- Bảng chủ yếu INSERT (PG13+): vacuum để cập nhật visibility map cho index-only scan
ALTER TABLE answers SET (autovacuum_vacuum_insert_scale_factor = 0.05);
```

Không bao giờ tắt autovacuum toàn cục. Xem [01-postgres-internals.md](01-postgres-internals.md) về MVCC, bloat và transaction ID wraparound.

## 3. Kết nối: vì sao nhiều kết nối là có hại

Mỗi kết nối PostgreSQL = **một tiến trình hệ điều hành** (~5–10 MB RAM nền, nhiều hơn khi có cache catalog), cộng chi phí:
- Snapshot: mỗi truy vấn phải duyệt danh sách giao dịch đang chạy (đã tối ưu nhiều từ PG14 nhưng vẫn tăng theo số kết nối).
- Tranh chấp lock nội bộ (LWLock), context switch khi active > số lõi CPU.
- Thông lượng đạt đỉnh khi số kết nối **đang chạy** ≈ 2–4 × số lõi; sau đó giảm.

Kịch bản LearnHub: 40 pod app × pool 20 = 800 kết nối. Giờ thi tăng lên 120 pod → 2400 kết nối → PG từ chối (`too many clients`) hoặc chậm toàn bộ.

### 3.1 PgBouncer

```
App pods (hàng nghìn kết nối client) ──► PgBouncer (pool_mode=transaction) ──► PostgreSQL (~60–100 kết nối server)
```

| Mode | Kết nối server được trả về khi | Giữ được | Dùng khi |
|---|---|---|---|
| `session` | Client ngắt kết nối | Mọi tính năng | Ứng dụng cần trạng thái phiên; ít lợi ích pooling |
| `transaction` | Transaction kết thúc | Hầu hết | **Mặc định cho web/API** |
| `statement` | Mỗi câu lệnh | Rất ít (cấm transaction nhiều lệnh) | Hiếm |

Những gì **hỏng hoặc phải cẩn thận** ở `transaction` mode:

| Tính năng | Vấn đề | Cách xử lý |
|---|---|---|
| `SET search_path/timezone/...` (cấp phiên) | Lệnh SET rơi vào kết nối server khác | Dùng `SET LOCAL` trong transaction, hoặc đặt mặc định theo role/database |
| Prepared statements cấp protocol | Trước PgBouncer 1.21 lỗi "prepared statement does not exist" | PgBouncer ≥ 1.21 với `max_prepared_statements > 0`; hoặc tắt prepared ở driver |
| Advisory lock cấp phiên `pg_advisory_lock` | Lock gắn với kết nối server, client khác có thể "thừa hưởng" | Dùng `pg_advisory_xact_lock` (theo transaction) |
| `LISTEN/NOTIFY` | Không hoạt động | Kết nối riêng không qua pooler, hoặc pool session riêng |
| Temp table qua nhiều transaction | Biến mất / lẫn | Chỉ trong một transaction |
| `WITH HOLD` cursor | Không dùng được | Tránh |

Cấu hình mẫu (`pgbouncer.ini`):

```ini
[databases]
learnhub = host=10.0.1.10 port=5432 dbname=learnhub

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 10000
default_pool_size = 60          ; kết nối server cho mỗi cặp user/db
reserve_pool_size = 10
reserve_pool_timeout = 3
server_idle_timeout = 300
max_prepared_statements = 200   ; PgBouncer >= 1.21
query_wait_timeout = 30
```

PgBouncer đơn luồng: một tiến trình thường xử lý ~10–20k truy vấn/giây nhỏ; tải lớn hơn chạy nhiều tiến trình với `so_reuseport = 1` hoặc dùng PgCat/Odyssey/Supavisor.

### 3.2 Timeout bảo vệ DB

```sql
ALTER ROLE app_rw SET statement_timeout = '5s';                     -- API không được có truy vấn > 5s
ALTER ROLE app_rw SET idle_in_transaction_session_timeout = '30s';  -- giao dịch mở rồi quên
ALTER ROLE app_rw SET lock_timeout = '2s';
ALTER ROLE reporting SET statement_timeout = '10min';
-- PG17+: transaction_timeout cho tổng thời gian một transaction
```

## 4. Tinh chỉnh hệ điều hành (Linux)

| Mục | Khuyến nghị | Lý do |
|---|---|---|
| Huge pages | `huge_pages = try` (hoặc `on`) + cấu hình `vm.nr_hugepages` đủ cho `shared_buffers` | Giảm chi phí bảng trang với shared_buffers lớn |
| Transparent Huge Pages | `never` | Gây trễ không đều |
| `vm.swappiness` | `1`–`10` | Tránh swap bộ nhớ của PG |
| `vm.overcommit_memory` | `2` + `overcommit_ratio` hợp lý | OOM killer không chọn postmaster; với overcommit 2 phải tính kỹ |
| `vm.dirty_background_bytes` / `dirty_bytes` | Giá trị tuyệt đối nhỏ (ví dụ 64MB / 256MB) | Tránh dồn ghi lớn gây trễ đột biến |
| Filesystem | XFS hoặc ext4, mount `noatime` | Ổn định, đã kiểm chứng |
| Đĩa WAL | Có thể tách WAL sang đĩa riêng | Ghi tuần tự, không tranh IO với data |
| I/O scheduler | `none`/`mq-deadline` cho NVMe | |
| Giới hạn | `ulimit -n` cao, systemd `LimitNOFILE` | Nhiều file/partition |
| OOM | `oom_score_adj=-1000` cho postmaster | Theo hướng dẫn tài liệu PG |

Không chạy PostgreSQL production trên ổ mạng chậm hoặc chia sẻ IO với dịch vụ khác. Không bật `fsync = off` hoặc `full_page_writes = off` trên production — mất dữ liệu khi mất điện.

## 5. Giám sát: chỉ số và ngưỡng

### 5.1 Bảng chỉ số chính

| Nhóm | Chỉ số | Nguồn | Ngưỡng cảnh báo gợi ý |
|---|---|---|---|
| Sẵn sàng | DB trả lời `SELECT 1` | exporter | Lỗi 1 phút → page |
| Kết nối | `numbackends / max_connections` | `pg_stat_database`, `pg_stat_activity` | > 80% |
| Kết nối | Hàng chờ PgBouncer (`cl_waiting`, `maxwait`) | `SHOW POOLS` | `maxwait > 1s` |
| Giao dịch dài | Tuổi transaction lâu nhất | `pg_stat_activity.xact_start` | > 5 phút (OLTP) |
| Idle in transaction | Số phiên và thời gian | `pg_stat_activity.state` | > 1 phút |
| Lock | Phiên chờ lock | `pg_locks` + `pg_blocking_pids()` | > 10 phiên hoặc chờ > 30s |
| Thông lượng | TPS commit/rollback, tỷ lệ rollback | `pg_stat_database` | Rollback > 5% bất thường |
| Cache | Cache hit ratio | `blks_hit/(blks_hit+blks_read)` | < 99% cho OLTP (theo xu hướng, không tuyệt đối) |
| Truy vấn | p95/p99 thời gian, top truy vấn tổng thời gian | `pg_stat_statements` | Tăng > 2× baseline |
| Replication | Trễ (bytes và giây) | `pg_stat_replication`, `pg_last_xact_replay_timestamp()` | > 30s hoặc > 1GB |
| Replication slot | WAL giữ lại bởi slot | `pg_replication_slots` | Slot không active hoặc giữ > 50GB |
| Wraparound | `age(datfrozenxid)` | `pg_database` | > 1 tỷ cảnh báo, > 1.5 tỷ khẩn cấp (giới hạn ~2.1 tỷ) |
| Vacuum | Thời gian kể từ autovacuum cuối, `n_dead_tup` | `pg_stat_user_tables` | Bảng nóng không vacuum > 1 ngày |
| Bloat | Ước lượng bloat bảng/index | `pgstattuple` hoặc truy vấn ước lượng | > 30–50% với bảng lớn |
| Checkpoint | Checkpoint do yêu cầu (WAL đầy) vs theo giờ | `pg_stat_bgwriter` (≤PG16) / `pg_stat_checkpointer` (PG17+) | requested chiếm > 10% → tăng `max_wal_size` |
| Đĩa | % dùng, tốc độ tăng | node_exporter | > 75% cảnh báo, > 85% khẩn |
| WAL | Tốc độ sinh WAL | `pg_stat_wal` | Đột biến → tìm truy vấn ghi lớn |
| Temp files | Dung lượng file tạm | `pg_stat_database.temp_bytes` | Tăng đột biến → work_mem/truy vấn |
| Archiving | `failed_count` | `pg_stat_archiver` | > 0 → PITR có thể hỏng |

### 5.2 Truy vấn hữu ích

```sql
-- Phiên đang chạy lâu và ai chặn ai
SELECT pid, usename, state, now() - xact_start AS xact_age, wait_event_type, wait_event,
       pg_blocking_pids(pid) AS blocked_by, left(query, 120) AS query
FROM pg_stat_activity
WHERE state <> 'idle' AND xact_start IS NOT NULL
ORDER BY xact_age DESC LIMIT 20;

-- Top truy vấn theo tổng thời gian (cần shared_preload_libraries = 'pg_stat_statements')
SELECT queryid, calls, round(total_exec_time) AS total_ms, round(mean_exec_time,1) AS mean_ms,
       rows, left(query, 120)
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;

-- Nguy cơ wraparound
SELECT datname, age(datfrozenxid) FROM pg_database ORDER BY 2 DESC;

-- Slot replication giữ WAL
SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained
FROM pg_replication_slots;

-- Index không được dùng (xem xét xóa sau khi kiểm tra trên mọi replica)
SELECT schemaname, relname, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes WHERE idx_scan = 0 ORDER BY pg_relation_size(indexrelid) DESC;
```

Lưu ý: thống kê `pg_stat_*` là theo từng node; index "không dùng" trên primary có thể đang phục vụ truy vấn trên replica.

### 5.3 Công cụ

| Công cụ | Vai trò |
|---|---|
| `pg_stat_statements` | Bắt buộc. Thống kê truy vấn chuẩn hóa |
| `auto_explain` | Ghi plan của truy vấn chậm: `auto_explain.log_min_duration = '1s'`, `log_analyze = on` (tốn chi phí, cân nhắc `sample_rate`) |
| postgres_exporter + Prometheus + Grafana | Metric và cảnh báo |
| pgBadger | Phân tích log thành báo cáo |
| pgBouncer exporter | Metric pool |
| pganalyze / Datadog / CloudWatch Performance Insights | Lựa chọn thương mại/managed |

### 5.4 Cấu hình log

```ini
logging_collector = on
log_line_prefix = '%m [%p] %q%u@%d app=%a client=%h '
log_min_duration_statement = 500ms   # log truy vấn > 500ms (cẩn thận PII trong tham số)
log_lock_waits = on                  # log khi chờ lock > deadlock_timeout (1s)
log_temp_files = 0
log_checkpoints = on                 # mặc định on từ PG15
log_connections = on                 # cân nhắc khối lượng
log_disconnections = on
log_autovacuum_min_duration = 10s
log_statement = 'ddl'                # ghi mọi DDL — hữu ích để truy vết migration
```

Log có thể chứa dữ liệu nhạy cảm (giá trị tham số). Xem [11-bao-mat-database.md](11-bao-mat-database.md).

## 6. Việc DBA định kỳ

| Tần suất | Việc |
|---|---|
| Hằng ngày | Kiểm tra backup đêm qua thành công và archive WAL không lỗi; xem cảnh báo; top truy vấn chậm mới xuất hiện; dung lượng đĩa và tốc độ tăng; trễ replica; giao dịch dài/idle in transaction |
| Hằng tuần | Xem bảng/index bloat; index không dùng hoặc trùng; bảng thiếu vacuum/analyze; partition tương lai đã được tạo; slot replication không active |
| Hằng tháng | **Diễn tập restore** từ backup lên máy khác và kiểm tra dữ liệu; xem `age(datfrozenxid)`; dự báo dung lượng 3–6 tháng; rà soát role và quyền; cập nhật bản vá minor |
| Hằng quý | Diễn tập failover; rà soát cấu hình so với tải thực; kiểm tra chứng chỉ TLS sắp hết hạn; kế hoạch nâng cấp major |

## 7. Nâng cấp phiên bản

### 7.1 Minor (16.4 → 16.6)

- Chỉ sửa lỗi và bảo mật, cùng định dạng dữ liệu. Thay binary và restart.
- Với HA: nâng replica trước → switchover → nâng primary cũ. Downtime vài giây.
- **Đọc release notes**: đôi khi yêu cầu `REINDEX` một loại index sau khi sửa lỗi.
- Nên cập nhật mỗi quý (PG phát hành minor theo quý).

### 7.2 Major (16 → 17/18)

| Cách | Downtime | Ghi chú |
|---|---|---|
| `pg_dump`/`pg_restore` | Dài (giờ với DB lớn) | Đơn giản, DB nhỏ |
| `pg_upgrade --link` | Phút | Dùng hard link, nhanh; sau đó **phải** `ANALYZE` (thống kê planner không được chuyển trước PG18; PG18 giữ lại phần lớn thống kê). Không quay lại được sau khi khởi động cụm mới ở chế độ link → backup trước |
| Logical replication sang cụm mới | Giây (lúc chuyển) | Phức tạp hơn: không sao chép DDL, sequence, large object; phải đồng bộ sequence lúc chuyển. Cho phép kiểm thử cụm mới với tải thật trước |

Quy trình chung: dựng bản sao production → nâng cấp thử → chạy bộ test và các truy vấn hàng đầu của `pg_stat_statements` so sánh plan → kiểm tra extension có bản cho phiên bản mới → lên lịch → backup → nâng cấp → `ANALYZE` → theo dõi sát 48 giờ.

Vòng đời: mỗi major được hỗ trợ 5 năm. Đừng để chạy phiên bản hết hỗ trợ.

## 8. Sai lầm hay gặp (kể cả của agent)

- Đặt `work_mem = 1GB` toàn cục "cho nhanh" → OOM khi tải cao.
- `max_connections = 5000` thay vì dùng pooler.
- Giữ `random_page_cost = 4` trên SSD → planner chọn seq scan.
- Agent đề xuất `fsync = off` hoặc `synchronous_commit = off` để "tăng tốc" mà không nói rủi ro mất dữ liệu (riêng `synchronous_commit = off` chỉ mất vài trăm ms giao dịch cuối, không hỏng DB — có thể chấp nhận cho dữ liệu không quan trọng ở cấp transaction: `SET LOCAL synchronous_commit = off`).
- Tắt autovacuum vì "nó làm chậm" → bloat và wraparound.
- `SET` cấp phiên khi dùng PgBouncer transaction mode.
- Cảnh báo trên cache hit ratio tuyệt đối mà bỏ qua xu hướng; không có cảnh báo cho wraparound, slot replication, archive lỗi.
- Copy cấu hình "tối ưu" từ blog mà không biết RAM/CPU/tải thật.
- Nâng cấp major mà không chạy `ANALYZE` → mọi truy vấn chậm sau nâng cấp.

## Checklist review

- [ ] Mọi thay đổi cấu hình có lý do, giá trị cũ/mới, và cần restart hay reload.
- [ ] `work_mem` × số kết nối active × số node không vượt RAM khả dụng; tăng cục bộ thay vì toàn cục.
- [ ] `shared_buffers`, `effective_cache_size`, `random_page_cost` phù hợp phần cứng thật.
- [ ] Autovacuum bật; bảng nóng có cấu hình riêng; không tắt toàn cục.
- [ ] Ứng dụng đi qua pooler; code không dùng `SET` cấp phiên, advisory lock cấp phiên, `LISTEN` qua pooler transaction mode.
- [ ] Có `statement_timeout`, `idle_in_transaction_session_timeout`, `lock_timeout` theo role.
- [ ] Không tắt `fsync`/`full_page_writes`; mọi `synchronous_commit = off` được giải thích.
- [ ] Có cảnh báo cho: kết nối, giao dịch dài, trễ replica, slot, wraparound, đĩa, archive lỗi, backup lỗi.
- [ ] `pg_stat_statements` bật; log truy vấn chậm và lock wait bật.
- [ ] Kế hoạch nâng cấp có bước thử trên bản sao, `ANALYZE` sau nâng cấp, và backup trước.
