---
title: "Chi phí và FinOps trên AWS"
description: "hiểu AWS tính tiền thế nào, những khoản ẩn hay làm hóa đơn tăng vọt, cách giảm chi phí mà không giảm độ tin cậy, và quy trình FinOps để chi phí trở thành một chỉ số kỹ thuật..."
pubDatetime: 2026-11-17T09:00:00Z
featured: false
tags:
  - aws
  - cloud
  - finops
---
# Chi phí và FinOps trên AWS

**Mục đích:** hiểu AWS tính tiền thế nào, những khoản ẩn hay làm hóa đơn tăng vọt, cách giảm chi phí mà không giảm độ tin cậy, và quy trình FinOps để chi phí trở thành một chỉ số kỹ thuật được theo dõi như độ trễ.
**Liên quan:** [02-mang-vpc.md](02-mang-vpc.md) · [03-compute-ec2-ecs-eks-lambda.md](03-compute-ec2-ecs-eks-lambda.md) · [04-luu-tru-va-database.md](04-luu-tru-va-database.md) · [08-observability-van-hanh.md](08-observability-van-hanh.md) · [10-ha-dr-well-architected.md](10-ha-dr-well-architected.md) · [12-kien-truc-learnhub-tren-aws.md](12-kien-truc-learnhub-tren-aws.md) · [13-checklist-review-aws.md](13-checklist-review-aws.md) · [../07-he-thong-server/07-cloud-kien-truc.md](../07-he-thong-server/07-cloud-kien-truc.md)

> **Mọi con số giá trong file này là tham khảo, có thể đã thay đổi và khác nhau giữa Region** (ap-southeast-1 thường đắt hơn us-east-1). Luôn kiểm tra trên AWS Pricing Calculator và trang giá chính thức trước khi ra quyết định.

---

## 1. Các mô hình giá compute

| Mô hình | Cam kết | Mức giảm so với On-Demand (định hướng) | Linh hoạt | Dùng cho |
|---|---|---|---|---|
| **On-Demand** | Không | 0% | Tối đa | Tải đột biến, thử nghiệm, phần vượt mức cam kết |
| **Compute Savings Plans** | $/giờ trong 1 hoặc 3 năm | Lên tới khoảng 66% | Áp dụng cho EC2 mọi họ/Region/OS, **Fargate**, **Lambda** | Tải nền ổn định của API/worker — **lựa chọn mặc định** |
| **EC2 Instance Savings Plans** | $/giờ cho một họ instance trong một Region | Lên tới khoảng 72% | Thấp hơn (cố định họ + Region) | Fleet EC2 rất ổn định |
| **Reserved Instances** (RDS, Aurora, ElastiCache, OpenSearch, Redshift) | Instance cụ thể 1/3 năm | Đáng kể, tùy dịch vụ | Thấp (một số cho phép linh hoạt kích thước trong họ) | DB, cache chạy 24/7. AWS đã công bố Savings Plans cho database — kiểm tra phạm vi dịch vụ và điều kiện hiện hành trước khi chọn giữa RI và Savings Plans |
| **Spot** | Không, có thể bị thu hồi với cảnh báo khoảng 2 phút | Lên tới khoảng 90% | Bị gián đoạn | Worker chấm bài, xử lý ảnh, batch, CI — việc **chịu được gián đoạn** |

Quy tắc mua cam kết:
1. Đo mức sử dụng **thấp nhất ổn định** (tải nền) trong 30–60 ngày, không phải trung bình.
2. Cam kết **60–80% tải nền**, phần còn lại On-Demand/Spot. Cam kết quá tay = trả tiền cho thứ không dùng.
3. Bắt đầu 1 năm, không trả trước hoặc trả trước một phần; tăng dần.
4. Đặt lịch xem lại hằng quý (Cost Explorer có khuyến nghị và báo cáo độ phủ/mức sử dụng).

Fargate Spot: worker chấm bài (SQS) chạy trên **Fargate Spot** với capacity provider strategy trộn Fargate thường (base) + Spot (phần mở rộng). Worker phải **idempotent** và xử lý `SIGTERM` (task Spot bị thu hồi): ngừng nhận message mới, để message chưa xong trở lại queue khi visibility timeout hết.

