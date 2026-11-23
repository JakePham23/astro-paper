---
title: "Compute trên AWS: EC2, ECS, EKS, Lambda"
description: "chọn đúng nền tảng chạy code cho từng thành phần của LearnHub và vận hành nó đúng cách (scale, Spot, bảo mật metadata, nâng cấp)."
pubDatetime: 2026-11-17T17:00:00Z
featured: false
tags:
  - aws
  - cloud
  - serverless
---
# Compute trên AWS: EC2, ECS, EKS, Lambda

**Mục đích:** chọn đúng nền tảng chạy code cho từng thành phần của LearnHub và vận hành nó đúng cách (scale, Spot, bảo mật metadata, nâng cấp).
**Liên quan:** [02-mang-vpc.md](02-mang-vpc.md) · [05-messaging-integration.md](05-messaging-integration.md) · [06-edge-cloudfront-alb-waf.md](06-edge-cloudfront-alb-waf.md) · [09-iac-ci-cd-aws.md](09-iac-ci-cd-aws.md) · [11-chi-phi-finops.md](11-chi-phi-finops.md) · [12-kien-truc-learnhub-tren-aws.md](12-kien-truc-learnhub-tren-aws.md) · [../07-he-thong-server/04-container-docker.md](../07-he-thong-server/04-container-docker.md) · [../07-he-thong-server/05-kubernetes.md](../07-he-thong-server/05-kubernetes.md)

> Giới hạn và giá thay đổi theo thời gian — số liệu dưới đây để định hướng; kiểm tra tài liệu và AWS Pricing hiện hành.

---

## 1. Bảng quyết định

| Tiêu chí | EC2 (ASG) | ECS on Fargate | ECS on EC2 | EKS | Lambda | App Runner |
|---|---|---|---|---|---|---|
| Đơn vị | Máy ảo | Task (container) | Task trên máy bạn quản lý | Pod trên K8s | Hàm | Container dịch vụ web |
| Quản lý OS/vá lỗi | Bạn | AWS | Bạn (AMI tối ưu ECS) | Node: bạn (hoặc Fargate/Auto Mode) | AWS | AWS |
| Độ phức tạp vận hành | Trung bình | **Thấp** | Trung bình | **Cao** | Thấp | Rất thấp |
| Thời gian chạy tối đa | Không giới hạn | Không giới hạn | Không giới hạn | Không giới hạn | **15 phút** | Không giới hạn (request có timeout) |
| Scale | Phút | ~30s–1 phút | Phụ thuộc capacity | Giây (pod) – phút (node) | Mili giây–giây | Tự động |
| Chi phí khi tải ổn định cao | Rẻ nhất (RI/SP, Spot) | Cao hơn EC2 ~20–40% cho cùng vCPU/RAM (tham khảo) | Rẻ (Spot) | Rẻ + phí control plane | Đắt nếu chạy liên tục | Trung bình |
| Chi phí khi tải thấp/rời rạc | Lãng phí | Trung bình | Lãng phí | Lãng phí | **Rẻ nhất** | Trung bình |
| GPU, kernel tùy chỉnh | Có | Không (GPU hạn chế) | Có | Có | Không | Không |
| Phù hợp đội | Có kinh nghiệm Linux | Đội nhỏ–vừa | Đội cần tối ưu chi phí | Đội có platform team, đa cloud, hệ sinh thái K8s | Sự kiện, glue code | Prototype |

> App Runner: kiểm tra trạng thái và lộ trình của dịch vụ trước khi chọn cho dự án dài hạn.

### Khuyến nghị cho LearnHub

