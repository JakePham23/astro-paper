---
title: "Xử lý sự cố production"
description: "quy trình ứng phó sự cố, checklist 5 phút đầu, và runbook cho các sự cố thường gặp (triệu chứng → lệnh kiểm tra → nguyên nhân → giảm thiểu → sửa tận gốc). Kèm mẫu postmortem và..."
pubDatetime: 2026-11-17T22:00:00Z
featured: false
tags:
  - devops
  - infrastructure
  - incident-response
---
# Xử lý sự cố production

**Mục đích:** quy trình ứng phó sự cố, checklist 5 phút đầu, và runbook cho các sự cố thường gặp (triệu chứng → lệnh kiểm tra → nguyên nhân → giảm thiểu → sửa tận gốc). Kèm mẫu postmortem và cách dùng Claude/agent an toàn khi có sự cố.
**Liên quan:** [01-linux-server.md](01-linux-server.md) · [02-mang-network.md](02-mang-network.md) · [03-load-balancer-reverse-proxy.md](03-load-balancer-reverse-proxy.md) · [05-kubernetes.md](05-kubernetes.md) · [06-ci-cd-iac.md](06-ci-cd-iac.md) · [07-cloud-kien-truc.md](07-cloud-kien-truc.md) · [09-checklist-review-ha-tang.md](09-checklist-review-ha-tang.md) · [../05-backend-senior/12-observability-reliability.md](../05-backend-senior/12-observability-reliability.md) · [../06-database-chuyen-sau/](../06-database-chuyen-sau/)

---

## 1. Nguyên tắc vàng

1. **Giảm thiệt hại trước, tìm nguyên nhân sau** (mitigate first, debug later). Rollback, tắt feature flag, scale lên, chặn traffic xấu — rồi mới điều tra.
2. **Một người chỉ huy.** Nhiều người cùng sửa không phối hợp làm sự cố tệ hơn.
3. **Ghi lại mọi thứ theo thời gian** (ai làm gì, lúc nào, kết quả ra sao) — để phối hợp và để viết postmortem.
4. **Thay đổi từng thứ một** và quan sát kết quả.
5. **Không đổ lỗi.** Mục tiêu là sửa hệ thống, không phạt người.

## 2. Mức độ nghiêm trọng

| Mức | Định nghĩa (LearnHub) | Phản hồi | Ví dụ |
|---|---|---|---|
| SEV1 | Mất dịch vụ chính hoặc mất/lộ dữ liệu; nhiều người dùng bị ảnh hưởng | Ngay lập tức, 24/7, gọi điện | Không đăng nhập được; bài thi đang diễn ra không nộp được; lộ dữ liệu |
| SEV2 | Một chức năng quan trọng suy giảm nặng, có cách vòng | Trong 30 phút, kể cả ngoài giờ | Kiểm duyệt bài viết dừng; p95 > 3s |
| SEV3 | Ảnh hưởng nhỏ, ít người dùng | Trong giờ làm việc | Email thông báo chậm 1 giờ |
| SEV4 | Không ảnh hưởng người dùng | Đưa vào backlog | Cảnh báo dung lượng ở mức 70% |

Nghi ngờ thì **nâng mức**, hạ sau cũng được.

## 3. Vai trò

| Vai trò | Việc |
|---|---|
| Incident Commander (IC) | Điều phối, ra quyết định, phân việc; **không tự tay gõ lệnh** trong sự cố lớn |
| Ops / Subject-matter expert | Điều tra và thực hiện giảm thiểu theo chỉ đạo của IC |
| Communications | Cập nhật status page, thông báo nội bộ/khách hàng định kỳ (ví dụ 30 phút/lần) |
| Scribe | Ghi timeline trong kênh sự cố |

Sự cố nhỏ: một người kiêm nhiều vai, nhưng vẫn ghi timeline.

## 4. Checklist 5 phút đầu

