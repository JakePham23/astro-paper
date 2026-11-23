---
title: "Tính sẵn sàng cao, khôi phục thảm họa và Well-Architected trên AWS"
description: "thiết kế LearnHub chịu được mất một AZ mà người dùng không nhận ra, có kế hoạch khôi phục khi mất cả Region với RPO/RTO và chi phí được chọn có chủ đích, và đánh giá kiến trúc..."
pubDatetime: 2026-11-17T10:00:00Z
featured: false
tags:
  - aws
  - cloud
---
# Tính sẵn sàng cao, khôi phục thảm họa và Well-Architected trên AWS

**Mục đích:** thiết kế LearnHub chịu được mất một AZ mà người dùng không nhận ra, có kế hoạch khôi phục khi mất cả Region với RPO/RTO và chi phí được chọn có chủ đích, và đánh giá kiến trúc theo AWS Well-Architected Framework.
**Liên quan:** [02-mang-vpc.md](02-mang-vpc.md) · [04-luu-tru-va-database.md](04-luu-tru-va-database.md) · [06-edge-cloudfront-alb-waf.md](06-edge-cloudfront-alb-waf.md) · [08-observability-van-hanh.md](08-observability-van-hanh.md) · [11-chi-phi-finops.md](11-chi-phi-finops.md) · [12-kien-truc-learnhub-tren-aws.md](12-kien-truc-learnhub-tren-aws.md) · [13-checklist-review-aws.md](13-checklist-review-aws.md) · [../07-he-thong-server/07-cloud-kien-truc.md](../07-he-thong-server/07-cloud-kien-truc.md) · [../06-database-chuyen-sau/04-replication-ha.md](../06-database-chuyen-sau/04-replication-ha.md) · [../06-database-chuyen-sau/05-backup-restore-dr.md](../06-database-chuyen-sau/05-backup-restore-dr.md)

> Con số thời gian failover và giá chỉ để định hướng; đo thực tế bằng diễn tập và kiểm tra tài liệu AWS hiện hành.

---

## 1. Hạ tầng toàn cầu – Region, AZ, Local Zone

| Khái niệm | Là gì | Ý nghĩa thiết kế |
|---|---|---|
| **Region** | Vùng địa lý độc lập (ap-southeast-1 = Singapore) | Ranh giới cô lập lớn nhất; dữ liệu không tự rời Region; mỗi dịch vụ là một bản triển khai riêng theo Region |
| **Availability Zone (AZ)** | Một hoặc nhiều trung tâm dữ liệu có điện, mạng, làm mát độc lập trong Region; nối nhau bằng mạng độ trễ thấp | Đơn vị lỗi bạn phải thiết kế để chịu được. ap-southeast-1 có 3 AZ |
| **AZ ID vs AZ name** | `ap-southeast-1a` ở tài khoản A có thể là AZ vật lý khác `ap-southeast-1a` ở tài khoản B; AZ ID (`apse1-az1`) mới là định danh vật lý | Khi nhiều tài khoản cần cùng AZ (giảm phí cross-AZ, cùng vùng lỗi), dùng AZ ID |
| **Local Zone** | Hạ tầng gần người dùng ở thành phố, phụ thuộc Region cha | Độ trễ cực thấp, dịch vụ hạn chế. Kiểm tra danh sách Local Zone hiện hành nếu cần gần Việt Nam |
| **Edge location** | Điểm hiện diện của CloudFront, Route 53, Global Accelerator | Đưa nội dung/DNS gần người dùng Việt Nam |

Lựa chọn Region DR cho LearnHub: một Region khác trong châu Á – Thái Bình Dương (ví dụ Tokyo, Jakarta, Malaysia, Hong Kong… tùy thời điểm). Tiêu chí: **mọi dịch vụ LearnHub dùng đều có ở đó** (Aurora Global Database, ElastiCache phiên bản tương ứng, OpenSearch…), độ trễ chấp nhận được tới Việt Nam, yêu cầu pháp lý về vị trí dữ liệu, chi phí. Kiểm tra "AWS Regional Services List" trước khi chốt.

## 2. Chịu lỗi một AZ – static stability

### 2.1 Nguyên tắc static stability

Hệ thống **ổn định tĩnh** khi một AZ mất, phần còn lại tiếp tục phục vụ **mà không cần thực hiện thay đổi nào** (không cần khởi tạo thêm instance, không cần gọi control plane). Lý do: trong sự cố diện rộng, **control plane** (API tạo tài nguyên, scale) thường quá tải hoặc chậm; **data plane** (xử lý request đang chạy) bền hơn.

