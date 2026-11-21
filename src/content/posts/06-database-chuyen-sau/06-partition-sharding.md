---
title: "Partitioning và Sharding"
description: "biết khi nào chia bảng (partitioning) trong một máy PostgreSQL là đủ, khi nào phải chia dữ liệu ra nhiều máy (sharding), và làm sao làm điều đó mà không phá ứng dụng."
pubDatetime: 2026-11-18T13:00:00Z
featured: false
tags:
  - database
  - data-engineering
---
# Partitioning và Sharding

**Mục đích:** biết khi nào chia bảng (partitioning) trong một máy PostgreSQL là đủ, khi nào phải chia dữ liệu ra nhiều máy (sharding), và làm sao làm điều đó mà không phá ứng dụng.
**Liên quan:** [01-postgres-internals.md](01-postgres-internals.md) · [02-index-query-tuning.md](02-index-query-tuning.md) · [04-replication-ha.md](04-replication-ha.md) · [08-migration-schema-evolution.md](08-migration-schema-evolution.md) · [10-chon-database-nosql-search.md](10-chon-database-nosql-search.md) · [12-checklist-review-database.md](12-checklist-review-database.md) · Cơ bản: [../05-backend-senior/07-thiet-ke-database.md](../05-backend-senior/07-thiet-ke-database.md) · Scale tổng thể: [../05-backend-senior/09-scale-trieu-user.md](../05-backend-senior/09-scale-trieu-user.md)

---

## 1. Phân biệt ba khái niệm

| Khái niệm | Dữ liệu nằm ở | Giải quyết | Không giải quyết |
|---|---|---|---|
| **Partitioning** (khai báo trong PG) | Một instance, nhiều bảng con | Bảng quá lớn để vacuum/index/xóa dữ liệu cũ; truy vấn theo khoảng thời gian | Giới hạn CPU/RAM/IOPS/ghi của một máy |
| **Read replica** | Nhiều máy, mỗi máy **đủ** dữ liệu | Tải đọc | Tải ghi, dung lượng một máy |
| **Sharding** | Nhiều máy, mỗi máy **một phần** dữ liệu | Tải ghi, dung lượng, tách nhiễu giữa khách hàng | Đơn giản (thêm rất nhiều độ phức tạp) |

Thứ tự hợp lý: **index + tuning → partitioning → replica cho đọc → máy lớn hơn (scale up) → sharding**. Một máy PostgreSQL hiện đại (64 vCPU, 512 GB RAM, NVMe) xử lý được hàng chục nghìn giao dịch ghi/giây và vài TB dữ liệu nóng. Phần lớn hệ thống không bao giờ cần sharding.

## 2. Declarative partitioning trong PostgreSQL

### 2.1 Ba kiểu

| Kiểu | Khi dùng | Ví dụ LearnHub |
|---|---|---|
| `RANGE` | Dữ liệu theo thời gian, xóa theo thời gian | `answers` theo tháng, `audit_log` theo ngày |
| `LIST` | Giá trị rời rạc, ít | `posts` theo `region` (vn, jp) nếu có yêu cầu lưu trữ theo vùng |
| `HASH` | Chia đều, không có trục thời gian, mục tiêu là giảm kích thước từng bảng con/vacuum | `sessions` theo `user_id` (ít dùng — xem 2.5) |

### 2.2 Ví dụ: bảng `answers` theo tháng

```sql
CREATE TABLE answers (
    id           uuid        NOT NULL,           -- UUIDv7, sinh ở app
    attempt_id   uuid        NOT NULL,
    user_id      bigint      NOT NULL,
    question_id  bigint      NOT NULL,
    payload      jsonb       NOT NULL,
    version      int         NOT NULL DEFAULT 1,
    created_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)                  -- PK BẮT BUỘC chứa khóa partition
) PARTITION BY RANGE (created_at);

CREATE TABLE answers_2026_11 PARTITION OF answers
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE answers_2026_12 PARTITION OF answers
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE answers_default PARTITION OF answers DEFAULT;  -- lưới an toàn, phải giám sát = rỗng

-- Index khai báo trên bảng cha sẽ tự tạo trên mọi partition
CREATE INDEX ON answers (attempt_id, question_id);
```