## 2. Graviton (ARM)

Instance/Fargate dùng chip Graviton thường rẻ hơn khoảng 20% và hiệu năng trên giá tốt hơn cho phần lớn workload Node.js, Java, Go, Python. LearnHub: API Node trên Fargate ARM64, Aurora/ElastiCache/OpenSearch chọn instance Graviton (`r7g`, `r8g`… tùy thời điểm có).

Điều kiện: image build cho `linux/arm64` (buildx multi-arch), dependency native (sharp, bcrypt/argon2 binding) có bản ARM, load test lại trước khi chuyển. Agent hay quên bước build multi-arch → task không khởi động được với lỗi `exec format error`.

## 3. Chi phí ẩn – nơi hóa đơn thật sự phình ra

| Khoản | Vì sao bất ngờ | Cách giảm |
|---|---|---|
| **NAT Gateway** | Phí theo giờ **và** phí theo **GB dữ liệu xử lý**. Mọi traffic từ subnet private ra Internet hoặc tới dịch vụ AWS qua endpoint công khai (S3, ECR, CloudWatch, Secrets Manager) đều tính GB qua NAT | **Gateway endpoint** cho S3 và DynamoDB (miễn phí); **interface endpoint** cho ECR, CloudWatch Logs, Secrets Manager, STS, SQS khi lưu lượng đủ lớn (endpoint cũng tính phí theo giờ/AZ + GB — so sánh); kéo image từ ECR qua endpoint |
| **Data transfer cross-AZ** | Traffic giữa AZ tính phí **cả hai chiều**. API ở AZ-a gọi Redis ở AZ-b, đọc Aurora reader ở AZ-c → tính tiền mỗi byte | Chấp nhận phần cần cho HA; giảm phần không cần (ưu tiên reader cùng AZ nếu driver hỗ trợ, nén payload, tránh chatty call) |
| **Data transfer ra Internet (egress)** | Phần lớn đội ngũ đánh giá thấp. Video/ảnh bài viết phục vụ trực tiếp từ S3 = egress đắt | Phục vụ qua **CloudFront** (egress từ CloudFront thường rẻ hơn, có gói miễn phí hằng tháng và cache giảm lượt về origin; truyền S3 → CloudFront không tính egress S3); nén ảnh, định dạng hiện đại (WebP/AVIF) |
| **IPv4 công khai** | Từ tháng 2/2024 AWS tính phí **mọi** IPv4 công khai (khoảng 0,005 USD/giờ/IP, tham khảo), kể cả đang gắn vào tài nguyên | Không gán IP công khai cho task/instance trong subnet private; dọn Elastic IP thừa; cân nhắc IPv6 |
| **CloudWatch Logs ingestion** | Tính theo GB ghi vào; log DEBUG/log body request trên prod có thể vượt cả chi phí compute | Mức log hợp lý, sampling, log class Infrequent Access, retention ([08-observability-van-hanh.md](08-observability-van-hanh.md)) |
| **CloudWatch custom metrics** | Mỗi tổ hợp dimension là một metric tính phí | Dimension có số giá trị thấp |
| **EBS/snapshot/AMI mồ côi** | Volume không gắn, snapshot cũ, AMI không dùng vẫn tính tiền | Lifecycle (Data Lifecycle Manager, AWS Backup retention), quét định kỳ |
| **Elastic IP không gắn**, **Load Balancer không dùng** | Tính theo giờ | Quét định kỳ (Trusted Advisor, Cost Optimization Hub) |
| **Aurora I/O** | Aurora Standard tính phí theo I/O; workload I/O nặng có thể làm phí I/O lớn hơn phí instance | So sánh **Aurora I/O-Optimized** (không phí I/O, giá instance/lưu trữ cao hơn) khi I/O chiếm tỉ lệ lớn trong chi phí Aurora (AWS gợi ý ngưỡng khoảng 25% — kiểm tra) |
| **KMS API, Secrets Manager API** | Gọi mỗi request = phí + throttle | Cache bí mật trong ứng dụng; S3 Bucket Keys |
| **Môi trường dev/staging chạy 24/7** | Thường 30–50% hóa đơn ở công ty nhỏ | Tắt ngoài giờ (scheduler), dùng cấu hình nhỏ, Aurora Serverless v2 với mức tối thiểu thấp cho môi trường ít dùng |
| **Phiên bản hết hỗ trợ chuẩn** | RDS/Aurora/EKS chạy phiên bản hết hạn hỗ trợ chuẩn bị tính phí **Extended Support** | Lên kế hoạch nâng cấp trước hạn |

