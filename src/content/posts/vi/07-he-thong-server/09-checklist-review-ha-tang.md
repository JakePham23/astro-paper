---
title: "Checklist duyệt thay đổi hạ tầng do agent đề xuất"
description: "duyệt Dockerfile, manifest Kubernetes, cấu hình Nginx/server, pipeline CI/CD và Terraform trước khi áp dụng."
pubDatetime: 2026-11-17T21:00:00Z
featured: false
tags:
  - devops
  - infrastructure
  - checklist
---
# Checklist duyệt thay đổi hạ tầng do agent đề xuất

**Mục đích:** duyệt Dockerfile, manifest Kubernetes, cấu hình Nginx/server, pipeline CI/CD và Terraform trước khi áp dụng.
**Liên quan:** [00-README.md](00-README.md) · [04-container-docker.md](04-container-docker.md) · [05-kubernetes.md](05-kubernetes.md) · [06-ci-cd-iac.md](06-ci-cd-iac.md) · [../08-aws-cloud/13-checklist-review-aws.md](../08-aws-cloud/13-checklist-review-aws.md)

🔴 = vi phạm thì từ chối.

## A. Server Linux

- [ ] 🔴 Không `chmod 777`, không chạy dịch vụ bằng root khi không cần.
- [ ] 🔴 Không tắt firewall/AppArmor/SELinux để "sửa" lỗi.
- [ ] SSH chỉ dùng key, tắt đăng nhập root và mật khẩu.
- [ ] Dịch vụ chạy qua systemd có restart policy, giới hạn tài nguyên, các tùy chọn hardening.
- [ ] Thay đổi sysctl có giải thích và đo trước/sau, không chép nguyên bộ "tối ưu" từ internet.

## B. Container

- [ ] 🔴 Image gắn tag cố định hoặc digest, không `latest` cho production.
- [ ] 🔴 Không có bí mật trong Dockerfile, `ENV`, layer, hoặc file được COPY vào.
- [ ] Multi-stage build; image runtime tối thiểu; chạy user non-root.
- [ ] Xử lý tín hiệu đúng (SIGTERM → graceful shutdown), có `--init`/tini nếu cần.
- [ ] Có `.dockerignore`; image được quét lỗ hổng trong CI.

## C. Kubernetes

- [ ] 🔴 Không `privileged: true`, không `hostNetwork`/`hostPath` khi không có lý do rõ.
- [ ] 🔴 Secret không nằm dạng thường trong Git (base64 không phải mã hóa).
- [ ] Có `resources.requests` và `limits` (ít nhất memory limit).
- [ ] Có readiness probe (và liveness hợp lý — liveness không gọi DB).
- [ ] Rolling update + PodDisruptionBudget + nhiều replica trải trên nhiều node/zone.
- [ ] `preStop` + `terminationGracePeriodSeconds` đủ cho request đang xử lý.
- [ ] `securityContext`: `runAsNonRoot`, `readOnlyRootFilesystem`, bỏ capabilities.
- [ ] NetworkPolicy giới hạn ai được gọi ai.

## D. Load balancer / reverse proxy

- [ ] Timeout giữa các tầng nhất quán (LB idle timeout < keep-alive của app) để tránh 502.
- [ ] Chỉ tin `X-Forwarded-For` từ proxy đã biết.
- [ ] Giới hạn kích thước body, rate limit cho endpoint nhạy cảm.
- [ ] TLS chỉ phiên bản/cipher hiện đại; chứng chỉ tự gia hạn và có cảnh báo hết hạn.

## E. CI/CD

- [ ] 🔴 Không có khóa truy cập cloud dài hạn trong CI — dùng OIDC.
- [ ] Cùng một image digest được promote từ staging lên production.
- [ ] Pipeline có test, quét bảo mật, và cổng phê duyệt cho production.
- [ ] Thứ tự migration DB và deploy code rõ ràng (xem [../06-database-chuyen-sau/08-migration-schema-evolution.md](../06-database-chuyen-sau/08-migration-schema-evolution.md)).
- [ ] Có cách rollback được kiểm chứng.

## F. Terraform / IaC

- [ ] 🔴 Có `terraform plan` để người đọc **trước** `apply`; đọc kỹ các dòng `destroy`/`replace`.
- [ ] 🔴 State lưu remote có khóa, không commit state vào Git (state có thể chứa bí mật).
- [ ] Tài nguyên quan trọng (DB, bucket dữ liệu) có `prevent_destroy`/deletion protection.
- [ ] Phiên bản provider và module được khóa.
- [ ] Không mở `0.0.0.0/0` cho cổng quản trị hoặc database.

## Cách đọc một `terraform plan`

| Ký hiệu | Ý nghĩa | Mức chú ý |
|---|---|---|
| `+ create` | Tạo mới | Kiểm tra cấu hình bảo mật |
| `~ update in-place` | Sửa tại chỗ | Thường an toàn, đọc thuộc tính thay đổi |
| `-/+ replace` | Xóa rồi tạo lại | 🔴 Nguy hiểm với DB, volume, LB (mất dữ liệu/IP/downtime) |
| `- destroy` | Xóa | 🔴 Hỏi tại sao từng dòng |