Cận dưới **bao gồm**, cận trên **không bao gồm** (`FROM` ≤ x < `TO`).

### 2.3 Partition pruning – lý do chính để partition

Planner bỏ qua các partition không thể chứa dữ liệu thỏa điều kiện:

```sql
EXPLAIN SELECT * FROM answers
WHERE created_at >= '2026-11-10' AND created_at < '2026-11-11' AND attempt_id = $1;
-- Chỉ quét answers_2026_11
```

Pruning **không** xảy ra nếu:
- Truy vấn không có điều kiện trên khóa partition (`WHERE attempt_id = $1` thuần → quét index ở **mọi** partition).
- Bọc khóa trong hàm: `WHERE date_trunc('day', created_at) = ...`.
- Kiểu dữ liệu so sánh không khớp gây cast.

Pruning lúc chạy (runtime pruning) có với tham số prepared statement và join lồng nhau (từ PG11).

> **Hệ quả thiết kế:** chọn khóa partition là cột **xuất hiện trong gần như mọi truy vấn nóng**. Nếu truy vấn chính của `answers` là "theo `attempt_id`", hãy đảm bảo app biết khoảng thời gian của attempt (lưu `started_at` trong `exam_attempts`) và luôn truyền `created_at BETWEEN started_at AND deadline`.

### 2.4 Giới hạn phải biết

| Giới hạn | Hệ quả |
|---|---|
| PRIMARY KEY / UNIQUE phải chứa toàn bộ cột khóa partition | Không thể có `UNIQUE (attempt_id, question_id)` toàn cục nếu partition theo `created_at`. Giải pháp: đảm bảo duy nhất ở tầng khác (bảng con không partition, hoặc upsert theo khóa chứa `created_at` cố định của attempt) |
| Foreign key **tới** bảng partition được hỗ trợ từ PG12; FK **từ** bảng partition từ PG11 | Được, nhưng FK tới bảng partition rất lớn làm chậm DELETE/UPDATE bên cha |
| Không có index toàn cục | Tra cứu không có khóa partition = N lần quét index |
| Quá nhiều partition (hàng nghìn) | Planning chậm, tốn bộ nhớ, lock nhiều. Giữ ở mức hàng chục–vài trăm partition được truy cập |
| `UPDATE` đổi khóa partition | Được (chuyển hàng giữa partition, PG11+) nhưng là DELETE + INSERT, tốn kém |
| Partition DEFAULT | Khi tạo partition mới, PG phải quét DEFAULT để chắc không có hàng trùng khoảng → khóa. Giữ DEFAULT rỗng |

### 2.5 Chọn kích thước partition

- Mục tiêu: mỗi partition đủ nhỏ để `VACUUM`, tạo index, `pg_repack` trong vài phút–vài chục phút; tổng số partition không quá vài trăm.
- LearnHub: `answers` ~ 5 triệu user × 20 câu/tuần ≈ 100 triệu hàng/tuần → ~430 triệu/tháng (~150–250 GB/tháng kể cả index). Partition **theo tháng** hợp lý; nếu tăng gấp 5 lần, chuyển sang **theo tuần**.
- HASH partition hiếm khi đáng: không có lợi ích xóa dữ liệu cũ, pruning chỉ khi truy vấn có điều kiện `=` trên khóa. Dùng khi một bảng đơn quá to cho vacuum mà không có trục thời gian.

### 2.6 Tự động hóa: pg_partman

```sql
CREATE EXTENSION pg_partman SCHEMA partman;
SELECT partman.create_parent(
    p_parent_table => 'public.answers',
    p_control      => 'created_at',
    p_interval     => '1 month',
    p_premake      => 3                       -- tạo trước 3 tháng
);
UPDATE partman.part_config
   SET retention = '24 months', retention_keep_table = true
 WHERE parent_table = 'public.answers';
-- Chạy định kỳ (pg_cron hoặc background worker của pg_partman):
CALL partman.run_maintenance_proc();
```

Lưu ý: cú pháp `create_parent` khác giữa pg_partman 4.x và 5.x (5.x bỏ `p_type`). Kiểm tra phiên bản extension trước khi để agent viết script.