1. **Xác nhận** sự cố có thật: dashboard, thử chính luồng người dùng, nhiều nguồn cảnh báo cùng báo?
2. **Mở kênh sự cố** (`#inc-2026-11-20-login`), chỉ định IC, ghi giờ bắt đầu.
3. **Phạm vi**: chức năng nào, bao nhiêu % người dùng, region/AZ nào, từ lúc nào?
4. **Điều gì vừa thay đổi?** Deploy, migration, thay đổi cấu hình, feature flag, thay đổi hạ tầng, sự kiện lưu lượng (giờ thi), sự cố của nhà cung cấp.
   ```bash
   kubectl rollout history deploy/learnhub-api -n learnhub
   git log --since="3 hours ago" --oneline   # repo app và repo GitOps/infra
   ```
5. **Nếu có thay đổi gần đây trùng thời điểm → rollback ngay**, không cần chứng minh trước.
6. Khai báo mức SEV, cập nhật status page nếu người dùng bị ảnh hưởng.

## 5. Bốn tín hiệu vàng để định hướng

| Tín hiệu | Câu hỏi |
|---|---|
| Latency | Chậm ở đâu: LB, app, DB, dịch vụ ngoài? (trace) |
| Traffic | Lưu lượng có tăng đột biến (giờ thi, bot, DDoS) hay giảm bất thường (DNS, chứng chỉ)? |
| Errors | Loại lỗi gì: 5xx từ app, 502/504 từ LB, timeout DB? |
| Saturation | Tài nguyên nào chạm trần: CPU, memory, kết nối DB, disk, file descriptor, thread pool? |

## 6. Runbook

Mỗi runbook: **Triệu chứng → Kiểm tra → Nguyên nhân thường gặp → Giảm thiểu ngay → Sửa tận gốc.**

### 6.1. CPU cao

- **Triệu chứng:** latency tăng đều, CPU node/pod > 85%, HPA đã max.
- **Kiểm tra:**
  ```bash
  kubectl top pods -n learnhub --sort-by=cpu
  top -H -p <pid>                 # trên VM: thread nào ăn CPU
  # Node.js: profile ngắn hạn
  node --cpu-prof ...  hoặc  0x / clinic flame
  ```
- **Nguyên nhân:** lưu lượng tăng thật; vòng lặp nóng / regex thảm họa (ReDoS); JSON lớn bị parse/stringify; GC liên tục do thiếu bộ nhớ; bot cào dữ liệu.
- **Giảm thiểu:** scale thêm (tăng `maxReplicas`, thêm node); rate limit/chặn bot ở WAF; tắt tính năng nặng bằng flag; rollback nếu vừa deploy.
- **Sửa gốc:** profile, tối ưu đoạn nóng, cache, chuyển việc nặng sang worker.

### 6.2. Rò rỉ bộ nhớ / OOMKilled

- **Triệu chứng:** memory tăng dần theo thời gian (đồ thị răng cưa), Pod restart với `OOMKilled` (exit 137).
- **Kiểm tra:**
  ```bash
  kubectl describe pod <pod> -n learnhub | grep -A3 "Last State"
  kubectl top pods -n learnhub --sort-by=memory
  dmesg -T | grep -i -E "killed process|out of memory"   # trên VM
  ```
- **Nguyên nhân:** cache trong process không giới hạn; listener/timer không dọn; giữ tham chiếu tới request; heap Node lớn hơn limit container.
- **Giảm thiểu:** tăng limit tạm thời; restart cuốn chiếu định kỳ (biện pháp tạm); rollback.
- **Sửa gốc:** heap snapshot (`--heapsnapshot-signal=SIGUSR2`), so sánh hai snapshot; giới hạn cache (LRU có max); đặt `--max-old-space-size` < limit.

### 6.3. Latency cao

- **Kiểm tra:** trace của request chậm — thời gian nằm ở đâu? So p50/p95/p99. Xem latency DB, Redis, dịch vụ ngoài.
- **Nguyên nhân:** truy vấn chậm/thiếu index; chờ kết nối từ pool; CPU throttling (xem [05-kubernetes.md](05-kubernetes.md) mục 9); dịch vụ ngoài chậm không có timeout; cache miss hàng loạt (cache stampede sau khi Redis restart).
- **Giảm thiểu:** bật cache/serve stale; giảm timeout + circuit breaker cho dịch vụ ngoài; chuyển đọc sang replica; tắt tính năng không thiết yếu (load shedding).