| Thành phần | Chọn | Lý do |
|---|---|---|
| API Node (HTTP, WebSocket) | **ECS Fargate** | Tải ổn định, chạy liên tục, không cần quản lý node; đội nhỏ |
| Worker kiểm duyệt (đọc SQS) | ECS Fargate (+ Fargate Spot cho phần chịu được gián đoạn) | Chạy dài, scale theo độ dài hàng đợi |
| Chấm bài code (sandbox) | **EC2 riêng** (ASG, có thể Firecracker/gVisor/container cô lập) hoặc ECS on EC2 | Cần cô lập mạnh, kiểm soát kernel, có thể dùng Spot |
| Xử lý ảnh nhẹ sau upload, webhook, cron nhỏ | **Lambda** | Rời rạc, kích hoạt theo sự kiện |
| Báo cáo/ETL hàng đêm | ECS scheduled task / Step Functions + Fargate | Có thể >15 phút |
| Nếu công ty đã có platform K8s | EKS | Tận dụng công cụ, chuẩn chung |

**Không chọn EKS chỉ vì "chuẩn ngành"**: chi phí vận hành (nâng cấp phiên bản, add-on, bảo mật cluster) là thật và lặp lại.

## 2. EC2 chuyên sâu

### Họ instance

| Họ | Đặc điểm | LearnHub dùng cho |
|---|---|---|
| `t` (burstable) | CPU credit; rẻ; **mất hiệu năng khi hết credit** | Dev, công cụ nội bộ — không cho prod tải cao |
| `m` | Cân bằng CPU/RAM | Node chạy API chung |
| `c` | Thiên CPU | Chấm bài code, xử lý ảnh |
| `r` | Thiên RAM | Cache tự quản, DB tự quản |
| `i` | NVMe local tốc độ cao | Workload I/O tạm (dữ liệu mất khi stop) |
| `g`/`p`/`inf`/`trn` | GPU/accelerator | Mô hình kiểm duyệt nội dung tự host |

Tên dạng `m7g.large`: `m` họ, `7` thế hệ, `g` = **Graviton (ARM)**, `i` = Intel, `a` = AMD.

- **Graviton**: giá/hiệu năng thường tốt hơn x86 cùng thế hệ (AWS công bố mức cải thiện đáng kể; tự đo với workload của bạn). Node.js, Java, Python, Go chạy tốt trên ARM; cần build image `linux/arm64` (multi-arch).
- **Nitro**: hypervisor phần cứng của AWS; gần như mọi thế hệ mới dùng Nitro — cần cho nhiều tính năng (ENA, EBS NVMe, Nitro Enclaves).

### EBS gp3

- gp3 tách **dung lượng, IOPS, throughput**: mặc định 3.000 IOPS và 125 MB/s bất kể dung lượng; mua thêm IOPS/throughput độc lập. Rẻ hơn gp2 và thường nhanh hơn ở dung lượng nhỏ → **chuyển gp2 sang gp3** (đổi online được).
- Giới hạn tối đa của gp3 đã được nâng trong các bản gần đây — kiểm tra docs. Ngoài ra instance cũng có **giới hạn băng thông EBS** riêng; volume nhanh mà instance nhỏ vẫn bị nghẽn.
- io2 Block Express cho DB tự quản cần IOPS rất cao và độ bền cao.
- Snapshot EBS lưu ở S3 (tăng dần); dùng **Data Lifecycle Manager** hoặc AWS Backup để tự động.

### IMDSv2 — bắt buộc

Instance Metadata Service cấp credential của role tại `169.254.169.254`. IMDSv1 (GET đơn giản) bị khai thác qua **SSRF**: ứng dụng có lỗ hổng fetch URL do người dùng cung cấp → kẻ tấn công lấy credential role. IMDSv2 yêu cầu token qua PUT và hop limit, chặn phần lớn kiểu tấn công này.

```hcl
resource "aws_launch_template" "grader" {
  name_prefix   = "learnhub-grader-"
  image_id      = data.aws_ami.al2023_arm.id
  instance_type = "c7g.xlarge"

  metadata_options {
    http_tokens                 = "required"   # IMDSv2 bắt buộc
    http_put_response_hop_limit = 1            # 1 nếu không có container cần IMDS; 2 nếu container trên host cần
    http_endpoint               = "enabled"
  }

  iam_instance_profile { name = aws_iam_instance_profile.grader.name }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_type = "gp3"
      volume_size = 50
      encrypted   = true
      kms_key_id  = aws_kms_key.ebs.arn
    }
  }
}
```

