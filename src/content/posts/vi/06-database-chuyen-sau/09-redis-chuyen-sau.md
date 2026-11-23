---
title: "Redis chuyên sâu"
description: "dùng Redis đúng vai trò (cache, bộ đếm, xếp hạng, giới hạn tần suất, hàng đợi nhẹ), hiểu mô hình đơn luồng, độ bền, HA/cluster, và những sự cố điển hình."
pubDatetime: 2026-11-18T10:00:00Z
featured: false
tags:
  - database
  - data-engineering
  - redis
---
# Redis chuyên sâu

**Mục đích:** dùng Redis đúng vai trò (cache, bộ đếm, xếp hạng, giới hạn tần suất, hàng đợi nhẹ), hiểu mô hình đơn luồng, độ bền, HA/cluster, và những sự cố điển hình.
**Liên quan:** [07-cau-hinh-van-hanh-monitoring.md](07-cau-hinh-van-hanh-monitoring.md) · [10-chon-database-nosql-search.md](10-chon-database-nosql-search.md) · [11-bao-mat-database.md](11-bao-mat-database.md) · [12-checklist-review-database.md](12-checklist-review-database.md) · Cache và rate limit: [../05-backend-senior/09-scale-trieu-user.md](../05-backend-senior/09-scale-trieu-user.md) · Session: [../05-backend-senior/02-session-token.md](../05-backend-senior/02-session-token.md) · Hàng đợi: [../05-backend-senior/10-messaging-kafka.md](../05-backend-senior/10-messaging-kafka.md)

---

## 1. Redis là gì và không là gì

- Kho dữ liệu **trong bộ nhớ**, cấu trúc dữ liệu phong phú, độ trễ dưới mili giây.
- **Không** phải nguồn sự thật cho dữ liệu quan trọng (đơn hàng, bài làm, điểm). Kể cả có persistence, mặc định có thể mất dữ liệu vài giây gần nhất khi sự cố, và failover bất đồng bộ có thể mất ghi.
- Quy tắc LearnHub: mọi thứ trong Redis phải **dựng lại được** từ PostgreSQL hoặc **mất được** (bộ đếm tạm, rate limit). Ngoại lệ phải ghi rõ trong thiết kế.

### Về giấy phép (2024–2025)

Tháng 3/2024 Redis Ltd. đổi giấy phép Redis (từ 7.4) sang RSALv2/SSPLv1 (không còn là mã nguồn mở theo OSI). Linux Foundation tạo fork **Valkey** (từ Redis 7.2.4, BSD), được AWS ElastiCache/MemoryDB, Google Memorystore hỗ trợ. Redis 8 (2025) bổ sung lựa chọn AGPLv3. Với dịch vụ managed, lựa chọn chủ yếu là chi phí và tính năng; với tự vận hành, kiểm tra giấy phép với bộ phận pháp lý. Cú pháp lệnh trong tài liệu này dùng được cho cả hai.

## 2. Mô hình đơn luồng và hệ quả

Các lệnh được **thực thi tuần tự trên một luồng** (từ Redis 6 có I/O đa luồng cho đọc/ghi mạng, nhưng thực thi lệnh vẫn một luồng). Ưu: mỗi lệnh là nguyên tử, không cần lock. Nhược: **một lệnh chậm chặn mọi client**.

| Lệnh/hành vi nguy hiểm | Vì sao | Thay bằng |
|---|---|---|
| `KEYS pattern` | Duyệt toàn bộ keyspace O(N) | `SCAN` có cursor |
| `HGETALL`/`SMEMBERS`/`LRANGE 0 -1` trên khóa khổng lồ | O(N) với N lớn | `HSCAN`/`SSCAN`, giới hạn phạm vi |
| `DEL` khóa lớn (triệu phần tử) | Giải phóng bộ nhớ đồng bộ | `UNLINK` (giải phóng nền); bật `lazyfree-lazy-*` |
| `FLUSHALL` | Đồng bộ | `FLUSHALL ASYNC` — và đừng chạy trên production |
| Lua script chạy lâu | Chặn toàn server | Giữ script ngắn, O(1)/O(log N) |
| `SORT`, `ZUNIONSTORE` trên tập lớn | CPU | Tính trước, tách nhỏ |

