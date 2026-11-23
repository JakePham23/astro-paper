---
title: "Container và Docker"
description: "hiểu container thực chất là gì, viết Dockerfile production cho API LearnHub, xử lý tín hiệu/PID 1, giới hạn tài nguyên, quét và ký image, quản lý tag, và dựng môi trường dev..."
pubDatetime: 2026-11-18T02:00:00Z
featured: false
tags:
  - devops
  - infrastructure
  - docker
---
# Container và Docker

**Mục đích:** hiểu container thực chất là gì, viết Dockerfile production cho API LearnHub, xử lý tín hiệu/PID 1, giới hạn tài nguyên, quét và ký image, quản lý tag, và dựng môi trường dev bằng docker compose.
**Liên quan:** [01-linux-server.md](01-linux-server.md) · [05-kubernetes.md](05-kubernetes.md) · [06-ci-cd-iac.md](06-ci-cd-iac.md) · [09-checklist-review-ha-tang.md](09-checklist-review-ha-tang.md) · [../05-backend-senior/11-bao-mat.md](../05-backend-senior/11-bao-mat.md)

---

## 1. Container khác máy ảo thế nào

| | Máy ảo (VM) | Container |
|---|---|---|
| Cô lập bằng | Hypervisor, kernel riêng | **Namespaces + cgroups** của cùng một kernel Linux |
| Khởi động | Chục giây – phút | Mili giây – giây |
| Kích thước | GB | MB – vài trăm MB |
| Ranh giới bảo mật | Mạnh | Yếu hơn: lỗ hổng kernel/runtime có thể thoát container |
| Dùng khi | Cô lập nhiều khách hàng, hệ điều hành khác | Đóng gói ứng dụng, triển khai nhất quán |

- **Namespaces** cho container "góc nhìn riêng": `pid` (PID riêng, process chính là PID 1), `net` (card mạng riêng), `mnt` (filesystem riêng), `uts` (hostname), `ipc`, `user` (ánh xạ UID), `cgroup`.
- **cgroups v2** giới hạn và đo tài nguyên: CPU, bộ nhớ, I/O, số PID.
- Image = các lớp filesystem chỉ đọc xếp chồng (overlayfs) + metadata. Container = image + một lớp ghi tạm. **Xóa container = mất lớp ghi** → dữ liệu cần giữ phải ở volume hoặc dịch vụ bên ngoài.
- Container không phải ranh giới bảo mật mạnh: chạy non-root, bỏ capability, read-only filesystem, cập nhật kernel/runtime. Cần cô lập mạnh (chạy code người dùng nộp lên – chấm bài lập trình) → gVisor, Kata Containers, Firecracker microVM (xem [../05-backend-senior/06-module-bai-kiem-tra-cham-bai.md](../05-backend-senior/06-module-bai-kiem-tra-cham-bai.md)).

## 2. Dockerfile production cho API Node

```dockerfile
# syntax=docker/dockerfile:1.7

############ Stage 1: cài dependency và build ############
# Ghim theo digest: tag có thể bị ghi đè, digest thì không.
# Lấy digest: docker buildx imagetools inspect node:22-bookworm-slim
FROM node:22-bookworm-slim@sha256:<digest> AS build
WORKDIR /app

# Chỉ copy file khai báo dependency trước → lớp cache này chỉ bị build lại khi dependency đổi
COPY package.json package-lock.json ./
# npm ci: cài đúng theo lockfile, thất bại nếu lockfile lệch. Cache npm qua BuildKit cache mount.
RUN --mount=type=cache,target=/root/.npm npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
 && npm prune --omit=dev          # bỏ devDependencies sau khi build

############ Stage 2: runtime tối giản ############
# distroless: không có shell, không có package manager → bề mặt tấn công nhỏ.
# Có tag :nonroot chạy bằng UID 65532.
FROM gcr.io/distroless/nodejs22-debian12:nonroot@sha256:<digest> AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=build --chown=nonroot:nonroot /app/dist ./dist
COPY --chown=nonroot:nonroot package.json ./

USER nonroot
EXPOSE 3000
# Image distroless nodejs có ENTRYPOINT là node → CMD chỉ là đối số
CMD ["--max-old-space-size=768", "dist/server.js"]
```

Giải thích quyết định:

