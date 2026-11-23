---
title: "Linux server cho backend production"
description: "hiểu và vận hành máy chủ Linux chạy API của LearnHub (Ubuntu 24.04 LTS): tiến trình, systemd, quyền, SSH, tường lửa, CPU/RAM/đĩa, giới hạn tài nguyên, tinh chỉnh kernel và cách..."
pubDatetime: 2026-11-18T05:00:00Z
featured: false
tags:
  - devops
  - infrastructure
---
# Linux server cho backend production

**Mục đích:** hiểu và vận hành máy chủ Linux chạy API của LearnHub (Ubuntu 24.04 LTS): tiến trình, systemd, quyền, SSH, tường lửa, CPU/RAM/đĩa, giới hạn tài nguyên, tinh chỉnh kernel và cách chẩn đoán sự cố trong 60 giây đầu.
**Liên quan:** [02-mang-network.md](02-mang-network.md) · [03-load-balancer-reverse-proxy.md](03-load-balancer-reverse-proxy.md) · [04-container-docker.md](04-container-docker.md) · [08-xu-ly-su-co-production.md](08-xu-ly-su-co-production.md) · [09-checklist-review-ha-tang.md](09-checklist-review-ha-tang.md) · [../05-backend-senior/12-observability-reliability.md](../05-backend-senior/12-observability-reliability.md)

---

## 1. Tiến trình, luồng và tín hiệu

| Khái niệm | Ý nghĩa thực tế |
|---|---|
| Process | Một chương trình đang chạy, có không gian bộ nhớ riêng, PID riêng. Node API = 1 process (mỗi worker cluster là 1 process) |
| Thread | Chạy trong process, chia sẻ bộ nhớ. Node có 1 thread JS + thread pool libuv (mặc định 4, chỉnh bằng `UV_THREADPOOL_SIZE`) cho I/O file, DNS `lookup`, crypto, zlib |
| PID 1 | Process đầu tiên (systemd trên host, hoặc process chính trong container). Có hành vi đặc biệt với tín hiệu và process mồ côi |
| Zombie | Process đã kết thúc nhưng cha chưa `wait()`. Không tốn CPU/RAM nhưng chiếm PID; nhiều zombie = cha có lỗi |

### Tín hiệu quan trọng

| Tín hiệu | Số | Bắt được? | Dùng khi |
|---|---|---|---|
| `SIGTERM` | 15 | Có | Yêu cầu tắt lịch sự — app phải dừng nhận request mới, xử lý xong request đang chạy, đóng kết nối DB, rồi thoát |
| `SIGINT` | 2 | Có | Ctrl+C |
| `SIGKILL` | 9 | **Không** | Giết ngay, không dọn dẹp. Chỉ dùng khi SIGTERM không hiệu quả sau thời gian chờ |
| `SIGHUP` | 1 | Có | Thường dùng để reload cấu hình (Nginx) |
| `SIGUSR1/2` | 10/12 | Có | Tùy ứng dụng (Node dùng SIGUSR1 bật inspector — đừng dùng cho việc khác) |

Graceful shutdown cho Node API (tối thiểu):

```ts
const server = app.listen(3000);
let shuttingDown = false;

process.on('SIGTERM', async () => {
  shuttingDown = true;                 // readiness probe trả 503 để LB ngừng gửi request
  server.close(async () => {           // ngừng nhận kết nối mới, chờ request đang chạy xong
    await db.end();                    // đóng pool PostgreSQL
    await redis.quit();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 25_000).unref(); // quá hạn thì thoát cứng, trước khi systemd/k8s gửi SIGKILL
});
```

Sai lầm hay gặp: `kill -9` thành thói quen → giao dịch dở dang, file ghi nửa chừng, kết nối DB treo phía server tới khi timeout.

## 2. systemd – chạy API như một dịch vụ

File `/etc/systemd/system/learnhub-api.service`:

```ini
[Unit]
Description=LearnHub API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=learnhub                      # KHÔNG chạy bằng root
Group=learnhub
WorkingDirectory=/opt/learnhub/api
EnvironmentFile=/etc/learnhub/api.env   # quyền 640, owner root:learnhub; không commit vào Git
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure                 # khởi động lại khi crash, không khi thoát 0
RestartSec=3
StartLimitIntervalSec=60
StartLimitBurst=5                  # crash >5 lần/60s thì dừng thử, tránh vòng lặp crash
TimeoutStopSec=30                  # chờ graceful shutdown 30s rồi mới SIGKILL
KillSignal=SIGTERM

# Giới hạn tài nguyên
LimitNOFILE=65536                  # file descriptor (mỗi socket = 1 fd)
MemoryMax=2G                       # cgroup: vượt thì OOM-kill riêng service này
CPUQuota=200%                      # tối đa 2 core

# Hardening
NoNewPrivileges=true               # không leo thang quyền qua setuid
ProtectSystem=strict               # / chỉ đọc, trừ các đường dẫn khai báo dưới
ReadWritePaths=/var/lib/learnhub /var/log/learnhub
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
RestrictNamespaces=true
LockPersonality=true
CapabilityBoundingSet=             # bỏ mọi capability; cổng <1024 thì để Nginx giữ
SystemCallArchitectures=native

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now learnhub-api
systemctl status learnhub-api
sudo systemd-analyze security learnhub-api   # chấm điểm mức hardening (thấp = tốt)
journalctl -u learnhub-api -f                 # theo dõi log
journalctl -u learnhub-api --since "10 min ago" -p err
```

journald: đặt giới hạn dung lượng trong `/etc/systemd/journald.conf` (`SystemMaxUse=2G`), nếu không log có thể làm đầy đĩa. Production thường gửi log ra hệ thống tập trung (Loki, ELK, CloudWatch) — xem [../05-backend-senior/12-observability-reliability.md](../05-backend-senior/12-observability-reliability.md).

## 3. Người dùng, quyền, sudo

- Mỗi dịch vụ một user hệ thống không đăng nhập được: `sudo useradd --system --no-create-home --shell /usr/sbin/nologin learnhub`.
- Quyền file: thư mục code `755 root:root` (app chỉ đọc), file cấu hình chứa bí mật `640 root:learnhub`, thư mục dữ liệu `750 learnhub:learnhub`.
- **`chmod 777` không bao giờ là cách sửa lỗi "Permission denied".** Tìm xem process chạy bằng user nào (`ps -o user= -p <pid>`), file thuộc ai (`ls -l`, `namei -l /đường/dẫn`), rồi cấp đúng quyền tối thiểu.
- sudo: cấp theo nhóm, không `NOPASSWD: ALL`; mọi lệnh sudo được ghi log (`/var/log/auth.log`).
- AppArmor (mặc định trên Ubuntu) / SELinux (RHEL): khi bị chặn, đọc log (`dmesg | grep -i apparmor`, `ausearch -m avc`) và viết rule; **không tắt** cả hệ thống.

## 4. SSH hardening

`/etc/ssh/sshd_config.d/99-hardening.conf`:

```
PermitRootLogin no
PasswordAuthentication no            # chỉ dùng key
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowGroups ssh-users                # chỉ nhóm được phép
MaxAuthTries 3
LoginGraceTime 20
X11Forwarding no
AllowTcpForwarding no                # bật riêng cho bastion nếu cần
ClientAliveInterval 300
ClientAliveCountMax 2
```

```bash
sudo sshd -t && sudo systemctl reload ssh     # kiểm tra cú pháp TRƯỚC khi reload
```

> Luôn giữ một phiên SSH đang mở khi đổi cấu hình SSH/tường lửa và thử đăng nhập bằng phiên thứ hai. Tự khóa mình ngoài server là sự cố rất phổ biến.

- Key: `ssh-keygen -t ed25519`. Thu hồi key khi nhân viên nghỉ.
- Production: không mở SSH ra Internet; vào qua bastion/VPN hoặc dịch vụ quản lý của cloud (AWS SSM Session Manager, GCP IAP).
- `fail2ban` chặn IP dò mật khẩu: hữu ích khi SSH buộc phải mở công khai; nếu đã tắt password auth và đứng sau VPN thì giá trị giảm.