Thêm: **big key** (một key vài trăm MB) gây trễ mạng, mất cân bằng cluster, và chậm khi failover/đồng bộ. Mục tiêu: string < 1 MB, collection < ~10k phần tử (chia nhỏ khi lớn hơn).

## 3. Cấu trúc dữ liệu và cách LearnHub dùng

| Cấu trúc | Ví dụ LearnHub | Lệnh chính | Ghi chú |
|---|---|---|---|
| String | Cache hồ sơ đã render `user:{id}:profile:v3` | `SET k v EX 300`, `GET`, `MGET` | Đánh version trong key để vô hiệu hóa hàng loạt khi đổi định dạng |
| String (counter) | Rate limit đăng nhập `rl:login:{ip}:{minute}` | `INCR`, `EXPIRE` | Đặt TTL **cùng lúc** (pipeline/Lua) để không có key bất tử |
| Hash | Phiên `sess:{sid}` với các trường user_id, created_at | `HSET`, `HGET`, `HINCRBY` | Bộ nhớ hiệu quả với hash nhỏ (listpack) |
| Sorted set | Bảng xếp hạng điểm đề thi `lb:exam:{examId}` | `ZADD`, `ZINCRBY`, `ZREVRANGE 0 9 WITHSCORES`, `ZREVRANK` | O(log N); hòa điểm cần tiêu chí phụ (mã hóa thời gian vào score) |
| Sorted set | Feed theo thời gian `feed:{userId}` giữ 500 mục mới nhất | `ZADD`, `ZREMRANGEBYRANK k 0 -501` | Cắt độ dài mỗi lần thêm |
| Set | Người đã like bài `likes:post:{id}` (bài nhỏ) | `SADD`, `SISMEMBER`, `SCARD` | Với bài viral, dùng DB + bộ đếm thay vì set khổng lồ |
| HyperLogLog | Lượt xem duy nhất của bài `uv:post:{id}:{day}` | `PFADD`, `PFCOUNT`, `PFMERGE` | 12 KB/khóa, sai số ~0,81%; không liệt kê được phần tử |
| Bitmap | Điểm danh học hằng ngày `active:{date}` theo user_id | `SETBIT`, `BITCOUNT` | ID dày đặc thì hiệu quả; ID thưa (UUID) thì không |
| Stream | Sự kiện kiểm duyệt nhẹ `stream:moderation` | `XADD`, `XREADGROUP`, `XACK`, `XAUTOCLAIM` | Consumer group, ack, pending list; xem §8 |
| Geo | (không dùng) | `GEOADD`, `GEOSEARCH` | |

Ví dụ cập nhật bảng xếp hạng khi chấm xong:

```ts
// score = điểm * 1e10 + (MAX_TS - thời_điểm_nộp) để người nộp sớm hơn đứng trên khi bằng điểm
const score = points * 1e10 + (9_999_999_999 - Math.floor(submittedAt.getTime() / 1000));
await redis.zadd(`lb:exam:${examId}`, score, String(userId));
await redis.expire(`lb:exam:${examId}`, 60 * 60 * 24 * 30);
```

Chú ý độ chính xác: score là số thực 64-bit (chính xác tuyệt đối tới 2^53). Kiểm tra số học khi ghép nhiều tiêu chí vào một score.

## 4. TTL và chính sách eviction

- **Mọi key cache phải có TTL.** Thêm jitter (`300 + random(0..60)` giây) để tránh hết hạn đồng loạt.
- `maxmemory` phải được đặt (để chừa RAM cho fork khi lưu RDB, buffer replication, phân mảnh): thường 60–75% RAM máy.

| `maxmemory-policy` | Hành vi khi đầy | Dùng cho |
|---|---|---|
| `noeviction` (mặc định) | Lệnh ghi trả lỗi | Redis giữ dữ liệu không được mất (session, hàng đợi) |
| `allkeys-lru` / `allkeys-lfu` | Đuổi key ít dùng nhất trong mọi key | **Cache thuần** (LFU tốt khi có tập key nóng ổn định) |
| `volatile-lru` / `volatile-lfu` / `volatile-ttl` | Chỉ đuổi key có TTL | Instance trộn cache + dữ liệu cần giữ (không khuyến khích) |
| `allkeys-random` / `volatile-random` | Ngẫu nhiên | Hiếm |

