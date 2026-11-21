---
title: "Database chuyên sâu (mức DBA / senior) – mục lục"
description: "vận hành và tối ưu database production ở quy mô hàng triệu user. Phần này đi sâu hơn ../05-backend-senior/07-thiet-ke-database.md (thiết kế cơ bản) — đọc file đó trước."
pubDatetime: 2026-11-18T19:00:00Z
featured: true
tags:
  - database
  - data-engineering
---
# Database chuyên sâu (mức DBA / senior) – mục lục

**Mục đích:** vận hành và tối ưu database production ở quy mô hàng triệu user. Phần này đi sâu hơn [../05-backend-senior/07-thiet-ke-database.md](../05-backend-senior/07-thiet-ke-database.md) (thiết kế cơ bản) — đọc file đó trước.
**DB chính:** PostgreSQL 16–18; **phụ:** Redis. Ví dụ xuyên suốt: LearnHub.

## Mục lục

| # | File | Nội dung |
|---|---|---|
| 01 | [01-postgres-internals.md](01-postgres-internals.md) | MVCC, dead tuple, bloat, VACUUM/autovacuum, wraparound, HOT, TOAST, WAL, checkpoint |
| 02 | [02-index-query-tuning.md](02-index-query-tuning.md) | Đọc EXPLAIN ANALYZE, thống kê, các loại index, pg_stat_statements, viết lại truy vấn |
| 03 | [03-transaction-lock-concurrency.md](03-transaction-lock-concurrency.md) | Isolation trong Postgres, các loại lock, hàng đợi lock, deadlock, SKIP LOCKED, timeout |
| 04 | [04-replication-ha.md](04-replication-ha.md) | Streaming/logical replication, replication slot, lag, Patroni, failover, split-brain |
| 05 | [05-backup-restore-dr.md](05-backup-restore-dr.md) | pg_dump vs basebackup, pgBackRest, PITR, diễn tập restore, sự cố "DELETE không WHERE" |
| 06 | [06-partition-sharding.md](06-partition-sharding.md) | Partitioning, pruning, retention, sharding, chọn shard key, Citus |
| 07 | [07-cau-hinh-van-hanh-monitoring.md](07-cau-hinh-van-hanh-monitoring.md) | Cấu hình postgresql.conf, PgBouncer, giám sát và ngưỡng cảnh báo, việc DBA định kỳ, nâng cấp |
| 08 | [08-migration-schema-evolution.md](08-migration-schema-evolution.md) | Công cụ migration, expand/contract, DDL an toàn/nguy hiểm, backfill lớn |
| 09 | [09-redis-chuyen-sau.md](09-redis-chuyen-sau.md) | Cấu trúc dữ liệu, eviction, persistence, Sentinel vs Cluster, distributed lock, sự cố thường gặp |
| 10 | [10-chon-database-nosql-search.md](10-chon-database-nosql-search.md) | Chọn DB: Postgres/MySQL, MongoDB, Cassandra, DynamoDB, Elasticsearch, ClickHouse, pgvector |
| 11 | [11-bao-mat-database.md](11-bao-mat-database.md) | Role tối thiểu, pg_hba, TLS, RLS, mã hóa, xoay vòng mật khẩu, audit, che PII |
| 12 | [12-checklist-review-database.md](12-checklist-review-database.md) | ★ Checklist duyệt thay đổi database do agent đề xuất |

## Lộ trình đọc

- **Hiểu tại sao DB chậm/phình:** 01 → 02 → 07
- **Tránh sự cố khi nhiều người ghi cùng lúc:** 03
- **Không mất dữ liệu, không downtime:** 04 → 05 → 08
- **Khi dữ liệu quá lớn:** 06 → 10
- **Cache:** 09
- **Bảo mật:** 11
- **Khi duyệt:** 12

## 5 sự cố database kinh điển cần biết tên

| Sự cố | Nguyên nhân gốc | Đọc |
|---|---|---|
| DB ngừng nhận ghi vì transaction ID wraparound | Autovacuum không theo kịp / transaction mở quá lâu | 01 |
| Một lệnh `ALTER TABLE` làm sập cả hệ thống | Lệnh chờ lock ACCESS EXCLUSIVE chặn mọi truy vấn xếp sau | 03, 08 |
| Ổ đĩa primary đầy | Replication slot bị bỏ quên giữ WAL | 04 |
| "Có backup" nhưng không restore được | Chưa từng diễn tập restore | 05 |
| Hết kết nối DB khi tăng số pod | Mỗi pod mở pool riêng, không có PgBouncer | 07 |
