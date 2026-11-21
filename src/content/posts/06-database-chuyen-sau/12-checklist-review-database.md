---
title: "Checklist duyệt thay đổi database do agent đề xuất"
description: "duyệt migration, truy vấn mới, thay đổi cấu hình và vận hành database trước khi chạy trên production."
pubDatetime: 2026-11-18T07:00:00Z
featured: false
tags:
  - database
  - data-engineering
  - checklist
---
# Checklist duyệt thay đổi database do agent đề xuất

**Mục đích:** duyệt migration, truy vấn mới, thay đổi cấu hình và vận hành database trước khi chạy trên production.
**Liên quan:** [00-README.md](00-README.md) · [03-transaction-lock-concurrency.md](03-transaction-lock-concurrency.md) · [05-backup-restore-dr.md](05-backup-restore-dr.md) · [08-migration-schema-evolution.md](08-migration-schema-evolution.md) · [../05-backend-senior/13-checklist-review-backend.md](../05-backend-senior/13-checklist-review-backend.md)

🔴 = vi phạm thì từ chối.

## A. Migration schema

- [ ] 🔴 Có `lock_timeout` (ví dụ `SET lock_timeout = '5s'`) cho DDL trên bảng đang có traffic, và có cơ chế retry.
- [ ] 🔴 Không đổi tên/xóa cột hoặc đổi kiểu trong **một** bước khi code cũ còn chạy → phải theo expand/contract.
- [ ] Tạo index trên bảng lớn dùng `CREATE INDEX CONCURRENTLY` (và không nằm trong transaction block của tool migration).
- [ ] Thêm `NOT NULL`/FK/CHECK trên bảng lớn: dùng `NOT VALID` rồi `VALIDATE CONSTRAINT` riêng.
- [ ] Backfill dữ liệu lớn chạy theo lô, có giới hạn tốc độ, không trong một transaction khổng lồ.
- [ ] Migration đã chạy thử trên bản sao dữ liệu cỡ production; có thời gian chạy ước tính.
- [ ] Có kế hoạch lùi (down migration hoặc roll-forward) được viết ra.
- [ ] Thứ tự deploy rõ: migration trước hay code trước, và cả hai phiên bản code đều chạy được với schema mới.

## B. Truy vấn và index

- [ ] Truy vấn mới trên bảng > 1 triệu dòng có kết quả `EXPLAIN (ANALYZE, BUFFERS)` trên dữ liệu thật/giả lập đủ lớn.
- [ ] Không Seq Scan ngoài ý muốn trên bảng lớn; ước lượng rows không lệch quá xa thực tế.
- [ ] Index mới thật sự được dùng, không trùng index sẵn có; cân nhắc chi phí ghi.
- [ ] Không bọc cột có index trong hàm (`WHERE lower(email) = ...` cần expression index).
- [ ] Phân trang lớn dùng keyset, không `OFFSET` hàng trăm nghìn.
- [ ] Không N+1 (đếm số truy vấn trong một request).

## C. Transaction và đồng thời

- [ ] Logic "đọc → kiểm tra → ghi" được bảo vệ bằng ràng buộc UNIQUE, `SELECT … FOR UPDATE`, hoặc isolation phù hợp.
- [ ] Nếu dùng `SERIALIZABLE`/`REPEATABLE READ`: code có retry khi lỗi `40001`.
- [ ] Không gọi API ngoài / I/O chậm khi đang giữ transaction.
- [ ] Thứ tự lock nhất quán để tránh deadlock.
- [ ] Có `statement_timeout` hợp lý cho role ứng dụng.

## D. Vận hành và cấu hình

- [ ] 🔴 Thay đổi cấu hình cần restart được lên lịch, có người trực; biết tham số nào reload được, tham số nào cần restart.
- [ ] Tăng `max_connections` không phải giải pháp cho thiếu kết nối — kiểm tra pooling trước.
- [ ] `work_mem` mới đã tính theo số kết nối đồng thời × số node sort/hash.
- [ ] Replication slot mới có giám sát dung lượng WAL giữ lại.
- [ ] Giám sát/cảnh báo cho bảng/tính năng mới (bloat, kích thước, lag).

## E. Dữ liệu và an toàn

- [ ] 🔴 Lệnh `UPDATE`/`DELETE` thủ công trên production: chạy trong transaction, `SELECT` đếm trước, có `WHERE` được người thứ hai đọc lại, có backup/PITR gần nhất.
- [ ] 🔴 Không cấp quyền superuser/owner cho role ứng dụng; migration dùng role riêng.
- [ ] Cột chứa PII được xác định; dữ liệu non-prod đã được che (mask).
- [ ] Backup mới/thay đổi đã được restore thử thành công.

## F. Redis / cache

- [ ] Không dùng `KEYS *`, không tạo key cực lớn (hash/list hàng triệu phần tử).
- [ ] Mọi key cache có TTL; có chiến lược khi Redis không khả dụng (fallback về DB có giới hạn).
- [ ] Distributed lock (nếu có) có TTL và fencing token khi bảo vệ dữ liệu quan trọng.

## Lỗi agent hay mắc với database

| Lỗi | Hậu quả |
|---|---|
| Viết migration đổi tên cột một bước | Code đang chạy lỗi ngay khi deploy |
| `CREATE INDEX` không `CONCURRENTLY` trên bảng lớn | Khóa ghi bảng hàng phút |
| Bỏ quên `lock_timeout` | Một DDL chờ lock làm nghẽn toàn bộ truy vấn |
| Đề xuất tăng `max_connections` lên hàng nghìn | Tốn RAM, chậm hơn; cần PgBouncer |
| Đưa ra "đã tối ưu" mà không có EXPLAIN trước/sau | Không có bằng chứng |
| Backfill bằng một `UPDATE` cho cả bảng | Transaction khổng lồ, bloat, replication lag |
| Chọn NoSQL "cho dễ scale" với dữ liệu quan hệ | Mất tính toàn vẹn, join ở code |