Đặt mặc định cấp tài khoản: `aws ec2 modify-instance-metadata-defaults --region ap-southeast-1 --http-tokens required`. Có thể ép bằng SCP với điều kiện `ec2:MetadataHttpTokens`.

### Auto Scaling Group (ASG)

- **Launch template** có version; ASG trỏ tới `$Latest` hoặc version cố định. Cập nhật AMI → **Instance Refresh** (thay dần, giữ `MinHealthyPercentage`).
- Scaling policy:
  - **Target tracking** (khuyến nghị mặc định): giữ CPU 50% hoặc `ALBRequestCountPerTarget` ở mức mục tiêu.
  - **Step scaling**: ngưỡng nhiều bậc.
  - **Scheduled**: biết trước đỉnh (giờ thi 8h sáng) → tăng trước 15 phút.
  - **Predictive scaling**: học từ lịch sử theo chu kỳ.
- **Lifecycle hooks**: giữ instance ở trạng thái `Pending:Wait` (cài đặt, warm cache) hoặc `Terminating:Wait` (drain job đang chạy, đẩy log) trước khi chuyển trạng thái.
- **Warm pools**: giữ sẵn instance đã khởi tạo ở trạng thái stopped/hibernated → scale-out nhanh hơn cho ứng dụng khởi động chậm.
- Health check: dùng **ELB health check** cho ASG sau ALB (không chỉ EC2 status check), có grace period.

### Spot

- Giảm giá lớn so với On-Demand (tham khảo, thay đổi theo loại/AZ), đổi lại có thể bị thu hồi với **cảnh báo 2 phút** (và tín hiệu *rebalance recommendation* sớm hơn).
- Phù hợp: worker stateless, chấm bài (có thể chạy lại), CI runner, batch. **Không** cho DB, hay cho phần duy nhất của API.
- Thực hành:
  - Đa dạng loại instance (≥ 6–10 loại, nhiều AZ) với chiến lược `price-capacity-optimized`.
  - **Mixed instances policy**: base On-Demand cho mức tối thiểu + Spot phần dư.
  - Xử lý gián đoạn: lắng nghe sự kiện (EventBridge `EC2 Spot Instance Interruption Warning` hoặc IMDS `spot/instance-action`) → ngừng nhận job, trả job dở về hàng đợi (SQS visibility), thoát sạch.
  - Job phải **idempotent** và có checkpoint.

## 3. ECS

### Khái niệm

| Thành phần | Ý nghĩa |
|---|---|
| Cluster | Nhóm logic chứa service/task |
| Task definition | "Bản vẽ" container: image, CPU/RAM, cổng, biến môi trường, secret, log, **task role**, **execution role** |
| Task | Một lần chạy task definition |
| Service | Duy trì N task, gắn ALB, rolling deploy, auto scaling |
| Capacity provider | Fargate, Fargate Spot, hoặc ASG (EC2) — có thể trộn theo tỉ lệ |

### Task definition (trích) cho API

```json
{
  "family": "learnhub-api",
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "1024",
  "memory": "2048",
  "runtimePlatform": { "cpuArchitecture": "ARM64", "operatingSystemFamily": "LINUX" },
  "executionRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/learnhub-api-exec",
  "taskRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/learnhub-api-task",
  "containerDefinitions": [{
    "name": "api",
    "image": "<ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/learnhub-api@sha256:<DIGEST>",
    "portMappings": [{ "containerPort": 3000, "protocol": "tcp" }],
    "readonlyRootFilesystem": true,
    "user": "1000",
    "environment": [{ "name": "NODE_ENV", "value": "production" }],
    "secrets": [{ "name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:ap-southeast-1:<ACCOUNT_ID>:secret:<SECRET_NAME>" }],
    "healthCheck": { "command": ["CMD-SHELL", "wget -qO- http://localhost:3000/healthz || exit 1"], "interval": 15, "timeout": 5, "retries": 3, "startPeriod": 30 },
    "stopTimeout": 30,
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": { "awslogs-group": "/ecs/learnhub-api", "awslogs-region": "ap-southeast-1", "awslogs-stream-prefix": "api" }
    }
  }]
}
```