| Quyết định | Lý do |
|---|---|
| Multi-stage | Image chạy không chứa compiler, source TS, devDependencies, cache npm → nhỏ hơn nhiều lần, ít lỗ hổng |
| Ghim digest | Build tái lập được; không bị đổi base âm thầm. Dùng Renovate/Dependabot để cập nhật digest có kiểm soát |
| Copy lockfile trước source | Tận dụng cache lớp: sửa code không phải cài lại dependency |
| `npm ci` thay `npm install` | Đúng lockfile, nhanh, không sửa lockfile |
| Non-root | Lỗ hổng trong app không có quyền root trong container |
| distroless | Không shell → kẻ tấn công khó thao tác; nhược điểm: không `exec sh` để gỡ lỗi (dùng `kubectl debug` với container tạm) |
| Không có `HEALTHCHECK` | Kubernetes dùng probe riêng và bỏ qua `HEALTHCHECK` của Dockerfile; image distroless không có `curl`. Khi chạy Docker/compose thuần thì khai báo healthcheck ở compose |

Phương án thay distroless: `node:22-bookworm-slim` + `USER node` (dễ gỡ lỗi hơn, lớn hơn) hoặc Alpine (nhỏ, nhưng dùng musl — một số module native và hành vi DNS khác; thử kỹ trước khi chọn).

### `.dockerignore`

```
.git
node_modules
dist
coverage
*.log
.env
.env.*
Dockerfile*
docker-compose*.yml
tests
docs
```

Thiếu `.dockerignore`: build context lớn và chậm, và **`.env`/`.git` có thể bị copy vào image** qua `COPY . .`.

## 3. PID 1 và tín hiệu

Process là PID 1 trong container có hai đặc điểm:
1. Kernel **không áp dụng hành vi mặc định** của tín hiệu cho PID 1: nếu app không tự đăng ký handler `SIGTERM`, tín hiệu bị bỏ qua → `docker stop` chờ hết hạn (mặc định 10 s) rồi `SIGKILL`.
2. PID 1 phải dọn process con mồ côi (zombie).

Cách xử lý:
- Dùng dạng **exec** (`CMD ["node", "dist/server.js"]`), **không** dạng shell (`CMD node dist/server.js` → chạy qua `/bin/sh -c`, shell là PID 1 và thường không chuyển tín hiệu).
- Không bọc bằng `npm start` (npm có thể không chuyển tiếp tín hiệu đúng như mong đợi).
- App tự xử lý `SIGTERM` (xem [01-linux-server.md](01-linux-server.md) mục 1).
- Nếu app sinh process con: dùng init nhỏ `tini` (`docker run --init`, hoặc `ENTRYPOINT ["/usr/bin/tini","--"]` trong image có tini).

## 4. Giới hạn tài nguyên

```bash
docker run --memory=1g --memory-swap=1g --cpus=1.5 --pids-limit=256 \
  --read-only --tmpfs /tmp:rw,size=64m \
  --cap-drop=ALL --security-opt=no-new-privileges \
  learnhub/api:1.8.3
```

- Không giới hạn bộ nhớ → một container rò rỉ làm OOM cả máy.
- Node ≥ 20 nhận biết giới hạn cgroup khi tính heap mặc định, nhưng đặt `--max-old-space-size` rõ ràng (~70–75% giới hạn) vẫn dễ dự đoán hơn.
- `--pids-limit` chặn fork bomb.
- `--read-only` + tmpfs cho chỗ cần ghi: chặn kẻ tấn công ghi file thực thi.

## 5. Quét lỗ hổng, SBOM, ký image

```bash
# Quét lỗ hổng (chạy trong CI, chặn merge khi có CRITICAL/HIGH có bản sửa)
trivy image --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 registry.example/learnhub/api:1.8.3
grype registry.example/learnhub/api:1.8.3

# Quét Dockerfile/IaC sai cấu hình
trivy config .

# SBOM (danh sách thành phần) — lưu cùng release để tra cứu khi có CVE mới
syft registry.example/learnhub/api:1.8.3 -o spdx-json > sbom.spdx.json

# Ký image và xác minh (Sigstore cosign, ký keyless qua OIDC của CI)
cosign sign registry.example/learnhub/api@sha256:<digest>
cosign verify registry.example/learnhub/api@sha256:<digest> \
  --certificate-identity-regexp '<workflow-identity>' \
  --certificate-oidc-issuer '<ci-oidc-issuer>'
```