### 6.4. Tăng đột biến 5xx / 502 / 504

| Mã | Ai sinh ra | Ý nghĩa thường gặp |
|---|---|---|
| 500 | App | Lỗi code/ngoại lệ không xử lý |
| 502 Bad Gateway | LB/proxy | Backend đóng kết nối, crash, trả dữ liệu hỏng; **keep-alive timeout của app ngắn hơn của LB** |
| 503 | LB/app | Không có backend sẵn sàng (readiness fail hết), hoặc app chủ động từ chối (quá tải) |
| 504 Gateway Timeout | LB/proxy | Backend không trả lời trong thời hạn của LB |

- **Kiểm tra:**
  ```bash
  kubectl get endpoints learnhub-api -n learnhub      # còn backend nào không?
  kubectl get pods -n learnhub | grep -v Running
  kubectl logs deploy/learnhub-api -n learnhub --since=10m | grep -i error | head
  ```
  Xem log LB (target response time, target status code), so sánh 5xx từ LB vs từ app.
- **Lỗi kinh điển:** 502 lẻ tẻ do Node `server.keepAliveTimeout` (mặc định 5s) **ngắn hơn** idle timeout của LB (ví dụ 60s) → LB gửi request vào kết nối app vừa đóng. Sửa: `keepAliveTimeout` > idle timeout LB (ví dụ 65s), `headersTimeout` lớn hơn nữa.
- **Giảm thiểu:** rollback; scale; nếu do dịch vụ phụ thuộc, bật degrade.

### 6.5. Hết kết nối database

- **Triệu chứng:** lỗi `too many connections` / `remaining connection slots are reserved`; app timeout chờ pool.
- **Kiểm tra (PostgreSQL):**
  ```sql
  SELECT count(*), state, application_name
  FROM pg_stat_activity GROUP BY state, application_name ORDER BY 1 DESC;
  SHOW max_connections;
  -- kết nối "idle in transaction" lâu: transaction mở mà không đóng
  SELECT pid, now() - xact_start AS dur, state, left(query, 80)
  FROM pg_stat_activity WHERE state = 'idle in transaction' ORDER BY dur DESC;
  ```
- **Nguyên nhân:** số Pod × pool size > `max_connections` (ví dụ 60 Pod × 20 = 1200 kết nối); HPA scale lên làm bùng số kết nối; rò rỉ kết nối (không release trong nhánh lỗi); transaction treo; truy vấn chậm giữ kết nối lâu.
- **Giảm thiểu:** kết thúc phiên treo (`SELECT pg_terminate_backend(pid)` — có người duyệt); giảm pool size mỗi Pod; dừng scale.
- **Sửa gốc:** đặt PgBouncer (transaction pooling) / RDS Proxy; công thức `pods_max × pool_size ≤ khả năng của pooler`; `idle_in_transaction_session_timeout`; luôn release kết nối trong `finally`.

### 6.6. Truy vấn chậm / dồn khóa (lock pile-up)

- **Kiểm tra:**
  ```sql
  -- ai đang chặn ai
  SELECT a.pid, pg_blocking_pids(a.pid) AS blocked_by, a.wait_event_type,
         now() - a.query_start AS dur, left(a.query, 100)
  FROM pg_stat_activity a WHERE cardinality(pg_blocking_pids(a.pid)) > 0;
  -- truy vấn tốn nhất (cần pg_stat_statements)
  SELECT calls, round(mean_exec_time) ms, left(query, 100)
  FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
  ```
- **Nguyên nhân:** migration `ALTER TABLE` chờ khóa → mọi truy vấn sau xếp hàng sau nó; transaction dài; thiếu index; plan thay đổi sau `ANALYZE`.
- **Giảm thiểu:** hủy truy vấn/migration gây chặn (`pg_cancel_backend`, rồi `pg_terminate_backend` nếu cần).
- **Sửa gốc:** migration luôn đặt `SET lock_timeout = '5s'`; thêm index `CONCURRENTLY`; xem [../06-database-chuyen-sau/](../06-database-chuyen-sau/).