Áp dụng:
- **Dự phòng sẵn công suất**: chạy đủ task ở 3 AZ sao cho mất 1 AZ thì 2 AZ còn lại gánh được đỉnh. Với 3 AZ, mỗi AZ cần ~50% công suất đỉnh (tổng 150%) thay vì 33%. Đây là chi phí của HA — ghi rõ trong ADR.
- Không phụ thuộc vào việc Auto Scaling **kịp** thêm task khi mất AZ.
- DNS/kết nối dùng endpoint không gắn AZ (ALB DNS, Aurora cluster endpoint).
- Mỗi AZ có **NAT Gateway riêng** và route table riêng; một NAT dùng chung = mất AZ chứa NAT là mất đường ra Internet của cả hệ thống.

### 2.2 Multi-AZ cho từng thành phần LearnHub

| Thành phần | Cấu hình multi-AZ | Khi mất 1 AZ | Ghi chú |
|---|---|---|---|
| CloudFront, Route 53 | Toàn cầu, AWS quản lý | Không ảnh hưởng | — |
| ALB | Bật ở 3 subnet public/3 AZ | ALB ngừng gửi tới target ở AZ hỏng (health check); có thể dùng **zonal shift** (Route 53 ARC) để chủ động rút AZ có vấn đề "xám" | Cân nhắc cross-zone load balancing |
| ECS Fargate API | Task trải đều 3 AZ, min ≥ đủ tải khi mất 1 AZ | Task còn lại gánh; ECS khởi lại task ở AZ khỏe | — |
| Aurora PostgreSQL | Writer + ít nhất 1–2 reader ở AZ khác; storage tự nhân bản 6 bản trên 3 AZ | Writer hỏng → failover sang reader, thường dưới 1 phút (đo thực tế); ứng dụng phải **reconnect** | Đặt `promotion tier` cho reader mong muốn; RDS Proxy giúp giảm thời gian gián đoạn kết nối |
| RDS Proxy | Multi-AZ do AWS quản lý | Giữ kết nối phía client trong failover | — |
| ElastiCache (Redis/Valkey) | Cluster mode, replica ở AZ khác, Multi-AZ auto failover | Replica được thăng cấp; ghi trong vài giây có thể mất | Ứng dụng coi cache là có thể mất |
| S3 | Mặc định lưu trên nhiều AZ (trừ lớp One Zone) | Không ảnh hưởng | Không dùng One Zone-IA cho dữ liệu không tái tạo được |
| SQS, SNS, EventBridge, Lambda | Dịch vụ Regional, AWS lo multi-AZ | Không ảnh hưởng | — |
| OpenSearch | 3 AZ với dedicated master, replica | Tiếp tục với replica | Bật zone awareness |
| NAT Gateway | **Một NAT mỗi AZ** | AZ khác không ảnh hưởng | Chi phí xem [11-chi-phi-finops.md](11-chi-phi-finops.md) |

### 2.3 Lỗi "xám" (gray failure)

AZ không chết hẳn mà **chậm/lỗi một phần**: health check vẫn qua nhưng p99 tăng gấp 10. Phát hiện bằng metric theo AZ (ALB có metric theo AZ), xử lý bằng **zonal shift** để rút traffic khỏi AZ đó trong thời gian giới hạn; **zonal autoshift** cho phép AWS tự rút khi phát hiện sự cố AZ (yêu cầu bạn tham gia diễn tập định kỳ — kiểm tra điều kiện). Chỉ an toàn khi đã có static stability (2 AZ còn lại đủ tải).

## 3. Khôi phục thảm họa đa Region

### 3.1 RPO, RTO và bốn chiến lược

- **RPO** (Recovery Point Objective): mất tối đa bao nhiêu dữ liệu (tính theo thời gian).
- **RTO** (Recovery Time Objective): bao lâu để phục vụ lại.

| Chiến lược | Region DR có gì khi bình thường | RPO điển hình | RTO điển hình | Chi phí tương đối | Dịch vụ AWS chính |
|---|---|---|---|---|---|
| **Backup & restore** | Chỉ bản sao backup | Giờ (theo tần suất copy) | Nhiều giờ – ngày | $ | AWS Backup copy cross-Region, S3 CRR, IaC để dựng lại |
| **Pilot light** | Dữ liệu được nhân bản liên tục; hạ tầng lõi dựng sẵn nhưng compute tắt/ở mức 0 | Giây – phút | Hàng chục phút – vài giờ | $$ | Aurora Global Database (secondary không có/ít instance), S3 CRR, IaC sẵn, ECS service desired=0 |
| **Warm standby** | Bản thu nhỏ chạy đầy đủ, nhận được traffic | Giây | Phút | $$$ | Aurora Global Database + instance ở secondary, ECS chạy mức tối thiểu, Route 53 failover |
| **Multi-site active/active** | Hai Region cùng phục vụ | ~0 – giây (tùy mô hình ghi) | Gần 0 | $$$$ | DynamoDB global tables, định tuyến theo độ trễ/địa lý, thiết kế xử lý xung đột ghi |

