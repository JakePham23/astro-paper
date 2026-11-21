---
title: "Mạng AWS: VPC, subnet, NAT, endpoint, kết nối và Route 53"
description: "thiết kế mạng cho LearnHub trên AWS sao cho an toàn (DB không bao giờ ra Internet), sẵn sàng cao (đa AZ), mở rộng được (không trùng CIDR khi nối nhiều VPC) và không bị \"bẫy chi..."
pubDatetime: 2026-11-17T18:00:00Z
featured: false
tags:
  - aws
  - cloud
  - networking
---
# Mạng AWS: VPC, subnet, NAT, endpoint, kết nối và Route 53

**Mục đích:** thiết kế mạng cho LearnHub trên AWS sao cho an toàn (DB không bao giờ ra Internet), sẵn sàng cao (đa AZ), mở rộng được (không trùng CIDR khi nối nhiều VPC) và không bị "bẫy chi phí" (NAT Gateway, IPv4 công khai, traffic liên AZ).
**Liên quan:** [01-tai-khoan-iam-organizations.md](01-tai-khoan-iam-organizations.md) · [03-compute-ec2-ecs-eks-lambda.md](03-compute-ec2-ecs-eks-lambda.md) · [06-edge-cloudfront-alb-waf.md](06-edge-cloudfront-alb-waf.md) · [11-chi-phi-finops.md](11-chi-phi-finops.md) · [12-kien-truc-learnhub-tren-aws.md](12-kien-truc-learnhub-tren-aws.md) · [../07-he-thong-server/02-mang-network.md](../07-he-thong-server/02-mang-network.md) · [../07-he-thong-server/07-cloud-kien-truc.md](../07-he-thong-server/07-cloud-kien-truc.md)

> Giá trong tài liệu chỉ mang tính tham khảo — kiểm tra AWS Pricing cho ap-southeast-1 trước khi ra quyết định.

---

## 1. Lập kế hoạch CIDR — làm đúng từ đầu

Đổi CIDR chính của VPC sau này gần như là dựng lại mạng. Trùng CIDR giữa các VPC (hoặc với mạng văn phòng/on-prem) làm **không thể** peering/Transit Gateway định tuyến bình thường.

Nguyên tắc:

1. Lấy một khối lớn cho toàn công ty trên AWS (ví dụ `10.64.0.0/10`), không trùng với mạng văn phòng (thường `10.0.0.0/8` con hoặc `192.168.x.x`) — **hỏi team IT trước**.
2. Chia theo region → môi trường → VPC. Dùng **Amazon VPC IP Address Manager (IPAM)** để cấp phát và phát hiện trùng.
3. VPC đủ lớn (`/16` cho workload chính) — IP rẻ, thiếu IP thì đắt (EKS dùng VPC CNI tiêu tốn IP theo pod).

Ví dụ phân bổ LearnHub:

| VPC | Region | CIDR | Ghi chú |
|---|---|---|---|
| learnhub-prod | ap-southeast-1 | `10.64.0.0/16` | 65.536 IP |
| learnhub-staging | ap-southeast-1 | `10.65.0.0/16` | |
| learnhub-dev | ap-southeast-1 | `10.66.0.0/16` | |
| network-hub (egress, TGW) | ap-southeast-1 | `10.70.0.0/20` | |
| learnhub-prod-dr | (region DR) | `10.80.0.0/16` | Không trùng với prod để có thể nối |
| Văn phòng HN/HCM | on-prem | `172.16.0.0/16` | Đã có sẵn — tránh |

Nhớ: AWS giữ **5 IP** mỗi subnet (địa chỉ mạng, router VPC, DNS, dự phòng, broadcast).

## 2. Bố cục subnet: 3 tầng × 3 AZ

ap-southeast-1 có 3 AZ trở lên. Production dùng **3 AZ** (chịu được mất 1 AZ mà vẫn đa số cho các hệ thống cần quorum).

| Tầng | Chứa | Route mặc định | Kích thước mỗi AZ |
|---|---|---|---|
| public | ALB, NAT Gateway | `0.0.0.0/0 → IGW` | `/24` |
| private-app | ECS task / EKS node / EC2 API, worker | `0.0.0.0/0 → NAT GW cùng AZ` | `/19` (nhiều IP cho container) |
| private-data | RDS/Aurora, ElastiCache, MSK, OpenSearch | **Không có** route ra Internet | `/22` |