**Sự cố hay gặp:** job tạo partition chết âm thầm → đầu tháng mọi INSERT rơi vào DEFAULT (hoặc lỗi nếu không có DEFAULT). Cảnh báo khi: số partition tương lai < 2, hoặc DEFAULT có hàng.

### 2.7 Xóa dữ liệu cũ bằng DETACH thay vì DELETE

```sql
-- DELETE 400 triệu hàng: hàng giờ, WAL khổng lồ, bloat, replica trễ
-- DETACH: tức thì (metadata)
ALTER TABLE answers DETACH PARTITION answers_2024_11 CONCURRENTLY;  -- PG14+, không khóa bảng cha mạnh
-- Lưu trữ rồi xóa
-- pg_dump -t answers_2024_11 ... > archive; sau đó:
DROP TABLE answers_2024_11;
```

`DETACH ... CONCURRENTLY` không chạy được trong transaction block và không dùng được khi có partition DEFAULT.

### 2.8 Chuyển bảng lớn đang chạy sang partition

Không có lệnh "biến bảng thường thành bảng partition". Các cách:

1. **Gắn bảng cũ làm một partition:** tạo bảng cha mới, `ALTER TABLE answers_legacy ADD CONSTRAINT ... CHECK (created_at < '2026-12-01') NOT VALID; VALIDATE CONSTRAINT`, rồi `ATTACH PARTITION` (CHECK hợp lệ giúp ATTACH không phải quét lại). Đổi tên trong một transaction ngắn. Dữ liệu mới vào partition mới. Ít rủi ro nhất.
2. **Ghi kép + backfill** theo lô (xem [08-migration-schema-evolution.md](08-migration-schema-evolution.md)).
3. **Logical replication** sang bảng partition trên cùng/khác máy rồi chuyển đổi.

## 3. Khi partitioning không đủ → sharding

### 3.1 Tín hiệu cần sharding (phải có số liệu, không phải cảm giác)

- Ghi vượt khả năng một primary đã tối ưu (WAL rate, CPU > 70% kéo dài sau tuning).
- Dữ liệu nóng vượt RAM máy lớn nhất hợp lý, cache hit giảm và IOPS bão hòa.
- Thời gian khôi phục (restore) toàn DB vượt RTO cam kết.
- Yêu cầu cách ly theo khách hàng/vùng (data residency).

Trước đó, hãy thử: tách DB theo **chức năng** (DB cho exam riêng, DB cho social riêng — "vertical partitioning"), đẩy dữ liệu phân tích sang OLAP, đẩy log/sự kiện ra khỏi OLTP. Đây thường là bước rẻ nhất.

### 3.2 Chọn shard key – quyết định khó đảo ngược nhất

| Tiêu chí | Giải thích |
|---|---|
| Có mặt trong hầu hết truy vấn | Để định tuyến tới **một** shard |
| Phân phối đều | Tránh shard nóng |
| Gom dữ liệu hay đi cùng nhau | Join và transaction nằm trong một shard |
| Ổn định | Đổi shard key của một hàng = di chuyển dữ liệu |

LearnHub:

| Ứng viên | Ưu | Nhược |
|---|---|---|
| `user_id` | Bài làm, phiên, hồ sơ của một user nằm cùng shard | Truy vấn "mọi bài làm của đề thi X" (giáo viên xem) phải quét mọi shard |
| `exam_id` | Chấm và thống kê theo đề thi trên một shard | Đề thi toàn quốc 200k người → một shard nóng |
| `tenant_id` (trường/tổ chức) | Cách ly khách hàng, B2B rõ ràng | Tenant lớn chênh lệch với tenant nhỏ |

Lựa chọn: **`user_id`** cho dữ liệu cá nhân (attempts, answers, sessions); dữ liệu theo đề thi cho giáo viên được **sao chép bất đồng bộ** sang kho đọc (OLAP hoặc bảng tổng hợp) thay vì truy vấn chéo shard. Với B2B nhiều tenant, `tenant_id` thường thắng.

### 3.3 Các cách triển khai