- Ký theo **digest**, không theo tag.
- Cluster chỉ chạy image đã ký từ registry nội bộ (policy controller: Kyverno, Sigstore policy-controller).
- Lỗ hổng "không có bản sửa" vẫn cần đánh giá: có thực sự nằm trên đường chạy không; ghi lại quyết định chấp nhận.

## 6. Registry và tag

| Thực hành | Lý do |
|---|---|
| **Không dùng `latest` trong production** | Không biết đang chạy phiên bản nào; rollback không xác định; node khác nhau kéo bản khác nhau |
| Tag bất biến: `1.8.3`, `git-<sha>` | Truy vết ngược về commit |
| Triển khai theo digest (`@sha256:...`) | Chắc chắn đúng nội dung đã quét và ký |
| Bật immutable tags trên registry (ECR, Harbor…) | Không ai ghi đè được tag đã phát hành |
| Registry riêng, gần cluster | Tốc độ kéo, không phụ thuộc rate limit Docker Hub, kiểm soát truy cập |
| Chính sách dọn image cũ | Giữ N bản gần nhất + mọi bản đang chạy |
| Build một lần, promote qua môi trường | Image chạy ở staging chính là image chạy ở production; khác nhau chỉ ở cấu hình |

## 7. docker compose cho môi trường dev LearnHub

`compose.yaml`:

```yaml
services:
  api:
    build:
      context: .
      target: build                 # dùng stage build để có devDependencies, hot reload
    command: ["npm", "run", "dev"]
    ports:
      - "127.0.0.1:3000:3000"       # chỉ mở trên localhost của máy dev
    env_file: .env.local            # file KHÔNG commit; có .env.example với khóa rỗng
    environment:
      DATABASE_URL: postgres://learnhub:${POSTGRES_PASSWORD:?đặt trong .env.local}@db:5432/learnhub
      REDIS_URL: redis://redis:6379
    volumes:
      - ./src:/app/src              # bind mount để sửa code không cần build lại
    depends_on:
      db:
        condition: service_healthy  # chờ DB sẵn sàng thật, không chỉ "đã khởi động"
      redis:
        condition: service_healthy
    init: true                      # tini làm PID 1

  db:
    image: postgres:17.2-bookworm   # ghim phiên bản cụ thể, khớp production
    environment:
      POSTGRES_USER: learnhub
      POSTGRES_DB: learnhub
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?đặt trong .env.local}
    ports:
      - "127.0.0.1:5432:5432"       # KHÔNG "5432:5432": Docker bỏ qua ufw và mở ra mọi interface
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d:ro   # chỉ chạy ở lần khởi tạo đầu tiên
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U learnhub -d learnhub"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7.4-bookworm
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  pgdata:
  redisdata:
```

```bash
docker compose up -d
docker compose ps                 # trạng thái + health
docker compose logs -f api
docker compose exec db psql -U learnhub
docker compose down               # giữ volume
docker compose down -v            # XÓA volume = mất dữ liệu dev
```

- `depends_on` không kèm `condition: service_healthy` chỉ đợi container **bắt đầu**, không đợi DB sẵn sàng → app lỗi kết nối lúc khởi động. App vẫn nên tự retry kết nối có backoff.
- Compose dành cho dev/test và máy đơn lẻ nhỏ; production nhiều máy dùng Kubernetes/ECS (xem [05-kubernetes.md](05-kubernetes.md)).
- Phiên bản Postgres/Redis trong dev nên khớp production để tránh khác biệt hành vi.

## 8. Volume và dữ liệu

| Loại | Dùng cho | Lưu ý |
|---|---|---|
| Named volume | Dữ liệu DB dev, cache | Docker quản lý; sống qua `down`, mất khi `down -v` |
| Bind mount | Mã nguồn khi dev | Quyền UID host vs container có thể lệch; chậm trên Windows/macOS khi nhiều file (đặt repo trong WSL2 trên Windows) |
| tmpfs | File tạm, bí mật trong RAM | Mất khi dừng |

Production: **DB chạy trong container trên một máy đơn có volume cục bộ là rủi ro** (mất máy = mất dữ liệu nếu không sao lưu). Ưu tiên dịch vụ DB quản lý (RDS, Cloud SQL) hoặc operator chuyên dụng có sao lưu/replica (xem [../06-database-chuyen-sau/](../06-database-chuyen-sau/)).