Điểm cần nhớ:

- **Execution role** (ECS agent dùng: kéo image từ ECR, đọc secret để inject, ghi log) ≠ **task role** (code của bạn dùng: S3, SQS…). Agent hay nhầm và gộp, làm role quá rộng.
- `secrets` inject giá trị từ Secrets Manager/SSM lúc khởi động — không ghi secret vào `environment`.
- Image bằng **digest**, không tag `latest`.
- `stopTimeout` + xử lý SIGTERM trong Node để drain kết nối (ECS gửi SIGTERM, chờ, rồi SIGKILL).

### Service: deploy và scale

- Rolling update với `minimumHealthyPercent`/`maximumPercent` (ví dụ 100/200) và **deployment circuit breaker** (tự rollback khi task mới liên tục lỗi).
- Blue/green qua CodeDeploy hoặc tính năng blue/green tích hợp của ECS (kiểm tra khả dụng) khi cần chuyển traffic có kiểm soát.
- Auto scaling service: target tracking theo `ECSServiceAverageCPUUtilization` hoặc `ALBRequestCountPerTarget`; worker scale theo `ApproximateNumberOfMessagesVisible`/backlog-per-task của SQS.
- **Service Connect**: service discovery + proxy giữa các service ECS (thay cho tự cấu hình Cloud Map + App Mesh — App Mesh đã có thông báo ngừng hỗ trợ, kiểm tra lộ trình).
- **ECS Exec** để vào container debug (qua SSM, có log) thay vì mở SSH.

### Fargate vs EC2 launch type

| | Fargate | EC2 |
|---|---|---|
| Quản lý host | Không | Có (AMI ECS-optimized, vá lỗi, ASG) |
| Cô lập | Mỗi task một micro-VM | Nhiều task chung host |
| Giá | Theo vCPU/GB-giờ của task | Theo instance; bin-packing tốt thì rẻ hơn |
| Spot | Fargate Spot | EC2 Spot |
| GPU / daemon / privileged | Hạn chế | Có |
| Khởi động | Kéo image mỗi lần (image nhỏ quan trọng; có thể dùng SOCI lazy loading) | Image có thể đã cache trên host |

## 4. EKS

### Chi phí và vòng đời

- **Phí control plane** theo giờ mỗi cluster (tham khảo AWS Pricing). Phiên bản K8s có thời gian **hỗ trợ tiêu chuẩn ~14 tháng**, sau đó vào **extended support** với phí control plane cao hơn nhiều. → Phải có lịch nâng cấp **ít nhất 1–2 lần/năm** (control plane → add-on → node).
- Nâng cấp từng minor version một; kiểm tra API deprecated (công cụ như `kubent`/`pluto`, EKS upgrade insights).

### Node: Managed node groups vs Karpenter vs Fargate vs Auto Mode

| | Managed node group | Karpenter | Fargate profile | EKS Auto Mode |
|---|---|---|---|---|
| Cách scale | Cluster Autoscaler trên ASG | Tự chọn loại instance phù hợp với pod đang Pending, consolidation | Mỗi pod một micro-VM | AWS quản lý node, Karpenter tích hợp, nhiều add-on |
| Đa dạng instance/Spot | Hạn chế theo node group | **Rất tốt** | Không Spot (trên EKS) | Tốt |
| Vận hành | Trung bình | Trung bình (cấu hình NodePool) | Thấp | Thấp, có phí quản lý thêm |
| Hạn chế | Chậm, nhiều node group | Cần hiểu disruption/consolidation | Không DaemonSet, không privileged, không EBS (tùy) | Ít tùy biến hơn |