### 6.7. Replication lag

- **Triệu chứng:** người dùng vừa đăng bài nhưng không thấy (đọc từ replica); metric lag tăng.
- **Kiểm tra:**
  ```sql
  -- trên primary
  SELECT application_name, state, replay_lag FROM pg_stat_replication;
  -- trên replica
  SELECT now() - pg_last_xact_replay_timestamp() AS lag;
  ```
- **Nguyên nhân:** ghi hàng loạt (backfill, xóa lớn); replica yếu hơn primary; truy vấn dài trên replica xung đột với replay; mạng.
- **Giảm thiểu:** chuyển đọc quan trọng về primary (read-your-writes); tạm dừng job backfill; chia nhỏ lô.
- **Sửa gốc:** backfill theo lô nhỏ có nghỉ; replica cùng cỡ primary; định tuyến đọc nhận biết lag.

### 6.8. Đầy đĩa

- **Kiểm tra (VM):**
  ```bash
  df -h ; df -i                         # cả dung lượng và inode
  du -xh / --max-depth=2 2>/dev/null | sort -h | tail -20
  lsof +L1                              # file đã xóa nhưng process còn giữ → dung lượng chưa được trả
  journalctl --disk-usage
  ```
- **Nguyên nhân:** log không xoay vòng; **WAL Postgres tích tụ** do replication slot không hoạt động hoặc archive lỗi; file tạm; image Docker cũ; file đã xóa nhưng vẫn bị giữ mở.
- **Giảm thiểu:** xoay/nén log (`logrotate -f`), `journalctl --vacuum-size=1G`, `docker system prune` (cẩn thận), restart process đang giữ file đã xóa; tăng dung lượng volume. **Không bao giờ xóa tay file trong thư mục `pg_wal`** — DB sẽ hỏng.
- **Với WAL:** `SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) FROM pg_replication_slots;` → slot không active giữ WAL: xác định chủ sở hữu rồi mới drop.
- **Sửa gốc:** cảnh báo ở 70/85%; logrotate; `max_slot_wal_keep_size`; giám sát archive.

### 6.9. Redis đầy bộ nhớ / eviction

- **Kiểm tra:**
  ```bash
  redis-cli INFO memory | grep -E "used_memory_human|maxmemory_human|mem_fragmentation_ratio"
  redis-cli INFO stats | grep -E "evicted_keys|keyspace_misses"
  redis-cli --bigkeys          # quét key lớn (chạy trên replica nếu có thể)
  ```
- **Nguyên nhân:** key không có TTL; key quá lớn (danh sách feed không giới hạn); `maxmemory-policy noeviction` → lệnh ghi bị lỗi; lưu phiên và cache chung một instance → cache đẩy phiên ra (người dùng bị logout hàng loạt).
- **Giảm thiểu:** tăng bộ nhớ/scale; xóa key lớn bằng `UNLINK` (không chặn); đặt TTL.
- **Sửa gốc:** mọi key cache có TTL; giới hạn kích thước cấu trúc; tách cụm cache và cụm dữ liệu phiên/khóa.

### 6.10. Kafka consumer lag

- **Kiểm tra:**
  ```bash
  kafka-consumer-groups.sh --bootstrap-server <broker> --describe --group moderation-workers
  ```
- **Nguyên nhân:** consumer chậm (gọi API kiểm duyệt bên ngoài chậm); poison message gây retry vô hạn; rebalance liên tục (xử lý một batch lâu hơn `max.poll.interval.ms`); số consumer > số partition (consumer thừa ngồi không).
- **Giảm thiểu:** scale consumer (tối đa = số partition); đẩy message lỗi sang DLQ; tăng `max.poll.interval.ms` hoặc giảm `max.poll.records`.
- **Sửa gốc:** xem [../05-backend-senior/10-messaging-kafka.md](../05-backend-senior/10-messaging-kafka.md).

### 6.11. Chứng chỉ TLS hết hạn