## 5. Tường lửa

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 10.0.0.0/16 to any port 22 proto tcp   # SSH chỉ từ mạng nội bộ
sudo ufw allow 80,443/tcp                                   # chỉ trên máy chạy Nginx/LB
sudo ufw allow from 10.0.1.0/24 to any port 3000 proto tcp # API chỉ nhận từ subnet LB
sudo ufw enable
sudo ufw status numbered
```

- ufw là lớp giao diện trên nftables (Ubuntu 24.04). Quy tắc phức tạp viết trực tiếp nftables.
- Trên cloud, security group/NACL là tường lửa chính; ufw là lớp phòng thủ thứ hai.
- **Docker bỏ qua ufw**: cổng publish bằng `-p 5432:5432` mở ra mọi interface dù ufw chặn. Bind rõ `-p 127.0.0.1:5432:5432` hoặc không publish cổng DB.
- PostgreSQL/Redis **không bao giờ** mở ra Internet.

## 6. CPU và load average

`uptime` → `load average: 3.2, 2.9, 2.5` (1, 5, 15 phút).

- Load = số tác vụ đang chạy **hoặc chờ CPU, hoặc chờ I/O không ngắt được (trạng thái D)** trên Linux.
- So với số core (`nproc`). Load 8 trên máy 8 core = đầy; 16 = có hàng đợi.
- Load cao nhưng CPU `%us` thấp → thường là chờ I/O (`%wa` cao, process trạng thái `D`) → nhìn đĩa/NFS, không phải CPU.
- `%st` (steal) cao trên VM → máy vật lý bị chia sẻ quá tải; đổi loại instance.
- Node chỉ dùng 1 core cho JS: máy 8 core cần nhiều process (cluster, PM2, hoặc nhiều container/pod).

## 7. Bộ nhớ

`free -h`:

```
               total   used   free  shared  buff/cache  available