| Cách | Mô tả | Khi chọn |
|---|---|---|
| **App-level sharding** | App tính shard từ key, giữ nhiều connection pool | Kiểm soát hoàn toàn; đội có năng lực; truy vấn đơn giản theo key |
| **Citus** (extension PG) | Bảng phân tán + bảng tham chiếu, coordinator định tuyến, hỗ trợ join co-located | Muốn giữ SQL/PG, tenant-based hoặc phân tích thời gian thực |
| **Proxy** (Vitess cho MySQL, PgDog/pgcat-sharding cho PG) | Proxy định tuyến | Hệ sinh thái MySQL (Vitess rất trưởng thành) |
| **DB phân tán sẵn** (CockroachDB, YugabyteDB, Spanner) | Tự sharding và giao dịch phân tán | Cần multi-region ghi, chấp nhận trễ cao hơn, chi phí và tương thích khác PG |

### 3.4 Định tuyến: đừng dùng `hash % N`

`shard = hash(user_id) % 4` → thêm shard thứ 5 làm ~80% key đổi chỗ. Thay bằng:

- **Logical shards nhiều hơn physical:** 1024 shard logic, ánh xạ vào 4 máy qua bảng ánh xạ. Mở rộng = chuyển nguyên shard logic sang máy mới.
- **Directory (lookup table):** `user_id → shard` lưu trong bảng/Redis; linh hoạt nhất (chuyển từng tenant), nhưng là điểm phụ thuộc phải cache và HA.
- **Consistent hashing:** phổ biến ở cache/KV; với DB, logical shards dễ vận hành hơn.

```ts
const LOGICAL_SHARDS = 1024;
function logicalShard(userId: bigint): number {
  return Number(murmur3_64(userId) % BigInt(LOGICAL_SHARDS)); // hash ổn định, KHÔNG dùng hash của runtime
}
const shardMap: Record<number, string> = await loadShardMap(); // logical → tên cluster
function poolFor(userId: bigint) { return pools[shardMap[logicalShard(userId)]]; }
```

### 3.5 Truy vấn và giao dịch chéo shard

| Nhu cầu | Cách xử lý |
|---|---|
| Đọc tổng hợp toàn hệ thống | Scatter-gather (gửi tới mọi shard, gộp) — chỉ cho truy vấn hiếm; tốt hơn: đồng bộ sang OLAP |
| Tìm theo thuộc tính không phải shard key (email → user) | Bảng chỉ mục toàn cục (global index) `email → user_id` trên DB riêng, cập nhật cùng transaction ở shard chứa user hoặc qua outbox |
| Giao dịch nhiều user ở nhiều shard | Tránh bằng thiết kế. Nếu bắt buộc: saga + idempotency ([../05-backend-senior/10-messaging-kafka.md](../05-backend-senior/10-messaging-kafka.md)). 2PC (`PREPARE TRANSACTION`) có nhưng vận hành rủi ro (giao dịch treo giữ lock, chặn vacuum) |
| Dữ liệu tham chiếu nhỏ (danh mục môn học) | Nhân bản tới mọi shard (Citus: reference table) |

### 3.6 ID toàn cục

| Loại | Ưu | Nhược |
|---|---|---|
| `bigserial` mỗi shard | Gọn | Trùng giữa shard → không dùng làm ID toàn cục |
| UUIDv4 | Không cần điều phối | Ngẫu nhiên → chèn index B-tree rải rác, cache kém |
| **UUIDv7** | Theo thời gian, chèn gần cuối index, không cần điều phối | 16 byte; lộ thời điểm tạo. Hàm `uuidv7()` có sẵn từ **PG18**; PG16–17 sinh ở app hoặc extension |
| Snowflake (64-bit: thời gian + máy + chuỗi) | 8 byte, có thứ tự | Phải cấp phát machine ID duy nhất, phụ thuộc đồng hồ |

Có thể nhúng shard logic vào ID (ví dụ Instagram: 41 bit thời gian + 13 bit shard + 10 bit sequence) để định tuyến chỉ từ ID.

### 3.7 Resharding (chia lại)

Quy trình chuyển shard logic `L` từ máy A sang máy B, không downtime:

1. Sao chép dữ liệu `L` sang B (logical replication với bộ lọc hàng — PG15+ hỗ trợ `WHERE` trong publication — hoặc công cụ của Citus `citus_move_shard_placement`).
2. Theo dõi trễ bắt kịp gần 0.
3. Chặn ghi cho `L` trong vài giây (cờ trong shard map → app trả 503/retry cho key thuộc `L`).
4. Chờ trễ = 0, cập nhật shard map `L → B`, mở ghi.
5. Xóa dữ liệu `L` khỏi A sau thời gian quan sát.

Diễn tập resharding trên staging trước khi cần — đừng học nó lúc đang cháy.

### 3.8 Shard nóng

- Nguyên nhân: key lệch (tenant khổng lồ, một user bot), shard key theo thời gian (mọi ghi vào shard "hiện tại").
- Phát hiện: metric QPS/CPU theo shard, top key theo shard.
- Xử lý: tách tenant lớn ra shard riêng (directory giúp việc này), thêm salt cho key cực nóng (đổi lại phải đọc nhiều chỗ), cache phía đọc.

## 4. Ví dụ LearnHub theo từng giai đoạn

| Giai đoạn | Tình trạng | Hành động |
|---|---|---|
| 0–1 triệu user | 1 primary + 1 replica | Index đúng, PgBouncer, `answers` chưa partition |
| 1–5 triệu | `answers` 2 tỷ hàng, xóa dữ liệu > 2 năm mất cả đêm | Partition `answers` theo tháng bằng cách gắn bảng cũ làm partition; pg_partman; retention bằng DETACH |
| 5–20 triệu | Primary ghi bão hòa giờ thi | Tách DB `exam` khỏi DB `social`; replica cho đọc; scale up |
| > 20 triệu hoặc đa quốc gia | Vẫn bão hòa / yêu cầu lưu trữ theo vùng | Shard `exam` theo `user_id` với 1024 shard logic trên 4 cluster; `answers` vẫn partition theo tháng trong từng shard |

## 5. Sai lầm hay gặp (kể cả của agent)

- Partition bảng 5 triệu hàng "cho nhanh" → chậm hơn (planning, nhiều index nhỏ) và mất UNIQUE toàn cục.
- Khóa partition không có trong truy vấn → mọi truy vấn quét tất cả partition.
- Agent viết `CREATE UNIQUE INDEX ON answers (attempt_id, question_id)` trên bảng partition theo `created_at` → lỗi; hoặc tệ hơn, "sửa" bằng cách bỏ ràng buộc duy nhất.
- Không tạo trước partition, không giám sát DEFAULT.
- Dùng `DELETE` để dọn dữ liệu cũ trên bảng đã partition.
- `hash % N` với số shard cố định.
- Dùng `hashCode()`/hash mặc định của ngôn ngữ (không ổn định giữa phiên bản/tiến trình) để định tuyến shard.
- Sharding sớm khi chưa đo, đánh mất transaction và join.
- Shard theo thời gian → toàn bộ ghi vào một shard.

## Checklist review

- [ ] Có số liệu chứng minh cần partition/sharding (kích thước bảng, thời gian vacuum, tải ghi), không phải "phòng xa".
- [ ] Khóa partition xuất hiện trong các truy vấn nóng; đã xem `EXPLAIN` thấy pruning.
- [ ] PK/UNIQUE chứa khóa partition; đã có cách khác cho tính duy nhất cần thiết.
- [ ] Có cơ chế tạo trước partition (pg_partman/pg_cron) và cảnh báo khi thiếu partition tương lai hoặc DEFAULT có dữ liệu.
- [ ] Retention dùng `DETACH ... CONCURRENTLY` + archive + `DROP`, không `DELETE` hàng loạt.
- [ ] Số partition hợp lý (không hàng nghìn partition được truy cập).
- [ ] Shard key: có mặt trong truy vấn, phân phối đều, gom dữ liệu liên quan; đã phân tích tenant/user lớn.
- [ ] Định tuyến dùng shard logic hoặc directory, hash ổn định; không `% N` trên số máy.
- [ ] ID toàn cục không trùng giữa shard (UUIDv7/Snowflake).
- [ ] Có phương án cho truy vấn chéo shard (OLAP/global index) và không dựa vào giao dịch phân tán thường xuyên.
- [ ] Có runbook resharding đã diễn tập.