Quy tắc chọn: bắt đầu từ **chi phí của 1 giờ ngừng dịch vụ** và **chi phí của mất dữ liệu**. LearnHub:
- Dữ liệu bài thi và kết quả chấm: mất là nghiêm trọng → RPO ≤ 1 phút.
- Ngừng dịch vụ ngoài giờ thi: chịu được vài chục phút; trong giờ thi: rất tệ nhưng thảm họa cả Region là hiếm.
- Kết luận đề xuất: **pilot light → warm standby** khi đạt 5 triệu user. Active/active với PostgreSQL rất phức tạp (ghi xung đột, Aurora Global Database chỉ có một Region ghi chính) — không đáng ở giai đoạn này.

### 3.2 Dịch vụ theo tầng dữ liệu

| Dữ liệu | Cơ chế đa Region | Lưu ý |
|---|---|---|
| Aurora PostgreSQL | **Aurora Global Database**: nhân bản ở tầng storage, độ trễ thường dưới 1 giây; **switchover** (có kế hoạch, không mất dữ liệu) và **failover** (sự cố, có thể mất dữ liệu trong độ trễ nhân bản) | Một Region ghi chính; Region phụ chỉ đọc. Có tùy chọn write forwarding (kiểm tra hỗ trợ với PostgreSQL và phiên bản). Sau failover phải đổi endpoint ứng dụng (global writer endpoint giúp việc này — kiểm tra tính năng) |
| S3 media | **Cross-Region Replication** (CRR) với Replication Time Control nếu cần SLA thời gian; versioning bắt buộc | Replication không xóa ngược (cấu hình delete marker replication có chủ đích) |
| ElastiCache | Global Datastore (nếu cần) hoặc **chấp nhận cache trống** ở Region DR | Cache trống → DB chịu tải dồn khi failover; tính vào năng lực Region DR |
| DynamoDB (nếu dùng) | Global tables (multi-active) | Last-writer-wins khi xung đột (có chế độ nhất quán mạnh đa Region — kiểm tra điều kiện) |
| Bí mật | Secrets Manager replica secret | Đồng bộ rotation |
| Khóa KMS | Khóa riêng ở Region DR hoặc multi-Region key | Xem [07-bao-mat-aws.md](07-bao-mat-aws.md) |
| Image | ECR cross-Region replication | Không có image ở Region DR = không chạy được gì |
| IaC | Cùng code, tham số theo Region | DR phải dựng được từ code, không phải từ ký ức |

### 3.3 Định tuyến khi failover

- **Route 53 failover routing** + health check: chuyển DNS sang Region DR khi health check chính thất bại. Nhược: phụ thuộc TTL DNS và cache của client; health check có thể cho kết quả sai.
- **Route 53 Application Recovery Controller (ARC)**: routing control (công tắc bật/tắt do con người hoặc tự động điều khiển, đặt trên data plane có độ sẵn sàng cao), readiness check (Region DR có thật sự sẵn sàng: quota, phiên bản, cấu hình). AWS cũng bổ sung khả năng điều phối chuyển Region trong ARC (kiểm tra tính năng hiện hành).
- Nguyên tắc: **quyết định failover Region là quyết định của con người** (trừ khi đã diễn tập rất kỹ) — failover nhầm do health check lỗi có thể gây mất dữ liệu (Aurora failover không có kế hoạch) và split-brain.
- **Failback** (quay về Region chính) cũng phải có quy trình và diễn tập — thường bị quên.

### 3.4 Runbook failover Region (rút gọn)

1. Xác nhận sự cố Region (AWS Health, nhiều dịch vụ lỗi, không phải lỗi của mình). Incident commander quyết định.
2. Bật chế độ bảo trì/đọc-chỉ cho ứng dụng nếu còn liên lạc được với Region chính (giảm ghi mất).
3. Aurora Global Database: failover sang Region DR (chấp nhận mất dữ liệu trong độ trễ nhân bản); ghi nhận thời điểm.
4. Scale ECS ở Region DR lên công suất mục tiêu (pilot light: từ 0; warm standby: từ mức tối thiểu). **Kiểm tra quota trước** — mục 5.
5. Chuyển routing control/Route 53 sang Region DR.
6. Kiểm tra bằng canary và nghiệp vụ (đăng nhập, mở đề thi, nộp bài).
7. Thông báo người dùng; ghi lại khoảng dữ liệu có thể mất để xử lý sau.