- **Triệu chứng:** đột ngột 100% client lỗi TLS; app di động không kết nối được; gọi giữa service lỗi.
- **Kiểm tra:**
  ```bash
  echo | openssl s_client -connect api.learnhub.example:443 -servername api.learnhub.example 2>/dev/null \
    | openssl x509 -noout -dates -issuer
  kubectl get certificate -A        # cert-manager
  ```
- **Giảm thiểu:** gia hạn/cấp lại thủ công; kiểm tra chuỗi trung gian.
- **Sửa gốc:** tự động gia hạn (cert-manager/ACM); **cảnh báo 30 ngày và 7 ngày trước hạn** cho mọi chứng chỉ, kể cả chứng chỉ nội bộ và CA công ty.

### 6.12. Lỗi DNS

- **Triệu chứng:** `ENOTFOUND`, `EAI_AGAIN`, timeout khi kết nối theo tên.
- **Kiểm tra:**
  ```bash
  dig api.learnhub.example +short ; dig @8.8.8.8 api.learnhub.example
  kubectl -n kube-system logs deploy/coredns --since=10m
  kubectl run -it --rm dnscheck --image=busybox --restart=Never -- nslookup learnhub-api.learnhub
  ```
- **Nguyên nhân:** bản ghi bị sửa/xóa; domain hết hạn; CoreDNS quá tải (quá nhiều truy vấn do `ndots:5`); nhà cung cấp DNS gặp sự cố.
- **Giảm thiểu:** khôi phục bản ghi (TTL cao có thể làm chậm phục hồi); scale CoreDNS / NodeLocal DNSCache.
- **Sửa gốc:** bản ghi DNS quản lý bằng IaC; gia hạn domain tự động; giám sát DNS từ bên ngoài.

### 6.13. Deploy lỗi

- **Triệu chứng:** chỉ số xấu đi ngay sau deploy.
- **Hành động:** **rollback trước** (xem [06-ci-cd-iac.md](06-ci-cd-iac.md) mục 8):
  ```bash
  # Không dùng GitOps:
  kubectl rollout undo deploy/learnhub-api -n learnhub
  # GitOps: git revert commit cập nhật digest trên repo GitOps, đồng bộ Argo CD/Flux
  ```
  Nếu migration đã phá vỡ tương thích → không rollback được code; roll-forward hoặc khôi phục dữ liệu.
- **Sửa gốc:** canary tự động, migration expand/contract, feature flag.

### 6.14. Dịch vụ phụ thuộc ngừng (email, thanh toán, API kiểm duyệt AI, nhà cung cấp cloud)

- **Kiểm tra:** status page của nhà cung cấp; tỷ lệ lỗi/timeout theo dependency trong metric/trace.
- **Giảm thiểu:** circuit breaker mở → trả lỗi nhanh hoặc degrade (bài viết vào hàng chờ kiểm duyệt thủ công thay vì bị chặn; email xếp hàng gửi lại sau); thông báo người dùng.
- **Sửa gốc:** mọi lời gọi ngoài có timeout + retry có giới hạn + circuit breaker; việc không cần đồng bộ thì đưa vào queue.

## 7. Dùng Claude / agent an toàn khi có sự cố

Agent hữu ích để: đọc log nhanh, tìm mẫu lỗi, tóm tắt timeline, đề xuất giả thuyết, soạn câu lệnh kiểm tra, soạn thông báo status page, soạn postmortem.

Quy tắc:

| Quy tắc | Cách làm |
|---|---|
| **Quyền chỉ đọc** | Agent dùng tài khoản/kubeconfig chỉ có quyền `get/list/logs`; DB qua user chỉ đọc, ưu tiên replica |
| **Không lệnh phá hủy khi chưa có người duyệt** | `delete`, `rollout undo`, `pg_terminate_backend`, `terraform apply`, `DROP`, `TRUNCATE`, xóa file — agent **đề xuất**, IC **quyết định**, người **thực thi** hoặc duyệt từng lệnh |
| Dùng `--permission-mode plan` hoặc `manual` | Không dùng `bypassPermissions` trên hệ thống thật |
| **Kiểm chứng khẳng định** | "Nguyên nhân là X" phải kèm bằng chứng (dòng log, metric, truy vấn). Tự xem lại trước khi hành động |
| Không đưa bí mật/PII vào prompt | Lọc log trước khi dán; guardrail của repo sẽ chặn một số mẫu |
| Agent không thay thế IC | Quyết định rollback, thông báo khách hàng, chấp nhận rủi ro là của người |