## 9. Log

- App ghi log ra **stdout/stderr** (JSON một dòng), không ghi file trong container.
- Driver mặc định `json-file` **không giới hạn dung lượng** → đầy đĩa. Cấu hình `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "50m", "max-file": "5" }
}
```

  (hoặc driver `local`, có nén và xoay vòng sẵn). Trên Kubernetes, kubelet xoay vòng log và agent (Fluent Bit, Vector, OpenTelemetry Collector) gửi đi tập trung.

## 10. Bí mật không được nằm trong image

| Sai | Vì sao | Đúng |
|---|---|---|
| `COPY .env .` | Ai kéo được image là đọc được | Truyền lúc chạy: secret manager, Kubernetes Secret (mã hóa at rest), biến môi trường do orchestrator cấp |
| `ARG NPM_TOKEN` rồi `RUN npm ci` | Giá trị ARG lộ trong `docker history`/metadata | `RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci` và `docker build --secret id=npmrc,src=$HOME/.npmrc` |
| `RUN echo <token> > f && ... && rm f` ở lệnh sau | Lớp trước vẫn chứa file | Secret mount BuildKit |
| `ENV DB_PASSWORD=...` trong Dockerfile | Nằm trong image config | Cấp lúc runtime |

Kiểm tra: `docker history --no-trunc <image>`, `docker image inspect <image>`, và gitleaks/trivy secret scan trên image.

Biến môi trường cũng có rủi ro (lộ qua `/proc/<pid>/environ`, log crash, `docker inspect`). Với bí mật nhạy cảm, mount dưới dạng file chỉ đọc hoặc lấy từ secret manager khi khởi động.

## 11. Lỗi agent hay mắc với Docker

| Đề xuất | Vấn đề | Đúng |
|---|---|---|
| `FROM node:latest` | Không tái lập, bản lớn không mong muốn | Ghim phiên bản + digest |
| Chạy root, `--privileged`, mount `/var/run/docker.sock` | Chiếm container = chiếm host | Non-root, bỏ capability; không mount docker.sock trừ công cụ đã duyệt |
| `COPY . .` không có `.dockerignore` | Lộ `.env`, `.git`; image phình | `.dockerignore` + copy chọn lọc |
| `npm install` trong Dockerfile | Lệch lockfile | `npm ci` |
| `CMD npm start` dạng shell | Không nhận SIGTERM | Dạng exec, gọi node trực tiếp |
| `ports: "5432:5432"` | DB mở ra mạng bất chấp ufw | `127.0.0.1:` hoặc không publish |
| `chmod -R 777 /app` để sửa lỗi quyền volume | Mở toàn quyền | `--chown`, đúng UID |
| `HEALTHCHECK curl ...` trên image không có curl | Health luôn fail | Healthcheck bằng công cụ có sẵn hoặc probe của orchestrator |
| `docker system prune -a --volumes` để giải phóng đĩa | Xóa volume dữ liệu | Dọn có chọn lọc, xem trước |

## Checklist review

- [ ] Base image ghim phiên bản và digest; có cơ chế cập nhật tự động có review.
- [ ] Multi-stage; image runtime không có compiler, source, devDependencies, cache.
- [ ] `.dockerignore` loại `.git`, `.env*`, `node_modules`, test.
- [ ] Chạy non-root; không `--privileged`; capability tối thiểu; cân nhắc read-only root filesystem.
- [ ] `CMD`/`ENTRYPOINT` dạng exec; app xử lý SIGTERM; có init nếu sinh process con.
- [ ] Giới hạn bộ nhớ/CPU/PID; heap Node thấp hơn giới hạn.
- [ ] Không có bí mật trong Dockerfile, ARG, ENV, lớp image (đã kiểm `docker history`).
- [ ] CI quét lỗ hổng và chặn mức CRITICAL/HIGH có bản sửa; có SBOM; image được ký và xác minh theo digest.
- [ ] Không dùng tag `latest`; triển khai theo digest/tag bất biến; build một lần, promote qua các môi trường.
- [ ] Compose: cổng DB/Redis chỉ bind `127.0.0.1`; `depends_on` có `service_healthy`; bí mật trong file không commit.
- [ ] Log ra stdout có giới hạn xoay vòng.
- [ ] Dữ liệu cần giữ nằm ngoài lớp ghi của container và có sao lưu.