Khuyến nghị: **tách instance** theo vai trò — cache (`allkeys-lfu`) và dữ liệu trạng thái như session/rate limit/queue (`noeviction`, có persistence). Trộn chung dẫn tới việc cache đẩy session ra hoặc session làm đầy bộ nhớ khiến cache lỗi ghi.

## 5. Persistence: RDB vs AOF

| | RDB (snapshot) | AOF (append-only) |
|---|---|---|
| Cơ chế | `fork()` rồi ghi ảnh chụp định kỳ | Ghi mọi lệnh ghi; rewrite định kỳ để gọn |
| Mất dữ liệu khi crash | Từ lần snapshot cuối (phút) | `appendfsync everysec`: ~1 giây; `always`: gần 0 nhưng chậm |
| Khởi động lại | Nhanh | Chậm hơn (từ Redis 7 có multi-part AOF + base RDB giúp nhanh hơn) |
| Chi phí | Fork + copy-on-write: có thể cần thêm tới 2× RAM khi ghi nhiều | IO liên tục |

Gợi ý:
- Cache thuần: tắt persistence hoặc chỉ RDB (khởi động lại với cache rỗng có thể chấp nhận — nhưng hãy chuẩn bị cho **cache lạnh** đổ tải vào DB, xem §10).
- Session/rate limit/queue: AOF `everysec` + RDB.
- Fork trên máy RAM lớn có thể làm Redis đứng hàng trăm ms (`latest_fork_usec`). Tắt Transparent Huge Pages trên Linux.

## 6. Sao chép, Sentinel và Cluster

### 6.1 Replication

- Bất đồng bộ: primary trả OK trước khi replica nhận → failover có thể **mất các ghi cuối**. `WAIT numreplicas timeout` giảm rủi ro nhưng không đảm bảo tuyệt đối.
- Replica có thể dùng để đọc, nhưng dữ liệu có thể cũ.

### 6.2 Sentinel vs Cluster

| | Sentinel | Cluster |
|---|---|---|
| Dữ liệu | Một primary chứa toàn bộ | Chia 16384 hash slot cho nhiều primary |
| Mục đích | HA (tự failover) | HA + mở rộng ghi và bộ nhớ |
| Lệnh nhiều key | Tự do | Chỉ khi mọi key cùng slot (`CROSSSLOT` lỗi) |
| Client | Hỏi Sentinel địa chỉ primary | Client hiểu cluster, xử lý `MOVED`/`ASK` |
| Khi chọn | Dữ liệu vừa một máy (≤ ~vài chục GB), cần đơn giản | Vượt một máy hoặc thông lượng một luồng |

Slot của key = `CRC16(key) mod 16384`. **Hash tag** ép các key vào cùng slot: chỉ phần trong `{}` được băm.

```
sess:{u123}:a   sess:{u123}:b   → cùng slot → MGET, MULTI, Lua nhiều key được phép
```

Cẩn thận: hash tag chung cho quá nhiều key (ví dụ `{global}`) tạo **slot nóng**.

Managed (ElastiCache/Memorystore/Azure Cache) xử lý failover và vá lỗi; vẫn phải hiểu các giới hạn trên.

## 7. Khóa phân tán (distributed lock)

Mẫu cơ bản:

```ts
const token = crypto.randomUUID();
const ok = await redis.set(`lock:grade:${attemptId}`, token, 'PX', 30_000, 'NX');
if (!ok) return; // người khác đang giữ
try { await gradeAttempt(attemptId); }
finally {
  // Chỉ xóa nếu vẫn là khóa của mình (so khớp token, nguyên tử bằng Lua)
  await redis.eval(
    `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`,
    1, `lock:grade:${attemptId}`, token);
}
```

Vấn đề không thể tránh:
- **Khóa hết hạn khi công việc chưa xong** (GC pause, mạng chậm) → hai worker cùng chạy.
- **Failover** mất khóa vừa ghi → người khác lấy được.
- **Redlock** (lấy khóa trên đa số N instance độc lập) được đề xuất cho vấn đề trên, nhưng bị phê phán (Martin Kleppmann, 2016) vì phụ thuộc giả định về đồng hồ và thời gian; tác giả Redis phản biện lại. Kết luận thực tế: Redis lock phù hợp cho **hiệu quả** (tránh làm việc trùng), **không** đủ cho **tính đúng** (không bao giờ được làm hai lần).