### 3.5 AWS Elastic Disaster Recovery (DRS)

Nhân bản liên tục ở mức block cho **máy chủ** (EC2, máy on-premise) sang vùng staging rẻ, khởi chạy khi cần. Hợp với workload "lift-and-shift" khó tái kiến trúc. LearnHub chạy container + dịch vụ managed → không cần DRS; dùng IaC + nhân bản dữ liệu ở mức dịch vụ.

## 4. Diễn tập: AWS Fault Injection Service (FIS)

FIS chạy thí nghiệm chaos có kiểm soát: dừng task ECS, làm gián đoạn mạng một AZ, failover Aurora, tăng độ trễ API, CPU stress, mô phỏng sự cố AZ (kịch bản AZ power interruption — kiểm tra danh sách kịch bản).

Thí nghiệm mẫu cho LearnHub (staging trước, prod ngoài giờ thi khi đã tự tin):

| Thí nghiệm | Giả thuyết | Điều kiện dừng (stop condition) |
|---|---|---|
| Dừng 33% task API ở một AZ | p99 < 500 ms, 5xx < 0,5% | Alarm 5xx % kích hoạt |
| Failover Aurora writer | Ứng dụng tự kết nối lại trong < 60 giây, không mất bài đã nộp | Alarm ExamSubmitError |
| Gián đoạn mạng một AZ 10 phút | Hệ thống phục vụ bình thường từ 2 AZ (static stability) | Alarm composite exam-degraded |
| Làm chậm Redis | API dùng timeout + fallback DB, không treo | p99 > 2 s |

Nguyên tắc: luôn có **stop condition** gắn CloudWatch alarm; role FIS quyền tối thiểu; thông báo trước cho người liên quan; ghi kết quả và việc cần sửa. **Game day** mỗi quý: đội trực thực hành runbook thật.

## 5. Service quotas – nguyên nhân sự cố âm thầm

Quota (giới hạn) theo tài khoản/Region: số vCPU Fargate, số ENI, số instance Aurora, số target ALB, tốc độ API (KMS, Secrets Manager, STS), số kết nối DB, IP trong subnet.

- Trước mùa thi và trước khi failover DR được: **tính công suất đỉnh × hệ số an toàn** và kiểm tra quota ở **cả Region chính và Region DR**.
- Dùng Service Quotas + CloudWatch alarm theo mức sử dụng quota (nhiều quota có metric usage).
- Tăng quota cần thời gian duyệt → làm trước nhiều ngày/tuần.
- Subnet `/24` chỉ có khoảng 250 IP dùng được; mỗi task Fargate dùng một ENI/IP → 120 task + ENI của dịch vụ khác có thể cạn IP. Thiết kế subnet private đủ rộng (ví dụ `/20`) — xem [02-mang-vpc.md](02-mang-vpc.md).

```bash
aws service-quotas list-service-quotas --service-code fargate --region ap-southeast-1 \
  --query 'Quotas[].{Name:QuotaName,Value:Value}'
aws service-quotas request-service-quota-increase --service-code fargate \
  --quota-code <QUOTA_CODE> --desired-value 4000 --region ap-southeast-1
```

## 6. AWS Well-Architected Framework – 6 trụ cột áp dụng cho LearnHub

| Trụ cột | Câu hỏi then chốt cho LearnHub | Bằng chứng cần có |
|---|---|---|
| **Operational Excellence** (Vận hành xuất sắc) | Deploy có tự động, nhỏ, đảo ngược được? Có runbook cho 10 sự cố hay gặp? Có postmortem và theo dõi việc khắc phục? Có cửa sổ đóng băng giờ thi? | Pipeline, runbook, danh sách postmortem |
| **Security** (Bảo mật) | Danh tính tập trung (Identity Center), không khóa lâu dài? Phát hiện (GuardDuty, CloudTrail) bật mọi nơi? Dữ liệu cá nhân mã hóa bằng CMK? Có quy trình ứng cứu? Đáp ứng Nghị định 13/2023? | [07-bao-mat-aws.md](07-bao-mat-aws.md), kết quả Security Hub |
| **Reliability** (Độ tin cậy) | Chịu mất 1 AZ mà không thao tác? RPO/RTO đã định và **đã diễn tập**? Quota đủ cho đỉnh thi? Có timeout/retry/backoff, idempotency nộp bài? | Kết quả FIS, biên bản diễn tập DR, bảng quota |
| **Performance Efficiency** (Hiệu năng) | Chọn đúng loại tài nguyên (Graviton, Aurora vs DynamoDB)? Có cache, CDN cho tài sản tĩnh của đề thi? Đã load test đỉnh 200k đồng thời? | Báo cáo load test, metric p99 |
| **Cost Optimization** (Chi phí) | Biết chi phí trên mỗi user hoạt động? Có tag, budget, cảnh báo bất thường? Đã dùng Savings Plans cho tải nền? NAT/egress được tối ưu? | [11-chi-phi-finops.md](11-chi-phi-finops.md), báo cáo CUR |
| **Sustainability** (Bền vững) | Tận dụng tài nguyên cao (không để thừa lớn ngoài giờ thi)? Dùng Graviton, managed services, vòng đời dữ liệu (xóa/lưu trữ lạnh dữ liệu cũ)? | Metric sử dụng, lifecycle policy |