### Ví dụ phân tích NAT

Worker xử lý ảnh kéo 2 TB/tháng từ S3 qua NAT Gateway (không có gateway endpoint): phí xử lý NAT tính trên 2 TB. Thêm **S3 gateway endpoint** (miễn phí) → khoản này về 0 cho traffic S3. Đây là tối ưu "một dòng Terraform" có tác động lớn nhất thường gặp.

```hcl
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.ap-southeast-1.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = aws_route_table.private[*].id
}
```

## 4. Right-sizing

- **AWS Compute Optimizer**: khuyến nghị kích thước cho EC2, ASG, EBS, Lambda, ECS trên Fargate (và một số dịch vụ DB — kiểm tra phạm vi) dựa trên metric thực tế. Bật ở cấp Organization.
- **Cost Optimization Hub**: gom khuyến nghị (right-size, Savings Plans, xóa tài nguyên thừa) và ước tính tiết kiệm.
- Fargate: task 2 vCPU/4 GB mà CPU trung bình 10%, bộ nhớ 30% → giảm cấu hình, tăng số task (scale ngang mịn hơn).
- **Không** right-size dựa trên tuần ít tải: LearnHub có đỉnh mùa thi — dùng dữ liệu bao gồm đỉnh, hoặc scale theo lịch thay vì cấu hình to cố định.
- Thứ tự: right-size **trước**, mua Savings Plans **sau** (tránh cam kết cho tài nguyên quá cỡ).

## 5. S3 – lớp lưu trữ và vòng đời

| Lớp | Dùng cho LearnHub |
|---|---|
| S3 Standard | Ảnh/tài liệu bài viết mới, truy cập thường xuyên |
| **S3 Intelligent-Tiering** | Media người dùng với mẫu truy cập không đoán được — tự chuyển lớp, có phí giám sát nhỏ theo object (không đáng cho object rất nhỏ; object dưới 128 KB không được chuyển lớp tự động) |
| Standard-IA | Bài nộp của kỳ thi đã kết thúc, ít đọc lại (có phí truy xuất, thời gian lưu tối thiểu) |
| Glacier Instant / Flexible / Deep Archive | Lưu trữ lâu dài theo chính sách (bài thi nhiều năm trước, log audit) |

Lifecycle: xóa upload dở (incomplete multipart upload) sau 7 ngày; xóa **phiên bản cũ** (noncurrent versions) sau N ngày — bucket bật versioning mà không có rule này sẽ tích lũy chi phí âm thầm.

## 6. Tagging và phân bổ chi phí

Tag bắt buộc (áp bằng `default_tags`/CDK `Tags.of(app)`, kiểm tra bằng **Tag Policies** của Organizations và Config rule):

| Tag | Ví dụ | Mục đích |
|---|---|---|
| `app` | `learnhub` | Sản phẩm |
| `env` | `prod`, `staging`, `dev` | Môi trường |
| `component` | `api`, `grading-worker`, `moderation`, `search` | Thành phần |
| `owner` | `team-exam` | Ai chịu trách nhiệm |
| `cost-center` | `<COST_CENTER>` | Kế toán |

- Kích hoạt tag làm **cost allocation tag** trong Billing (tag không tự xuất hiện trong báo cáo chi phí).
- Chi phí không gắn tag được (data transfer, một số phí chung) → phân bổ theo **tài khoản** (mỗi môi trường một tài khoản giúp việc này rất rõ ràng) và quy tắc chia sẻ trong **Cost Categories**.
- Mục tiêu: > 95% chi phí có thể quy về `component` + `env`.

## 7. Theo dõi và cảnh báo