```
10.64.0.0/16
├── public       10.64.0.0/24   (a)   10.64.1.0/24   (b)   10.64.2.0/24   (c)
├── private-app  10.64.32.0/19  (a)   10.64.64.0/19  (b)   10.64.96.0/19  (c)
└── private-data 10.64.128.0/22 (a)   10.64.132.0/22 (b)   10.64.136.0/22 (c)
```

Tầng data **không có route ra Internet**: kể cả bị chiếm quyền, DB không thể gọi ra ngoài để tuồn dữ liệu (trừ qua endpoint đã cho phép).

## 3. Route table, IGW, NAT

- **Internet Gateway (IGW)**: một mỗi VPC, cho phép tài nguyên có IP công khai giao tiếp hai chiều với Internet.
- **NAT Gateway**: cho tài nguyên private **gọi ra** Internet (tải package, gọi API bên thứ ba như dịch vụ gửi email), nhưng không nhận kết nối vào.

### NAT Gateway: một mỗi AZ hay một cho cả VPC?

| Cách | Ưu | Nhược |
|---|---|---|
| 1 NAT GW cho cả VPC | Rẻ hơn (ít phí giờ) | Mất AZ chứa NAT = mọi AZ mất đường ra; traffic liên AZ tốn phí |
| 1 NAT GW **mỗi AZ** | Chịu lỗi AZ, không phí liên AZ | Phí giờ × 3 |

**Prod: mỗi AZ một NAT GW.** Dev: một NAT GW (hoặc NAT instance) là chấp nhận được.

### Bẫy chi phí NAT

NAT GW tính **phí giờ + phí mỗi GB xử lý**. Các luồng lớn hay đi qua NAT một cách vô tình:

- Task kéo image từ ECR → qua NAT (nếu không có endpoint).
- Ứng dụng ghi/đọc S3 (media, backup) → qua NAT.
- Gửi log ra CloudWatch/bên thứ ba.

Ví dụ: worker xử lý 20 TB media/tháng qua NAT → riêng phí xử lý NAT có thể lên hàng trăm đến hơn một nghìn USD/tháng (tham khảo giá/GB của region). Một **S3 gateway endpoint** miễn phí loại bỏ khoản này.

### NAT instance

EC2 tự làm NAT (ví dụ dùng `fck-nat` hoặc AMI tự build). Rẻ hơn nhiều cho dev/staging, nhưng bạn tự lo HA, vá lỗi, băng thông theo loại instance. Không khuyến nghị cho prod trừ khi chi phí là vấn đề lớn và có đội vận hành.

## 4. VPC Endpoint

| Loại | Dịch vụ | Chi phí | Cơ chế |
|---|---|---|---|
| **Gateway endpoint** | Chỉ S3 và DynamoDB | **Miễn phí** | Thêm route vào route table (prefix list) |
| **Interface endpoint** (PrivateLink) | Hầu hết dịch vụ: ECR, CloudWatch Logs, Secrets Manager, SQS, STS, KMS, SSM… | Phí giờ mỗi AZ + phí/GB | ENI với IP private trong subnet, DNS private |

Khuyến nghị LearnHub:

- **Luôn** tạo gateway endpoint S3 (+ DynamoDB nếu dùng).
- Interface endpoint cho: `ecr.api`, `ecr.dkr`, `logs`, `secretsmanager`, `sts`, `kms`, `sqs`, `ssm`/`ssmmessages`/`ec2messages` (nếu dùng Session Manager). Mỗi endpoint × 3 AZ có phí giờ — so với lượng traffic qua NAT để quyết định. Với nhiều VPC, cân nhắc **tập trung endpoint** ở VPC hub chia sẻ qua Transit Gateway + Route 53 Resolver.