### Well-Architected Tool và quy trình review

- **Well-Architected Tool** trong console: tạo workload "LearnHub prod", trả lời câu hỏi theo từng trụ cột (có thể thêm **lens** như Serverless, SaaS), sinh danh sách **rủi ro cao/trung bình (HRI/MRI)** và kế hoạch cải tiến; lưu **milestone** để so sánh theo thời gian.
- Thời điểm review: trước go-live, trước mùa thi lớn, sau thay đổi kiến trúc đáng kể, định kỳ 6–12 tháng.
- Ai tham gia: kiến trúc sư, lead backend, platform/SRE, security, người nắm chi phí. Agent có thể **chuẩn bị** câu trả lời và bằng chứng từ code/IaC; con người **đánh giá và chấp nhận rủi ro**.
- Mỗi HRI → một ticket có chủ sở hữu và hạn; HRI được chấp nhận (không sửa) phải ghi lý do trong ADR.

## 7. Sai lầm thường gặp (kể cả của agent AI)

| Sai lầm | Hậu quả | Cách đúng |
|---|---|---|
| "Đã multi-AZ" nhưng chỉ có một NAT Gateway | Mất AZ chứa NAT → mất đường ra của mọi AZ | Một NAT mỗi AZ hoặc VPC endpoint cho dịch vụ AWS |
| Tính công suất 3 AZ = 100% tải | Mất 1 AZ → quá tải dây chuyền | Dự phòng N+1 theo AZ |
| Có backup cross-Region nhưng chưa từng dựng lại môi trường | RTO thực tế là "không biết" | Diễn tập DR định kỳ, đo thời gian |
| Region DR thiếu dịch vụ/quota/image | Failover thất bại đúng lúc cần | Readiness check, ECR replication, quota ở cả hai Region |
| Failover tự động theo một health check đơn | Failover nhầm, mất dữ liệu, split-brain | Con người quyết định failover Region; health check nhiều tín hiệu |
| Ứng dụng cache IP/kết nối DB vĩnh viễn | Không kết nối lại sau failover Aurora | Dùng endpoint DNS, TTL ngắn, retry kết nối, RDS Proxy |
| Agent đề xuất active/active đa Region "cho chắc" | Chi phí và độ phức tạp lớn, xung đột ghi | Chọn chiến lược theo RPO/RTO và ngân sách, ghi ADR |
| Chỉ test DR ở staging nhỏ | Không phát hiện vấn đề quota/công suất thật | Diễn tập có quy mô gần thật, ít nhất phần dữ liệu và định tuyến |

## Checklist review

- [ ] Mọi thành phần trạng thái (DB, cache, search) có replica ở AZ khác và failover tự động; compute trải 3 AZ.
- [ ] Công suất đủ phục vụ đỉnh khi mất 1 AZ (static stability), không phụ thuộc scale kịp thời.
- [ ] NAT Gateway mỗi AZ hoặc dùng VPC endpoint; route table theo AZ.
- [ ] RPO/RTO được định nghĩa bằng con số, được duyệt, ghi trong ADR; chiến lược DR khớp với chúng.
- [ ] Dữ liệu (Aurora, S3, image ECR, bí mật, khóa) có bản ở Region DR theo chiến lược đã chọn.
- [ ] Có runbook failover và failback Region; quyết định failover do con người; đã diễn tập và đo RTO thực tế.
- [ ] Quota ở Region chính và Region DR đủ cho đỉnh + hệ số an toàn; có cảnh báo mức dùng quota.
- [ ] Subnet đủ IP cho số task tối đa.
- [ ] Có thí nghiệm FIS với stop condition gắn alarm; game day định kỳ.
- [ ] Đã review Well-Architected; HRI có ticket, chủ sở hữu, hạn, hoặc được chấp nhận có lý do.