Khi tính đúng là bắt buộc:
- **Fencing token**: số tăng dần cấp kèm khóa; tài nguyên đích (DB) từ chối ghi có token cũ hơn.
- Hoặc dùng chính DB: `SELECT ... FOR UPDATE`, `pg_advisory_xact_lock`, ràng buộc UNIQUE, cột `version` (optimistic lock). Với LearnHub, "chấm bài đúng một lần" được bảo đảm bằng `UPDATE exam_attempts SET status='graded' WHERE id=$1 AND status='submitted'` (kiểm tra số hàng bị ảnh hưởng), Redis lock chỉ để tránh hai worker cùng tốn công.
- Hoặc dùng hệ thống đồng thuận (etcd, ZooKeeper) cho điều phối hạ tầng.

## 8. Tính nguyên tử: MULTI, Lua, pipeline

| Cơ chế | Nguyên tử | Giảm round-trip | Ghi chú |
|---|---|---|---|
| Pipeline | ❌ | ✅ | Gửi nhiều lệnh một lần; lệnh khác có thể xen giữa |
| `MULTI/EXEC` | ✅ (không xen kẽ) | ✅ | **Không rollback** khi một lệnh lỗi runtime; `WATCH` cho optimistic check |
| Lua (`EVAL`/`EVALSHA`) / Functions (Redis 7+) | ✅ | ✅ | Có logic điều kiện; phải ngắn; khai báo mọi key qua `KEYS[]` (bắt buộc cho cluster) |

Rate limit sliding window bằng Lua (đếm trong sorted set):

```lua
-- KEYS[1]=key, ARGV[1]=now_ms, ARGV[2]=window_ms, ARGV[3]=limit, ARGV[4]=member duy nhất
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1] - ARGV[2])
local n = redis.call('ZCARD', KEYS[1])
if n >= tonumber(ARGV[3]) then return 0 end
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return 1
```

## 9. Pub/Sub vs Streams

| | Pub/Sub | Streams |
|---|---|---|
| Lưu trữ | Không — client offline mất tin | Có, theo ID, giới hạn bằng `MAXLEN`/`MINID` |
| Ack, retry | Không | Consumer group, `XACK`, pending entries, `XAUTOCLAIM` |
| Dùng cho | Thông báo thời gian thực "mất cũng được" (đẩy cập nhật qua WebSocket giữa các node) | Hàng đợi nhẹ, sự kiện cần xử lý ít nhất một lần |
| Không dùng cho | Công việc phải hoàn thành | Log sự kiện lâu dài, replay nhiều tháng, thông lượng rất lớn → Kafka |

## 10. Sự cố điển hình

| Sự cố | Cơ chế | Phòng tránh |
|---|---|---|
| **Cache stampede** | Key nóng hết hạn, hàng nghìn request cùng truy vấn DB | Khóa tái tạo (một request dựng, còn lại chờ/nhận dữ liệu cũ), làm mới sớm xác suất, TTL jitter |
| **Cache lạnh sau restart/failover** | Toàn bộ tải đổ vào DB | Làm ấm cache trước, giới hạn đồng thời truy vấn DB, persistence cho cache quan trọng |
| **Hot key** | Một key (bài viral, bảng xếp hạng đề thi toàn quốc) dồn vào một shard/luồng | Cache cục bộ trong process vài giây, nhân bản key (`k:1..k:N` đọc ngẫu nhiên), `redis-cli --hotkeys` (cần policy LFU) |
| **Big key** | Trễ, mất cân bằng | `redis-cli --bigkeys` / `--memkeys`, `MEMORY USAGE k`; chia nhỏ |
| **Hết bộ nhớ** | `noeviction` → lỗi ghi; hoặc OOM killer | `maxmemory`, cảnh báo `used_memory` > 80%, TTL mọi key cache |
| **Fork chậm / swap** | RDB/AOF rewrite trên máy thiếu RAM | Dư RAM, tắt THP, `vm.overcommit_memory=1` theo khuyến nghị Redis |
| **Kết nối bùng nổ** | Mỗi request mở kết nối mới | Client dùng pool/kết nối dài; giám sát `connected_clients` |
| **Timeout client quá dài** | Redis chậm kéo theo toàn bộ API | Timeout client 50–200 ms cho cache; cache lỗi → đọc DB (có giới hạn) thay vì treo |
| **Lệnh nguy hiểm trên production** | `KEYS *`, `FLUSHALL` | ACL chặn nhóm lệnh `@dangerous` cho user ứng dụng (xem [11-bao-mat-database.md](11-bao-mat-database.md)) |