Khuyến nghị: Karpenter (hoặc Auto Mode nếu muốn giảm vận hành) cho workload chung; PodDisruptionBudget để consolidation không làm gián đoạn.

### Quyền cho pod: IRSA vs EKS Pod Identity

| | IRSA | EKS Pod Identity |
|---|---|---|
| Cơ chế | OIDC provider của cluster + annotation ServiceAccount + trust policy theo `sub` | Agent add-on + **association** (namespace, serviceaccount → role) |
| Trust policy | Mỗi cluster một OIDC provider → phải sửa trust khi thêm cluster | Trust chung `pods.eks.amazonaws.com`, tái dùng role giữa cluster |
| Khuyến nghị | Cluster cũ, môi trường đã dùng | **Mặc định cho cluster mới** |

```bash
aws eks create-pod-identity-association \
  --cluster-name learnhub-prod \
  --namespace learnhub \
  --service-account api \
  --role-arn arn:aws:iam::<ACCOUNT_ID>:role/learnhub-api-pod
```

Chặn pod truy cập IMDS của node (hop limit 1 trên node, hoặc NetworkPolicy) để pod không "mượn" role của node.

### AWS Load Balancer Controller

- Tạo ALB từ `Ingress` (hoặc Gateway API) và NLB từ `Service type LoadBalancer`.
- `target-type: ip` (trỏ thẳng vào pod IP) khuyến nghị với VPC CNI — tránh hop qua NodePort.
- Gom nhiều Ingress vào một ALB bằng `group.name` để tiết kiệm.

## 5. Lambda

### Giới hạn quan trọng (kiểm tra docs hiện hành)

| Giới hạn | Giá trị thường gặp |
|---|---|
| Thời gian chạy tối đa | 15 phút |
| Bộ nhớ | 128 MB – 10.240 MB (CPU tăng theo RAM) |
| Payload gọi đồng bộ | ~6 MB |
| `/tmp` | 512 MB mặc định, cấu hình tới 10 GB |
| Concurrency mặc định mỗi region | Thường 1.000 (tài khoản mới có thể thấp hơn) — tăng qua Service Quotas |
| Gói triển khai | Zip (giới hạn kích thước) hoặc container image tới 10 GB |

### Cold start

- Lần gọi đầu tiên sau khi scale hoặc lâu không dùng: khởi tạo môi trường + runtime + code init. Node.js thường vài trăm ms; VPC Lambda hiện không còn cộng thêm nhiều giây như trước (Hyperplane ENI).
- Giảm: gói nhỏ (bundle bằng esbuild, bỏ dependency thừa), khởi tạo SDK client ngoài handler, ARM64.
- **Provisioned concurrency**: giữ sẵn môi trường đã init (trả phí liên tục) — cho API nhạy độ trễ.
- **SnapStart**: chụp snapshot sau init; hỗ trợ Java, và đã mở rộng cho Python và .NET — **không áp dụng Node.js** tại thời điểm viết (kiểm tra lại).

### Concurrency

- **Reserved concurrency**: đảm bảo *và* giới hạn tối đa cho một hàm → bảo vệ DB khỏi bị 1.000 Lambda đồng thời mở 1.000 kết nối. Đặt 0 = tắt khẩn cấp.
- Lambda + RDS: dùng **RDS Proxy** hoặc Data API (Aurora) để gom kết nối.

### Lambda + SQS

- **Visibility timeout của queue ≥ 6 × timeout của hàm** (khuyến nghị AWS) để message không bị giao lại trong khi đang xử lý/retry.
- Bật `ReportBatchItemFailures` để chỉ trả lại message lỗi trong batch, không xử lý lại cả batch.
- Giới hạn `maximum concurrency` trên event source mapping để không làm quá tải downstream.
- DLQ/redrive policy trên queue nguồn.