Prompt mẫu:
```
Sự cố SEV2: p95 API tăng từ 200ms lên 4s từ 14:05. Deploy gần nhất lúc 13:50.
Chỉ dùng lệnh đọc. Đọc log 30 phút gần nhất của deploy/learnhub-api (namespace learnhub),
liệt kê 3 giả thuyết có xác suất cao nhất, mỗi giả thuyết kèm bằng chứng và lệnh kiểm tra tiếp theo.
KHÔNG thực hiện bất kỳ thay đổi nào.
```

## 8. Postmortem không đổ lỗi

Viết trong 3–5 ngày làm việc sau sự cố SEV1/SEV2.

```markdown
# Postmortem: <tiêu đề ngắn> (<ngày>)

## Tóm tắt
<2–3 câu: chuyện gì xảy ra, ảnh hưởng, đã khắc phục ra sao>

## Ảnh hưởng
- Thời gian: <bắt đầu> – <kết thúc> (<tổng> phút)
- Người dùng bị ảnh hưởng: <số lượng / %>, chức năng: <…>
- Dữ liệu: có mất/lộ không? SLO error budget tiêu tốn: <…>

## Timeline (giờ địa phương)
| Giờ | Sự kiện |
|---|---|
| 13:50 | Deploy phiên bản <…> |
| 14:05 | Cảnh báo p95 latency |
| 14:12 | IC khai báo SEV2 |
| 14:18 | Rollback |
| 14:25 | Chỉ số trở lại bình thường |

## Nguyên nhân gốc
<Kỹ thuật + vì sao hệ thống cho phép nó xảy ra. Dùng "5 Whys". Không nêu tên người như nguyên nhân.>

## Điều gì hiệu quả / chưa hiệu quả / may mắn
## Phát hiện: vì sao mất <N> phút mới phát hiện?

## Hành động
| Hành động | Loại (ngăn ngừa/phát hiện/giảm thiểu) | Người phụ trách | Hạn |
|---|---|---|---|
```

Hành động phải **cụ thể, có người phụ trách và hạn chót**; "cẩn thận hơn" không phải là hành động.

## 9. Lỗi hay gặp khi xử lý sự cố (kể cả do agent)

| Lỗi | Hậu quả |
|---|---|
| Debug lâu thay vì rollback | Sự cố kéo dài hàng giờ |
| Nhiều người cùng thay đổi | Không biết thay đổi nào có tác dụng |
| Xóa file trong `pg_wal` để giải phóng đĩa | Hỏng database |
| `kubectl delete pod` hàng loạt "cho chắc" | Mất toàn bộ năng lực phục vụ cùng lúc |
| Restart DB khi chưa biết nguyên nhân | Mất bằng chứng, failover kéo dài, cache nguội |
| Agent chạy lệnh ghi với quyền admin | Một suy luận sai thành sự cố thứ hai |
| Tin kết luận của agent không kèm bằng chứng | Sửa sai chỗ |
| Không ghi timeline | Postmortem thiếu, lặp lại sự cố |

## Checklist review

- [ ] Có định nghĩa mức SEV, lịch trực, kênh và vai trò sự cố.
- [ ] Mỗi cảnh báo quan trọng dẫn tới một runbook.
- [ ] Runbook có lệnh kiểm tra cụ thể, bước giảm thiểu, và đã được thử.
- [ ] Rollback được diễn tập và mất < 10 phút.
- [ ] Cảnh báo dung lượng đĩa, WAL/replication slot, hết hạn chứng chỉ, kết nối DB, Redis eviction, consumer lag.
- [ ] Agent dùng trong sự cố chỉ có quyền đọc; lệnh thay đổi do người duyệt.
- [ ] Postmortem được viết cho SEV1/SEV2, không đổ lỗi, hành động có người phụ trách và hạn.
- [ ] Các hành động từ postmortem được theo dõi tới khi hoàn tất.