## 11. Định cỡ bộ nhớ

Ước lượng cache hồ sơ LearnHub: 1 triệu user hoạt động/ngày × ~2 KB JSON + overhead key (~50–100 byte) ≈ 2,1 GB. Session: 2 triệu phiên × ~300 byte ≈ 0,6 GB. Bảng xếp hạng: 10k đề thi × 5k người × ~80 byte ≈ 4 GB. Cộng hệ số phân mảnh (`mem_fragmentation_ratio` ~1,2–1,5) và chỗ cho fork → instance cache 16 GB, instance trạng thái 8 GB, đều có replica.

Đo thật bằng `INFO memory`, `MEMORY USAGE`, và theo dõi theo thời gian — đừng chỉ tin ước lượng.

## 12. Chỉ số giám sát

| Chỉ số (`INFO`) | Ngưỡng gợi ý |
|---|---|
| `used_memory` / `maxmemory` | > 80% |
| `evicted_keys` tăng (instance trạng thái) | > 0 là sự cố |
| Tỷ lệ hit `keyspace_hits / (hits + misses)` | Giảm đột ngột so với baseline |
| `instantaneous_ops_per_sec`, CPU luồng chính | CPU > 70–80% kéo dài |
| Độ trễ (`LATENCY`, `SLOWLOG GET`) | Lệnh > 10 ms |
| `connected_clients`, `blocked_clients` | Tăng bất thường |
| `master_link_status`, `master_repl_offset` chênh lệch | Replica đứt hoặc trễ |
| `rdb_last_bgsave_status`, `aof_last_write_status` | `err` |

## 13. Sai lầm hay gặp (kể cả của agent)

- Lưu dữ liệu duy nhất (bài làm đang làm dở) chỉ trong Redis, không ghi DB.
- `INCR` rồi `EXPIRE` ở hai lệnh rời → crash giữa chừng tạo key không bao giờ hết hạn.
- Dùng `KEYS` để xóa cache theo pattern.
- Key không TTL, không `maxmemory`.
- Agent viết lock `SET NX` nhưng `DEL` không kiểm tra token → xóa khóa của người khác.
- Dùng Redis lock để bảo đảm "chỉ một lần" cho thao tác tiền/điểm.
- Cache dữ liệu phụ thuộc quyền dưới key chung (`post:{id}` chứa trường chỉ admin thấy).
- Chuyển sang Cluster mà vẫn dùng lệnh nhiều key không có hash tag → lỗi `CROSSSLOT` trên production.
- Serialize object nặng (cả quan hệ) vào một key → big key.
- Timeout client mặc định vài giây.

## Checklist review

- [ ] Dữ liệu trong Redis dựng lại được từ DB hoặc mất được; ngoại lệ được ghi rõ và có persistence phù hợp.
- [ ] Mọi key cache có TTL (có jitter); `maxmemory` và policy đúng vai trò instance.
- [ ] Không dùng `KEYS`, lệnh O(N) trên collection lớn, `DEL` khóa lớn (dùng `UNLINK`).
- [ ] Thao tác nhiều bước cần nguyên tử dùng Lua/MULTI; `INCR` + `EXPIRE` nguyên tử.
- [ ] Lock: token ngẫu nhiên, giải phóng có so khớp, TTL hợp lý; tính đúng được bảo đảm ở DB (ràng buộc/điều kiện/fencing), không chỉ dựa vào Redis lock.
- [ ] Tương thích Cluster: key nhiều-khóa dùng hash tag, không tạo slot nóng.
- [ ] Có xử lý cache stampede và hành vi khi Redis không khả dụng (timeout ngắn, fallback có giới hạn).
- [ ] Không có big key; đã ước lượng bộ nhớ.
- [ ] Cache không trộn dữ liệu theo quyền dưới key chung.
- [ ] Có giám sát bộ nhớ, eviction, độ trễ, replication, trạng thái persistence.