| Công cụ | Dùng để |
|---|---|
| **AWS Budgets** | Ngân sách theo tài khoản/tag/dịch vụ; cảnh báo theo thực tế và **dự báo** (forecast vượt 100%); Budget Actions có thể áp policy chặn (dùng thận trọng trên prod) |
| **Cost Anomaly Detection** | Phát hiện chi tiêu bất thường bằng ML theo dịch vụ/tài khoản/tag; gửi SNS hằng ngày hoặc ngay lập tức. **Bật ngay từ ngày đầu** — bắt được khóa bị lộ dùng để đào coin, vòng lặp Lambda vô tận, log bùng nổ |
| **Cost Explorer** | Phân tích theo thời gian, nhóm theo dịch vụ/tag/usage type; báo cáo độ phủ Savings Plans/RI |
| **CUR 2.0 / Data Exports** | Dữ liệu chi tiết từng dòng → S3 → Athena/QuickSight; nền cho phân tích unit economics |
| **Cost Optimization Hub, Compute Optimizer, Trusted Advisor** | Khuyến nghị tối ưu |

```bash
# Ngân sách tháng cho tài khoản prod, cảnh báo khi dự báo vượt 100%
aws budgets create-budget --account-id <ACCOUNT_ID> \
  --budget '{"BudgetName":"learnhub-prod-monthly","BudgetLimit":{"Amount":"<AMOUNT>","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}' \
  --notifications-with-subscribers '[{"Notification":{"NotificationType":"FORECASTED","ComparisonOperator":"GREATER_THAN","Threshold":100,"ThresholdType":"PERCENTAGE"},"Subscribers":[{"SubscriptionType":"SNS","Address":"arn:aws:sns:us-east-1:<ACCOUNT_ID>:finops-alerts"}]}]'
```

```sql
-- Athena trên CUR 2.0: chi phí theo component tháng này (tên cột phụ thuộc cấu hình export — kiểm tra schema)
SELECT resource_tags['user_component'] AS component,
       SUM(line_item_unblended_cost)    AS cost_usd
FROM cur2
WHERE billing_period = '2026-11'
GROUP BY 1
ORDER BY 2 DESC;
```

## 8. Unit economics – chi phí trên mỗi người dùng

Tổng hóa đơn tăng có thể là **tốt** (người dùng tăng nhanh hơn). Chỉ số đúng là **chi phí trên đơn vị giá trị**:

| Chỉ số | Công thức | Ý nghĩa |
|---|---|---|
| Chi phí / MAU | Tổng chi phí hạ tầng prod / người dùng hoạt động tháng | Chỉ số chính, so sánh theo tháng |
| Chi phí / lượt nộp bài | (Chi phí API + DB + worker chấm phân bổ cho exam) / số lượt nộp | Giá vốn của tính năng thi |
| Chi phí / GB media phục vụ | (S3 + CloudFront + xử lý ảnh) / GB phục vụ | Hiệu quả CDN, nén |
| Chi phí không sản xuất / tổng | (dev + staging + CI) / tổng | Thường nên nhỏ hơn khoảng 25–35% (tùy tổ chức) |

Ví dụ minh họa (số giả định, **không phải giá thật**): tháng 10 chi 40.000 USD cho 3 triệu MAU → 0,0133 USD/MAU. Tháng 11 chi 46.000 USD cho 3,8 triệu MAU → 0,0121 USD/MAU: hóa đơn tăng 15% nhưng hiệu quả tốt lên 9%. Ngược lại, chi phí/MAU tăng 3 tháng liên tiếp là tín hiệu kiến trúc có vấn đề (N+1 truy vấn, cache kém, log bùng nổ).

## 9. Quy trình FinOps

Theo vòng **Inform → Optimize → Operate** (FinOps Foundation):

1. **Inform (hiển thị)**: tag + tài khoản theo môi trường, dashboard chi phí theo component, unit cost hằng tháng, mỗi đội thấy chi phí của mình (showback).
2. **Optimize (tối ưu)**: right-size, Savings Plans/RI, Spot cho worker, endpoint thay NAT, lifecycle S3, log retention, tắt môi trường ngoài giờ.
3. **Operate (vận hành)**: review chi phí hằng tuần (15 phút: anomaly, top tăng trưởng), hằng tháng (unit economics, độ phủ cam kết), hằng quý (cam kết mới, kiến trúc). Chi phí là một tiêu chí trong review thiết kế.