Mem:            15Gi   6.1Gi  0.4Gi  0.2Gi      9.0Gi       8.9Gi
```

- Nhìn **`available`**, không nhìn `free`. Linux dùng RAM trống làm page cache (cache file) và trả lại khi cần. "free thấp" là bình thường.
- **Swap:** trên server ứng dụng, swap nhỏ hoặc không có để lỗi lộ ra sớm thay vì chậm dần. Trên máy DB, theo khuyến nghị của DB (PostgreSQL: ít swap, `vm.swappiness` thấp như 1–10).
- **OOM killer:** khi hết bộ nhớ, kernel giết process có điểm `oom_score` cao nhất. Dấu hiệu: `dmesg -T | grep -i -E 'killed process|out of memory'`, `journalctl -k`.
- **cgroups v2** (mặc định Ubuntu 24.04): `MemoryMax` trong systemd/`--memory` trong Docker/`limits.memory` trong Kubernetes giới hạn theo nhóm → OOM chỉ giết process trong nhóm đó.
- Node: heap V8 có giới hạn riêng. Đặt `--max-old-space-size` khoảng 70–75% giới hạn bộ nhớ container để GC chạy trước khi bị cgroup giết.
- Rò rỉ bộ nhớ: RSS tăng đều theo thời gian không giảm sau GC → lấy heap snapshot, đừng chỉ tăng RAM.

## 8. Đĩa

```bash
df -h            # dung lượng theo filesystem
df -i            # inode – hết inode thì không tạo được file dù còn dung lượng
du -sh /var/* | sort -h
iostat -xz 1     # %util, await (ms), r/s, w/s theo thiết bị
```

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `df` báo đầy, `du` không thấy file lớn | File đã xóa nhưng process vẫn mở (log bị `rm` khi app còn ghi) | `sudo lsof +L1` tìm process; restart nó hoặc truncate qua `/proc/<pid>/fd/<n>`. Dùng logrotate với `copytruncate` hoặc reopen bằng tín hiệu thay vì `rm` |
| "No space left" nhưng `df -h` còn trống | Hết inode (hàng triệu file nhỏ: session file, cache) | `df -i`; dọn file nhỏ; đổi thiết kế lưu trữ |
| `await` cao, `%util` ~100% | Đĩa bão hòa (DB, log quá nhiều) | Giảm log, tách đĩa, nâng IOPS (gp3/io2), thêm RAM cho cache |
| Đĩa đầy vì log | Không xoay vòng log | logrotate, `SystemMaxUse` cho journald, giới hạn log driver Docker |

Cảnh báo dung lượng ở ngưỡng 80% và 90%, cảnh báo theo **tốc độ đầy** ("đầy sau 4 giờ nữa") tốt hơn ngưỡng cố định.

## 9. File descriptor và ulimit

Mỗi kết nối TCP, file, pipe = 1 fd. API giữ 10.000 kết nối WebSocket cần ≥ 10.000 fd + kết nối DB/Redis.

```bash
ulimit -n                          # giới hạn của shell hiện tại (thường 1024)
cat /proc/<pid>/limits | grep -i 'open files'   # giới hạn THỰC của process đang chạy
ls /proc/<pid>/fd | wc -l          # số fd đang dùng
cat /proc/sys/fs/file-nr           # toàn hệ thống: đang dùng / - / tối đa
```

- Với systemd: đặt `LimitNOFILE=` trong unit (sửa `/etc/security/limits.conf` **không** áp dụng cho service systemd).
- Lỗi `EMFILE: too many open files` → kiểm tra giới hạn **và** rò rỉ fd (kết nối không đóng). Tăng giới hạn mà không sửa rò rỉ chỉ hoãn sự cố.

## 10. Tinh chỉnh kernel cho máy nhiều kết nối

`/etc/sysctl.d/90-learnhub.conf` (áp dụng: `sudo sysctl --system`):

```
net.core.somaxconn = 4096                 # hàng đợi accept tối đa; app phải đặt backlog tương ứng (Nginx: listen ... backlog=4096)
net.ipv4.tcp_max_syn_backlog = 8192       # hàng đợi kết nối đang bắt tay
net.ipv4.ip_local_port_range = 10240 65535 # nhiều cổng nguồn hơn cho kết nối ra (proxy → upstream)
net.ipv4.tcp_tw_reuse = 1                 # dùng lại socket TIME_WAIT cho kết nối RA (an toàn với timestamps)
net.ipv4.tcp_fin_timeout = 15
net.core.netdev_max_backlog = 16384
fs.file-max = 2097152
vm.swappiness = 10
```

Cảnh báo:
- **Đừng chép cấu hình sysctl từ blog mà không hiểu.** Mỗi dòng phải trả lời được "giải quyết vấn đề đo được nào".
- `net.ipv4.tcp_tw_recycle` **đã bị xóa** từ kernel 4.12 và từng gây lỗi kết nối sau NAT — agent/blog cũ vẫn hay đề xuất.
- Hết cổng nguồn (ephemeral port exhaustion) thường do **không dùng keep-alive** giữa proxy và upstream; sửa bằng keepalive pool trước khi chỉnh kernel (xem [03-load-balancer-reverse-proxy.md](03-load-balancer-reverse-proxy.md)).
- Kiểm tra tràn hàng đợi: `nstat -az | grep -i -E 'ListenOverflows|ListenDrops'`, `ss -lnt` (cột Recv-Q của socket LISTEN = hàng đợi accept đang dồn).

## 11. Đồng bộ thời gian

Lệch giờ làm hỏng: JWT `exp`/`nbf`, chứng chỉ TLS, thứ tự log khi điều tra, TOTP, lịch chạy job, giờ làm bài kiểm tra.

```bash
timedatectl                     # "System clock synchronized: yes"
chronyc tracking                # độ lệch hiện tại
chronyc sources -v
```

Ubuntu 24.04 dùng chrony (hoặc systemd-timesyncd). Trên cloud, trỏ tới nguồn NTP của nhà cung cấp. Server để múi giờ **UTC**; chuyển sang giờ Việt Nam ở tầng hiển thị.

## 12. Cập nhật bảo mật

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
cat /var/run/reboot-required 2>/dev/null   # có file này = cần reboot (kernel/libc mới)
```

- Bật tự động cho bản vá bảo mật; nâng cấp phiên bản lớn làm có kế hoạch.
- Kernel mới chỉ có hiệu lực sau reboot → lên lịch reboot cuốn chiếu (từng máy, sau LB) hoặc thay máy bằng image mới (immutable infrastructure).
- Tốt hơn: build image (Packer/container) đã vá, triển khai lại, không vá tay từng máy.

## 13. Hộp đồ nghề chẩn đoán

| Công cụ | Trả lời câu hỏi |
|---|---|
| `top` / `htop` | Process nào ăn CPU/RAM; trạng thái R/S/D/Z |
| `vmstat 1` | `r` (hàng đợi CPU), `si/so` (swap), `wa` (chờ I/O), `cs` (context switch) |
| `mpstat -P ALL 1` | Một core bị dồn tải (ứng dụng đơn luồng, ngắt mạng)? |
| `iostat -xz 1` | Đĩa nào chậm/bão hòa |
| `pidstat 1` | CPU theo process theo thời gian |
| `free -h`, `dmesg -T` | Bộ nhớ, OOM, lỗi phần cứng/kernel |
| `ss -tanp`, `ss -s` | Kết nối TCP theo trạng thái, ai mở cổng nào |
| `lsof -p <pid>`, `lsof -i :3000` | File/socket một process đang mở |
| `strace -f -p <pid> -c` | Process đang kẹt ở syscall nào (**làm chậm process đáng kể** — dùng ngắn trên production) |
| `perf top`, `perf record -g` | Hàm nào ăn CPU (flame graph) |
| `journalctl -u <svc>` | Log dịch vụ |

### Phân tích trong 60 giây (theo phương pháp phổ biến của Brendan Gregg)

```bash
uptime                 # 1. tải tăng hay giảm?
dmesg -T | tail        # 2. OOM, lỗi đĩa, lỗi mạng?
vmstat 1 5             # 3. hàng đợi CPU, swap, chờ I/O
mpstat -P ALL 1 3      # 4. phân bổ CPU theo core
pidstat 1 3            # 5. process nào
iostat -xz 1 3         # 6. đĩa
free -h                # 7. bộ nhớ
sar -n DEV 1 3         # 8. băng thông mạng theo card
sar -n TCP,ETCP 1 3    # 9. kết nối TCP mới, retransmit
top                    # 10. tổng quan
```

(`sar`, `mpstat`, `pidstat`, `iostat` thuộc gói `sysstat`.)

Phương pháp **USE** cho mỗi tài nguyên (CPU, RAM, đĩa, mạng): **U**tilization (đang dùng bao nhiêu), **S**aturation (có hàng đợi không), **E**rrors (có lỗi không).

## 14. Câu chuyện sự cố mẫu

**Triệu chứng:** 2 giờ sáng, API LearnHub trả 502 hàng loạt.
**Điều tra:** `systemctl status` → service restart liên tục. `journalctl` → `ENOSPC`. `df -h` → `/` đầy 100%, nhưng `du` chỉ thấy 40%. `lsof +L1` → file log 60 GB đã bị cron `rm` nhưng process vẫn ghi.
**Sửa tạm:** restart service để giải phóng file. **Sửa gốc:** logrotate với `copytruncate`, log ra stdout → journald có giới hạn, cảnh báo đĩa 80%.
**Bài học:** không `rm` file log đang mở; mọi nguồn log phải có giới hạn.

## 15. Lỗi agent hay mắc trên server

| Đề xuất của agent | Vì sao sai | Làm đúng |
|---|---|---|
| `chmod -R 777 /opt/app` | Ai cũng ghi/thực thi được → leo thang quyền | Đúng owner + quyền tối thiểu |
| Chạy service bằng `root` "cho nhanh" | Lỗ hổng app = chiếm cả máy | User riêng + hardening systemd |
| `ufw disable`, `setenforce 0`, tắt AppArmor để "sửa" lỗi kết nối | Xóa lớp phòng thủ; lỗi gốc vẫn còn | Đọc log, thêm rule cụ thể |
| `kill -9` thay vì `systemctl stop` | Mất dữ liệu đang xử lý | `systemctl stop/restart` |
| Chép sysctl dài từ Internet, có `tcp_tw_recycle` | Tham số không còn tồn tại / gây lỗi NAT | Chỉnh từng tham số theo số liệu đo |
| `curl ... \| sudo bash` | Chạy mã chưa kiểm tra với quyền root | Tải về, đọc, kiểm checksum, dùng gói chính thức |
| Đặt bí mật vào `Environment=` trong unit commit lên Git | Lộ bí mật | `EnvironmentFile` quyền 640 hoặc secret manager |
| Mở cổng 5432/6379 ra 0.0.0.0 | DB bị quét và chiếm | Chỉ mạng nội bộ, security group |

## Checklist review

- [ ] Service chạy bằng user riêng, không phải root; có `NoNewPrivileges`, `ProtectSystem` và các tùy chọn hardening; `systemd-analyze security` đã xem.
- [ ] Có `Restart=on-failure` kèm giới hạn khởi động lại; `TimeoutStopSec` khớp thời gian graceful shutdown của app.
- [ ] App xử lý `SIGTERM`: ngừng nhận request, chờ request đang chạy, đóng pool, thoát trước hạn.
- [ ] `LimitNOFILE`, `MemoryMax` đặt theo số đo; Node `--max-old-space-size` thấp hơn giới hạn bộ nhớ.
- [ ] Không có `chmod 777`, `chown -R root`, tắt tường lửa/AppArmor/SELinux trong script hay tài liệu.
- [ ] SSH: chỉ key, cấm root, không mở Internet (hoặc qua bastion/VPN); đã thử đăng nhập bằng phiên thứ hai sau khi đổi.
- [ ] Tường lửa mặc định deny incoming; DB/Redis chỉ nhận từ mạng nội bộ; Docker không publish cổng DB ra 0.0.0.0.
- [ ] Log có xoay vòng/giới hạn; cảnh báo đĩa và inode.
- [ ] Mỗi tham số sysctl có lý do và số liệu đo; không có `tcp_tw_recycle`.
- [ ] Đồng bộ thời gian bật; múi giờ UTC.
- [ ] Bản vá bảo mật tự động; có kế hoạch reboot hoặc thay image.
- [ ] Bí mật không nằm trong unit file, script hay Git.
