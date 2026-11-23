---
title: "AWS Cloud chuyên sâu (mức senior / solutions architect) – mục lục"
description: "thiết kế, vận hành và duyệt hạ tầng AWS cho hệ thống hàng triệu user. Khái niệm cloud chung (VPC, HA/DR, chi phí) ở ../07-he-thong-server/07-cloud-kien-truc.md; phần này đi sâu..."
pubDatetime: 2026-11-17T20:00:00Z
featured: true
tags:
  - aws
  - cloud
---
# AWS Cloud chuyên sâu (mức senior / solutions architect) – mục lục

**Mục đích:** thiết kế, vận hành và duyệt hạ tầng AWS cho hệ thống hàng triệu user. Khái niệm cloud chung (VPC, HA/DR, chi phí) ở [../07-he-thong-server/07-cloud-kien-truc.md](../07-he-thong-server/07-cloud-kien-truc.md); phần này đi sâu vào dịch vụ AWS cụ thể.
**Ví dụ xuyên suốt:** LearnHub, region chính `ap-southeast-1` (Singapore).

> Giá, giới hạn (quota) và tính năng AWS thay đổi thường xuyên. Mọi con số trong phần này để tham khảo thứ tự độ lớn — luôn kiểm tra AWS Pricing Calculator và tài liệu chính thức trước khi quyết định.

## Mục lục

| # | File | Nội dung |
|---|---|---|
| 01 | [01-tai-khoan-iam-organizations.md](01-tai-khoan-iam-organizations.md) | Nhiều tài khoản, Organizations, SCP, Identity Center, IAM policy evaluation, least privilege |
| 02 | [02-mang-vpc.md](02-mang-vpc.md) | VPC, subnet, NAT Gateway, VPC endpoint, Transit Gateway, PrivateLink, Route 53 |
| 03 | [03-compute-ec2-ecs-eks-lambda.md](03-compute-ec2-ecs-eks-lambda.md) | Chọn EC2 / ECS Fargate / EKS / Lambda, Auto Scaling, Spot, Graviton |
| 04 | [04-luu-tru-va-database.md](04-luu-tru-va-database.md) | S3, RDS vs Aurora, RDS Proxy, DynamoDB, ElastiCache, OpenSearch |
| 05 | [05-messaging-integration.md](05-messaging-integration.md) | SQS, SNS, EventBridge, Kinesis, MSK, Step Functions |
| 06 | [06-edge-cloudfront-alb-waf.md](06-edge-cloudfront-alb-waf.md) | CloudFront, ALB/NLB, API Gateway, WAF, Shield, ACM |
| 07 | [07-bao-mat-aws.md](07-bao-mat-aws.md) | KMS, Secrets Manager, CloudTrail, GuardDuty, Security Hub, phản ứng sự cố |
| 08 | [08-observability-van-hanh.md](08-observability-van-hanh.md) | CloudWatch, X-Ray/OpenTelemetry, Systems Manager, AWS Backup |
| 09 | [09-iac-ci-cd-aws.md](09-iac-ci-cd-aws.md) | CDK vs Terraform vs CloudFormation, GitHub Actions OIDC, deploy đa tài khoản |
| 10 | [10-ha-dr-well-architected.md](10-ha-dr-well-architected.md) | Multi-AZ, chiến lược DR đa region, Well-Architected 6 trụ cột |
| 11 | [11-chi-phi-finops.md](11-chi-phi-finops.md) | Mô hình giá, chi phí ẩn, Savings Plans, Spot, tagging, chi phí trên mỗi user |
| 12 | [12-kien-truc-learnhub-tren-aws.md](12-kien-truc-learnhub-tren-aws.md) | Kiến trúc tham chiếu end-to-end, luồng request, lộ trình mở rộng |
| 13 | [13-checklist-review-aws.md](13-checklist-review-aws.md) | ★ Checklist duyệt thay đổi AWS do agent đề xuất |

## Lộ trình đọc

1. **Nền móng bắt buộc:** 01 (tài khoản & IAM) → 02 (mạng)
2. **Chạy ứng dụng:** 03 → 04 → 05 → 06
3. **An toàn & vận hành:** 07 → 08 → 09
4. **Kiến trúc tổng thể:** 10 → 11 → 12
5. **Khi duyệt:** 13

## Bảy sai lầm AWS đắt giá nhất

| Sai lầm | Hậu quả | Đọc |
|---|---|---|
| Dùng tài khoản root / IAM user có access key lâu dài | Lộ key → mất kiểm soát tài khoản, hóa đơn khổng lồ | 01, 07 |
| Chạy mọi môi trường trong một tài khoản | Một lỗi ở dev ảnh hưởng prod; khó phân quyền | 01 |
| S3 bucket công khai | Lộ dữ liệu người dùng | 04, 07 |
| Security group mở `0.0.0.0/0` cho SSH/DB | Bị quét và tấn công trong vài phút | 02 |
| Lưu lượng qua NAT Gateway mà không dùng VPC endpoint | Hóa đơn xử lý dữ liệu NAT lớn bất ngờ | 02, 11 |
| Chỉ một AZ | Một sự cố AZ làm dừng toàn hệ thống | 10 |
| Không có budget/cảnh báo chi phí | Phát hiện vượt chi phí khi đã nhận hóa đơn | 11 |