### Khi KHÔNG dùng Lambda

- Tải đều và cao 24/7 (container rẻ hơn).
- Việc > 15 phút hoặc cần trạng thái dài (WebSocket server tự quản, kết nối DB lâu dài).
- Cần độ trễ p99 rất ổn định mà không muốn trả provisioned concurrency.
- Phụ thuộc thư viện native nặng/GPU.

## 6. Câu chuyện sự cố

| Sự cố | Nguyên nhân | Bài học |
|---|---|---|
| API chậm dần rồi treo vào giờ thi | Instance `t3` hết CPU credit | Không dùng burstable cho prod tải cao, hoặc bật unlimited và theo dõi |
| DB "too many connections" khi có đợt upload lớn | Lambda xử lý ảnh scale lên 800 concurrent, mỗi cái mở kết nối | Reserved concurrency, RDS Proxy, đẩy vào hàng đợi |
| Credential role bị đánh cắp | Tính năng "nhập URL ảnh đại diện" có SSRF + IMDSv1 | IMDSv2 bắt buộc, chặn IP link-local trong fetcher (xem [../05-backend-senior/11-bao-mat.md](../05-backend-senior/11-bao-mat.md)) |
| Message chấm bài bị chấm 2 lần | Visibility timeout 30s < thời gian chạy hàm 60s | Visibility ≥ 6× timeout, consumer idempotent |
| Cluster EKS vào extended support, hóa đơn control plane tăng mạnh | Không có lịch nâng cấp | Lịch nâng cấp định kỳ, cảnh báo ngày hết hỗ trợ |
| Deploy hỏng toàn bộ service | Image tag `latest` bị ghi đè bởi build lỗi | Image theo digest, circuit breaker |

## 7. Lỗi hay gặp (kể cả do AI agent viết)

- Dùng tag `latest`; không đặt CPU/RAM hợp lý; không healthcheck.
- Gộp execution role và task role, gắn `AmazonS3FullAccess`.
- Ghi secret vào `environment` của task definition hoặc user data EC2.
- Không xử lý SIGTERM → mất request khi deploy/scale-in.
- `http_tokens = "optional"` (IMDSv1) "để tương thích".
- Spot cho thành phần stateful hoặc không xử lý thông báo gián đoạn.
- Lambda không đặt reserved concurrency khi gọi DB; visibility timeout mặc định với hàm chạy lâu.
- Mở SSH (cổng 22) để debug thay vì ECS Exec/SSM.

## Checklist review

- [ ] Lựa chọn compute cho từng thành phần có lý do (bảng mục 1), không chọn EKS/Lambda theo cảm tính.
- [ ] IMDSv2 bắt buộc (launch template + mặc định tài khoản); hop limit phù hợp.
- [ ] EBS gp3, mã hóa bằng KMS; snapshot/backup tự động.
- [ ] ASG: health check ELB, instance refresh, lifecycle hook drain; scaling policy phù hợp đỉnh tải (scheduled cho giờ thi).
- [ ] Spot chỉ cho workload stateless/idempotent, đa dạng loại instance, có xử lý gián đoạn.
- [ ] ECS: image theo digest, task role tối thiểu tách khỏi execution role, secret qua `secrets`, healthcheck, `stopTimeout` + xử lý SIGTERM, circuit breaker.
- [ ] Không SSH mở; debug qua ECS Exec/SSM.
- [ ] EKS (nếu dùng): Pod Identity/IRSA, chặn IMDS từ pod, lịch nâng cấp phiên bản, PDB, LB controller `target-type: ip`.
- [ ] Lambda: reserved concurrency khi gọi tài nguyên giới hạn; visibility timeout ≥ 6× timeout; partial batch failure; DLQ.
- [ ] Image build cho đúng kiến trúc (arm64 nếu Graviton), đã scan lỗ hổng.
