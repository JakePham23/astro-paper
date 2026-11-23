---
title: "Hệ thống server và hạ tầng – mục lục"
description: "kiến thức hạ tầng mức senior để thiết kế, vận hành và duyệt thay đổi hạ tầng (cấu hình server, Dockerfile, manifest Kubernetes, pipeline, Terraform) do agent viết."
pubDatetime: 2026-11-18T06:00:00Z
featured: true
tags:
  - devops
  - infrastructure
---
# Hệ thống server và hạ tầng – mục lục

**Mục đích:** kiến thức hạ tầng mức senior để thiết kế, vận hành và duyệt thay đổi hạ tầng (cấu hình server, Dockerfile, manifest Kubernetes, pipeline, Terraform) do agent viết.
**Ví dụ xuyên suốt:** LearnHub (Node API, PostgreSQL, Redis). Linux: Ubuntu 24.04 LTS. Kiến thức AWS cụ thể nằm ở [../08-aws-cloud/00-README.md](../08-aws-cloud/00-README.md).

## Mục lục

| # | File | Nội dung |
|---|---|---|
| 01 | [01-linux-server.md](01-linux-server.md) | Process, signal, systemd, SSH, firewall, CPU/RAM/disk, file descriptor, sysctl, công cụ chẩn đoán |
| 02 | [02-mang-network.md](02-mang-network.md) | TCP, DNS, TLS, HTTP/1.1–2–3, WebSocket, CIDR, CDN, công cụ debug mạng |
| 03 | [03-load-balancer-reverse-proxy.md](03-load-balancer-reverse-proxy.md) | L4/L7, thuật toán cân bằng tải, health check, Nginx cấu hình đầy đủ, HAProxy/Envoy, lỗi 502/504 |
| 04 | [04-container-docker.md](04-container-docker.md) | Dockerfile multi-stage, non-root, PID 1, quét image, compose cho dev |
| 05 | [05-kubernetes.md](05-kubernetes.md) | Khi nào cần K8s, manifest đầy đủ, probe, HPA, PDB, RBAC, NetworkPolicy, debug |
| 06 | [06-ci-cd-iac.md](06-ci-cd-iac.md) | Pipeline, promote image, chiến lược deploy, GitOps, Terraform, bí mật trong CI |
| 07 | [07-cloud-kien-truc.md](07-cloud-kien-truc.md) | Kiến trúc cloud trung lập nhà cung cấp, HA vs DR, chi phí, dữ liệu tại Việt Nam |
| 08 | [08-xu-ly-su-co-production.md](08-xu-ly-su-co-production.md) | Quy trình xử lý sự cố, runbook từng loại sự cố, postmortem |
| 09 | [09-checklist-review-ha-tang.md](09-checklist-review-ha-tang.md) | ★ Checklist duyệt thay đổi hạ tầng do agent đề xuất |

## Lộ trình đọc

1. **Nền tảng:** 01 → 02 → 03
2. **Đóng gói và chạy:** 04 → 05
3. **Đưa lên production:** 06 → 07
4. **Khi có sự cố:** 08
5. **Khi duyệt:** 09

## Nguyên tắc hạ tầng

1. **Mọi thứ là code** (IaC, config trong Git) — không sửa tay trên server production.
2. **Bất biến (immutable):** build image một lần, promote cùng một digest qua các môi trường.
3. **Không có server "thú cưng":** server/pod chết bất kỳ lúc nào hệ thống vẫn chạy.
4. **Quyền tối thiểu** ở mọi tầng: user Linux, container, IAM, mạng.
5. **Giảm thiểu trước, điều tra sau** khi có sự cố.
6. **Có đường lui** cho mọi thay đổi: rollback image, feature flag, snapshot.