Vai trò: kỹ sư quyết định kiến trúc (và do đó chi phí); FinOps/tài chính cung cấp dữ liệu, cam kết mua; lãnh đạo đặt mục tiêu unit cost.

## 10. Checklist chi phí cho thay đổi kiến trúc

Trước khi duyệt thiết kế/PR hạ tầng, trả lời:

1. Thay đổi này thêm thành phần **tính phí theo giờ** nào (NAT, endpoint, LB, instance, cluster)? Bao nhiêu AZ × bao nhiêu môi trường?
2. Có tạo **luồng dữ liệu mới** qua NAT, cross-AZ, cross-Region hoặc ra Internet không? Khối lượng ước tính/tháng?
3. Lượng **log/metric** mới ước tính bao nhiêu GB/tháng, bao nhiêu metric?
4. Có scale theo tải không, hay cấu hình cố định theo đỉnh?
5. Có dùng được Graviton, Spot, Savings Plans hiện có không?
6. Dữ liệu mới có **vòng đời** (lifecycle, retention) không?
7. Ước tính chi phí tháng (Pricing Calculator) ở tải hiện tại và tải gấp 3 là bao nhiêu? Ảnh hưởng đến chi phí/MAU?

## 11. Sai lầm thường gặp (kể cả của agent AI)

| Sai lầm | Hậu quả | Cách đúng |
|---|---|---|
| Không có S3 gateway endpoint, mọi traffic S3 qua NAT | Phí NAT theo GB rất lớn | Gateway endpoint (miễn phí) |
| Agent tạo interface endpoint cho mọi dịch vụ ở mọi AZ "cho an toàn" | Phí cố định theo giờ × dịch vụ × AZ × môi trường | Chỉ tạo khi lưu lượng/tuân thủ cần; tính toán so với NAT |
| Media phục vụ trực tiếp từ S3 public | Egress đắt, không cache, bucket public | CloudFront + OAC |
| Mua Savings Plans 3 năm theo mức dùng trung bình tháng cao điểm | Trả tiền cho công suất không dùng | Cam kết 60–80% tải nền, 1 năm trước |
| Staging bản sao đầy đủ của prod chạy 24/7 | Gấp đôi chi phí | Cấu hình thu nhỏ, tắt ngoài giờ, dựng theo nhu cầu |
| Không bật Cost Anomaly Detection | Phát hiện khóa bị lộ/vòng lặp chi phí sau khi nhận hóa đơn | Bật từ ngày đầu, gửi tới kênh on-call |
| Chọn cấu hình lớn "cho chắc" không có số liệu | Lãng phí lâu dài | Load test, metric, Compute Optimizer |
| Bỏ HA để tiết kiệm (1 AZ, 1 NAT) mà không ghi nhận rủi ro | Sự cố mất dịch vụ | Đánh đổi có chủ đích, ghi trong ADR, người có thẩm quyền chấp nhận |

## Checklist review

- [ ] Mọi tài nguyên có tag bắt buộc; tag được kích hoạt làm cost allocation tag; mỗi môi trường một tài khoản.
- [ ] Có Budgets (theo dự báo) và Cost Anomaly Detection gửi cảnh báo tới kênh có người theo dõi.
- [ ] S3 (và DynamoDB nếu dùng) có gateway endpoint; luồng lớn qua NAT đã được xem xét.
- [ ] Media phục vụ qua CloudFront; S3 có lifecycle cho multipart dở và phiên bản cũ.
- [ ] Log group có retention; dimension metric không bùng nổ.
- [ ] Không có IPv4 công khai thừa, EBS/snapshot/EIP/LB mồ côi.
- [ ] Compute dùng Graviton khi tương thích; worker chịu gián đoạn chạy Spot và idempotent.
- [ ] Savings Plans/RI phủ tải nền, không vượt; xem lại hằng quý.
- [ ] Đã so sánh Aurora Standard vs I/O-Optimized theo dữ liệu thực tế.
- [ ] Phiên bản DB/EKS còn trong hỗ trợ chuẩn (tránh phí Extended Support).
- [ ] Theo dõi chi phí/MAU hằng tháng; thay đổi kiến trúc có ước tính chi phí kèm theo.