Endpoint policy giới hạn dữ liệu chỉ đi tới tài nguyên trong tổ chức:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
    "Resource": "*",
    "Condition": { "StringEquals": { "aws:ResourceOrgID": "<ORG_ID>" } }
  },
  {
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::prod-ap-southeast-1-starport-layer-bucket/*"
  }]
}
```

(Statement thứ hai cho phép ECR kéo layer image từ bucket do AWS quản lý — thiếu nó, ECS/EKS sẽ không kéo được image khi endpoint policy chặt. Kiểm tra tên bucket theo tài liệu ECR cho region.)

## 5. Security Group vs Network ACL

| | Security Group | Network ACL |
|---|---|---|
| Gắn vào | ENI (instance, task, RDS…) | Subnet |
| Trạng thái | **Stateful** — cho phép vào thì tự cho phản hồi ra | **Stateless** — phải mở cả chiều về (cổng ephemeral 1024–65535) |
| Rule | Chỉ Allow | Allow và Deny, đánh số thứ tự |
| Tham chiếu | Có thể tham chiếu **SG khác** | Chỉ CIDR |
| Dùng chính | Kiểm soát chi tiết từng tầng | Lớp chặn thô (chặn dải IP xấu), thường để mặc định |

### SG theo chuỗi tầng (tham chiếu bằng ID, không bằng CIDR)

| SG | Inbound | Từ |
|---|---|---|
| `sg-alb` | 443 | `0.0.0.0/0` (hoặc chỉ prefix list CloudFront nếu ALB đứng sau CloudFront) |
| `sg-api` | 3000 | `sg-alb` |
| `sg-worker` | (không inbound) | — |
| `sg-db` | 5432 | `sg-api`, `sg-worker` |
| `sg-redis` | 6379 | `sg-api`, `sg-worker` |

Lợi ích: khi API scale từ 3 lên 300 task với IP thay đổi liên tục, rule DB không cần sửa.

Outbound: mặc định SG cho phép mọi outbound. Với tầng nhạy cảm có thể giới hạn outbound (ví dụ `sg-db` không cần outbound nào ngoài phản hồi — vốn đã stateful).

**Không bao giờ**: `0.0.0.0/0` vào cổng 22 (SSH), 3389 (RDP), 5432, 6379, 9092. Truy cập vận hành dùng **SSM Session Manager** (không cần mở cổng, có log) thay vì bastion SSH.

## 6. VPC Flow Logs

Ghi metadata từng luồng (src, dst, port, bytes, ACCEPT/REJECT) — không ghi nội dung.

```bash
aws ec2 create-flow-logs \
  --resource-type VPC --resource-ids <VPC_ID> \
  --traffic-type ALL \
  --log-destination-type s3 \
  --log-destination arn:aws:s3:::learnhub-log-archive/vpc-flow-logs/ \
  --max-aggregation-interval 600
```

- Gửi về S3 trong tài khoản log-archive (rẻ hơn CloudWatch Logs cho khối lượng lớn), truy vấn bằng Athena.
- Dùng để: điều tra sự cố bảo mật, tìm "ai đang gọi DB", tìm luồng tốn phí NAT/liên AZ.
- GuardDuty dùng nguồn Flow Logs riêng của nó (không cần bạn bật để GuardDuty hoạt động), nhưng bạn vẫn cần log của riêng mình để điều tra.

## 7. Kết nối nhiều VPC: Peering vs Transit Gateway vs PrivateLink

| | VPC Peering | Transit Gateway (TGW) | PrivateLink (endpoint service) |
|---|---|---|---|
| Mô hình | 1-1 | Hub-and-spoke | Cung cấp **một dịch vụ** (sau NLB) cho VPC khác |
| Bắc cầu (transitive) | **Không** | Có (qua route table TGW) | Không áp dụng |
| CIDR trùng | Không được | Không được (trừ NAT) | **Được** — chỉ lộ một endpoint |
| Chi phí | Không phí giờ, phí data liên AZ/region | Phí giờ mỗi attachment + phí/GB | Phí endpoint giờ + /GB |
| Quy mô | Vài VPC | Hàng chục–nghìn VPC, kết nối on-prem tập trung | Chia sẻ dịch vụ cho nhiều tài khoản/khách hàng |
| Dùng khi | 2–3 VPC, đơn giản | Nhiều tài khoản, cần kiểm soát tập trung, nối VPN/DX | Chia sẻ API nội bộ mà không mở cả mạng |

LearnHub giai đoạn đầu: 1 VPC prod, không cần TGW. Khi có tài khoản network-hub, nhiều môi trường cần chia sẻ dịch vụ hoặc kết nối on-prem → TGW.

## 8. Route 53

| Tính năng | Ghi chú |
|---|---|
| Public hosted zone | DNS công khai: `learnhub.example`, `api.learnhub.example` |
| Private hosted zone | Chỉ phân giải trong VPC gắn kèm: `db.internal.learnhub` |
| Alias record | Trỏ tới ALB/CloudFront/S3 website… ở apex domain; miễn phí truy vấn tới tài nguyên AWS; tự theo IP thay đổi |
| Routing policy | Simple, Weighted (canary 5%), Latency, Failover (active-passive DR), Geolocation, Geoproximity, Multivalue, IP-based |
| Health check | Kiểm tra HTTP/HTTPS/TCP từ nhiều điểm; kết hợp failover |
| Route 53 Resolver | Inbound/outbound endpoint để phân giải DNS hai chiều với on-prem; Resolver DNS Firewall chặn domain độc hại |

Lưu ý:

- **TTL**: trước khi chuyển hệ thống (migration, DR), hạ TTL xuống 60s trước ít nhất một chu kỳ TTL cũ.
- Health check failover chỉ hiệu quả nếu client tôn trọng TTL — nhiều client/ISP cache lâu hơn.
- Bật **DNSSEC** cho public zone nếu yêu cầu bảo mật cao (kèm quy trình quản lý KSK).
- Bảo vệ domain: registrar lock, chuyển giao domain cần phê duyệt.

## 9. Kết nối on-premise / văn phòng

| | Site-to-Site VPN | Direct Connect (DX) |
|---|---|---|
| Đường truyền | IPsec qua Internet | Kết nối vật lý riêng qua đối tác/điểm DX |
| Thời gian triển khai | Vài giờ | Vài tuần–tháng |
| Băng thông | Mỗi tunnel giới hạn (khoảng ~1,25 Gbps — kiểm tra docs); ECMP qua TGW để cộng gộp | 1/10/100 Gbps (dedicated) hoặc hosted nhỏ hơn |
| Độ trễ | Biến động theo Internet | Ổn định |
| Mã hóa | Có sẵn (IPsec) | **Không** mặc định — dùng MACsec (một số cổng) hoặc VPN trên DX |
| HA | 2 tunnel mỗi kết nối; nên 2 thiết bị khách hàng | Cần 2 kết nối ở 2 vị trí DX cho SLA cao; VPN làm dự phòng |

LearnHub: văn phòng chỉ cần truy cập công cụ nội bộ → **Client VPN** hoặc truy cập qua Identity Center + SSM là đủ; Site-to-Site VPN khi cần đồng bộ với hệ thống on-prem (HR, SSO nội bộ). DX chỉ khi khối lượng dữ liệu lớn/ổn định.

## 10. IPv6 và phí IPv4 công khai

- Từ 2024, AWS **tính phí mọi IPv4 công khai** (kể cả Elastic IP đang gắn, IP của NAT GW, ALB…) theo giờ. Với hàng trăm IP, đây là khoản đáng kể.
- Giảm: không gán IP công khai cho task/instance (dùng private subnet + NAT/endpoint); dùng **Public IP Insights** trong IPAM để kiểm kê.
- **Dual-stack** (IPv4 + IPv6): ALB, CloudFront hỗ trợ IPv6. Subnet private có thể dùng **egress-only Internet Gateway** cho IPv6 outbound (không cần NAT, không có phí xử lý NAT).
- Chuyển sang IPv6-only còn phụ thuộc mọi dịch vụ/thư viện hỗ trợ — làm từng bước, kiểm tra từng dịch vụ.

## 11. Độ trễ và vị trí cho người dùng Việt Nam

- Người dùng chủ yếu ở Việt Nam → `ap-southeast-1` (Singapore) là lựa chọn phổ biến; độ trễ khứ hồi thường vài chục ms (đo thực tế từ các nhà mạng chính).
- CloudFront có điểm hiện diện (edge) tại Việt Nam → nội dung tĩnh/media nhanh hơn nhiều.
- AWS đã công bố **Local Zone tại Hà Nội**; danh sách dịch vụ ở Local Zone hạn chế (thường EC2, EBS, một số dịch vụ khác). **Tự kiểm tra** tình trạng và dịch vụ khả dụng trước khi thiết kế phụ thuộc vào nó.
- **Lưu trú dữ liệu**: Nghị định 13/2023 (bảo vệ dữ liệu cá nhân) và Nghị định 53/2022 (an ninh mạng) có thể đặt yêu cầu lưu trữ/chuyển dữ liệu ra nước ngoài (hồ sơ đánh giá tác động chuyển dữ liệu). Cần ý kiến pháp chế — không tự kết luận từ tài liệu kỹ thuật này.

## 12. Terraform cho VPC LearnHub

Dùng module cộng đồng `terraform-aws-modules/vpc/aws` (pin phiên bản) để tránh tự viết hàng trăm dòng.

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"   # pin; kiểm tra phiên bản mới nhất và changelog trước khi nâng

  name = "learnhub-prod"
  cidr = "10.64.0.0/16"
  azs  = ["ap-southeast-1a", "ap-southeast-1b", "ap-southeast-1c"]

  public_subnets   = ["10.64.0.0/24", "10.64.1.0/24", "10.64.2.0/24"]
  private_subnets  = ["10.64.32.0/19", "10.64.64.0/19", "10.64.96.0/19"]   # tầng app
  database_subnets = ["10.64.128.0/22", "10.64.132.0/22", "10.64.136.0/22"]  # tầng data

  enable_nat_gateway     = true
  single_nat_gateway     = false   # prod: mỗi AZ một NAT
  one_nat_gateway_per_az = true

  create_database_subnet_group           = true
  create_database_subnet_route_table     = true
  create_database_internet_gateway_route = false   # tầng data không ra Internet
  create_database_nat_gateway_route      = false

  enable_dns_hostnames = true
  enable_dns_support   = true

  enable_flow_log                      = true
  flow_log_destination_type            = "s3"
  flow_log_destination_arn             = "arn:aws:s3:::learnhub-log-archive"
  flow_log_max_aggregation_interval    = 600

  map_public_ip_on_launch = false

  tags = { project = "learnhub", env = "prod", owner = "platform" }
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = module.vpc.vpc_id
  service_name      = "com.amazonaws.ap-southeast-1.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = concat(module.vpc.private_route_table_ids, module.vpc.database_route_table_ids)
}

resource "aws_security_group" "db" {
  name   = "learnhub-prod-db"
  vpc_id = module.vpc.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "db_from_api" {
  security_group_id            = aws_security_group.db.id
  referenced_security_group_id = aws_security_group.api.id   # tham chiếu SG, không CIDR
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}
```

## 13. Câu chuyện sự cố

| Sự cố | Nguyên nhân | Bài học |
|---|---|---|
| Hóa đơn NAT tăng gấp 5 sau khi ra tính năng video | Worker tải/ghi S3 qua NAT | S3 gateway endpoint; theo dõi `BytesOutToDestination` của NAT |
| Cả hệ thống mất kết nối ra ngoài khi một AZ gặp sự cố | Một NAT GW duy nhất ở AZ đó | NAT mỗi AZ cho prod |
| Không peering được với VPC của đối tác | Cả hai dùng `10.0.0.0/16` | IPAM, CIDR có kế hoạch; PrivateLink khi CIDR trùng |
| DB bị dò mật khẩu từ Internet | RDS `publicly_accessible = true` + SG `0.0.0.0/0` để "debug nhanh" | DB ở subnet data, không IP công khai, SG tham chiếu SG |
| EKS không tạo được pod mới | Subnet `/24` hết IP do VPC CNI | Subnet app lớn (`/19`), prefix delegation, hoặc thêm CIDR phụ |

## 14. Lỗi hay gặp (kể cả do AI agent viết)

- Mở `0.0.0.0/0` vào cổng 22/5432/6379 "để kết nối được".
- `publicly_accessible = true` cho RDS, `map_public_ip_on_launch = true` cho subnet app.
- Đặt DB vào subnet public "vì không kết nối được" (nguyên nhân thật thường là SG hoặc route).
- Dùng CIDR trong SG rule giữa các tầng thay vì tham chiếu SG.
- Một NAT GW cho prod, quên endpoint S3.
- Thêm NACL rule mà quên cổng ephemeral chiều về → lỗi chập chờn khó hiểu.
- Hard-code ID AZ (`ap-southeast-1a`) giữa các tài khoản — tên AZ được ánh xạ khác nhau giữa tài khoản; dùng **AZ ID** (`apse1-az1`) khi cần thống nhất (ví dụ với PrivateLink, Local Zones).

## Checklist review

- [ ] CIDR không trùng với VPC khác và mạng văn phòng; có ghi trong IPAM/tài liệu.
- [ ] 3 tầng subnet × ≥2 AZ (prod 3 AZ); tầng data không có route ra Internet.
- [ ] Không tài nguyên nào ở tầng app/data có IP công khai; RDS/ElastiCache `publicly_accessible = false`.
- [ ] Prod: NAT GW mỗi AZ; có S3 (và DynamoDB nếu dùng) gateway endpoint.
- [ ] Interface endpoint được cân nhắc dựa trên lưu lượng và yêu cầu bảo mật; endpoint policy giới hạn theo tổ chức.
- [ ] SG giữa các tầng tham chiếu SG ID; không `0.0.0.0/0` vào cổng quản trị/DB/cache.
- [ ] Truy cập vận hành qua SSM Session Manager, không bastion SSH mở Internet.
- [ ] VPC Flow Logs bật, gửi về tài khoản log-archive.
- [ ] Route 53: TTL hợp lý, health check cho failover, domain được khóa.
- [ ] Đã đánh giá chi phí NAT, IPv4 công khai, traffic liên AZ.
- [ ] Yêu cầu lưu trú dữ liệu đã được pháp chế xác nhận.
