---
title: "Checklist duyệt thay đổi AWS do agent đề xuất"
description: "duyệt IAM policy, cấu hình mạng, tài nguyên dữ liệu, pipeline và kiến trúc AWS trước khi áp dụng."
pubDatetime: 2026-11-17T07:00:00Z
featured: false
tags:
  - aws
  - cloud
  - checklist
---
# Checklist duyệt thay đổi AWS do agent đề xuất

**Mục đích:** duyệt IAM policy, cấu hình mạng, tài nguyên dữ liệu, pipeline và kiến trúc AWS trước khi áp dụng.
**Liên quan:** [00-README.md](00-README.md) · [01-tai-khoan-iam-organizations.md](01-tai-khoan-iam-organizations.md) · [07-bao-mat-aws.md](07-bao-mat-aws.md) · [11-chi-phi-finops.md](11-chi-phi-finops.md) · [../07-he-thong-server/09-checklist-review-ha-tang.md](../07-he-thong-server/09-checklist-review-ha-tang.md)

🔴 = vi phạm thì từ chối.

## A. IAM và tài khoản

- [ ] 🔴 Không `"Action": "*"` hoặc `"Resource": "*"` kèm hành động ghi/xóa, trừ khi có lý do được ghi rõ và giới hạn bằng điều kiện.
- [ ] 🔴 Không tạo IAM user có access key dài hạn cho ứng dụng hoặc CI — dùng role (ECS task role, IRSA/Pod Identity, OIDC).
- [ ] 🔴 Không dùng tài khoản root cho công việc thường ngày.
- [ ] Policy giới hạn theo tài nguyên cụ thể (ARN) và điều kiện (`aws:PrincipalOrgID`, `aws:SourceVpce`, `aws:SecureTransport`…).
- [ ] Trust policy của role chỉ cho đúng principal (OIDC: giới hạn repo **và** nhánh/environment).
- [ ] Đã chạy IAM Access Analyzer kiểm tra policy mới.

## B. Mạng

- [ ] 🔴 Không mở `0.0.0.0/0` vào cổng 22, 3389, 5432, 6379 hoặc cổng quản trị.
- [ ] Database, cache, worker nằm trong private subnet, không có public IP.
- [ ] Security group tham chiếu security group khác thay vì dải IP rộng.
- [ ] Truy cập S3/DynamoDB từ VPC dùng gateway endpoint (tiết kiệm chi phí NAT).
- [ ] Truy cập máy dùng Session Manager thay vì SSH mở ra ngoài.
- [ ] CIDR không chồng lấn với VPC/mạng nội bộ khác.

## C. Dữ liệu

- [ ] 🔴 S3 Block Public Access bật; truy cập nội dung công khai qua CloudFront + OAC.
- [ ] 🔴 RDS/Aurora: không public, có mã hóa, deletion protection, backup tự động với retention phù hợp.
- [ ] Bucket quan trọng bật versioning; cân nhắc Object Lock cho backup.
- [ ] Mật khẩu DB trong Secrets Manager (hoặc RDS-managed), không trong biến môi trường plain text của task definition hay Terraform.
- [ ] Multi-AZ cho DB production.

## D. Bảo mật và giám sát

- [ ] CloudTrail cấp organization bật, log lưu ở tài khoản log riêng.
- [ ] GuardDuty, Security Hub bật cho tài khoản mới.
- [ ] Dịch vụ mới có alarm CloudWatch cho lỗi, độ trễ, và bão hòa tài nguyên.
- [ ] Log group có retention (không để "Never expire" mặc định).
- [ ] Dữ liệu nhạy cảm mã hóa bằng KMS key phù hợp, key policy không quá rộng.

## E. Độ tin cậy

- [ ] Tài nguyên trải trên ≥ 2 AZ (khuyến nghị 3 cho production).
- [ ] Auto Scaling có min/max hợp lý; scheduled scaling cho đỉnh tải đã biết (giờ thi).
- [ ] Service quotas đủ cho đỉnh tải (kiểm tra trước sự kiện lớn).
- [ ] RPO/RTO của thay đổi đã được ghi và đáp ứng bởi backup/DR hiện có.

## F. Chi phí

- [ ] Ước tính chi phí hàng tháng có trong đề xuất (AWS Pricing Calculator).
- [ ] Đã tính chi phí ẩn: NAT Gateway, truyền dữ liệu giữa AZ và ra internet, CloudWatch Logs, IPv4 công khai.
- [ ] Tài nguyên có tag bắt buộc (`Project`, `Environment`, `Owner`, `CostCenter`).
- [ ] Môi trường dev/staging có lịch tắt hoặc cỡ nhỏ hơn.
- [ ] Budget và cảnh báo bất thường chi phí đã bật.

## Lỗi agent hay mắc với AWS

| Lỗi | Dấu hiệu |
|---|---|
| Policy quá rộng "cho chạy được" | `"Action": "s3:*"`, `"Resource": "*"` |
| Key dài hạn trong CI | `AWS_ACCESS_KEY_ID` trong secret của GitHub thay vì OIDC |
| Bịa tên dịch vụ/tham số | Thuộc tính Terraform/CloudFormation không có trong tài liệu — kiểm tra bằng `terraform validate`/`cfn-lint` |
| Quên chi phí NAT/egress | Kiến trúc nhiều luồng dữ liệu qua NAT, giữa các AZ |
| Thiết kế một AZ "cho đơn giản" | Subnet chỉ ở `ap-southeast-1a` |
| `terraform apply -auto-approve` trên production | Không có bước đọc plan |
| Tắt deletion protection để "dọn dẹp" | Rủi ro xóa nhầm DB production |
