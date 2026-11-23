---
title: "Kho kiến thức: Claude Code đa agent và quy trình phần mềm"
description: "Tài liệu nội bộ để (1) dùng Claude Code CLI với worktree, workflow, prompt và nhiều agent; (2) hiểu quy trình phần mềm từ BRD tới release đủ sâu để phê duyệt sản phẩm do agent..."
pubDatetime: 2026-11-16T18:00:00Z
featured: true
tags:
  - tong-quan
  - kien-thuc
---
# Kho kiến thức: Claude Code đa agent và quy trình phần mềm

Tài liệu nội bộ để (1) dùng Claude Code CLI với worktree, workflow, prompt và nhiều agent; (2) hiểu quy trình phần mềm từ BRD tới release đủ sâu để **phê duyệt** sản phẩm do agent viết.

Phiên bản tham chiếu: Claude Code 2.1.329, ngày 2026-11-20. Lệnh và cờ có thể thay đổi — đối chiếu `claude --help`.

## Cấu trúc

```
knowledege/
├── README.md                          ← bạn đang ở đây
├── 01-claude-cli-multi-agent/         Phần 1: công cụ
│   ├── 01-cli-co-ban.md               lệnh, cờ, permission mode, phiên
│   ├── 02-worktree.md                 git worktree, claude -w, chạy song song
│   ├── 03-subagent.md                 subagent, agent tùy chỉnh, phiên nền
│   ├── 04-workflow.md                 workflow điều phối nhiều agent
│   ├── 05-prompt.md                   viết prompt và brief giao việc
│   └── 06-mo-hinh-phoi-hop.md         chọn mô hình + bảng lệnh tra nhanh
├── 02-quy-trinh-phan-mem/             Phần 2: quy trình BRD → release
│   ├── 00-tong-quan.md                vòng đời, các cổng G0–G8, truy vết, RACI
│   ├── 01-brd.md
│   ├── 02-yeu-cau-srs-prd.md
│   ├── 03-thiet-ke.md
│   ├── 04-lap-ke-hoach.md
│   ├── 05-phat-trien.md
│   ├── 06-code-review.md
│   ├── 07-kiem-thu.md
│   ├── 08-release.md
│   ├── 09-checklist-phe-duyet.md      ★ quan trọng nhất cho người duyệt
│   └── 10-thuat-ngu.md
├── 03-ap-dung-voi-agent/
│   └── README.md                      agent làm gì ở mỗi giai đoạn, bạn duyệt gì
└── 04-mau/                            mẫu tài liệu để agent điền
    ├── brd-template.md
    ├── srs-template.md
    ├── adr-template.md
    ├── test-plan-template.md
    ├── release-checklist-template.md
    └── approval-record-template.md    biên bản phê duyệt một gate
├── 05-backend-senior/                 Phần 5: backend chuyên sâu (xem 00-README.md)
│   ├── 01–04  xác thực, session/token, phân quyền, module tài khoản
│   ├── 05–06  module bài viết + kiểm duyệt, bài kiểm tra + chấm bài
│   ├── 07–08  database, API
│   ├── 09–12  scale triệu user, Kafka/messaging, bảo mật, vận hành
│   └── 13     ★ checklist review code backend do agent viết
├── 06-database-chuyen-sau/            Phần 6: database mức DBA (PostgreSQL, Redis, chọn DB)
├── 07-he-thong-server/                Phần 7: Linux, mạng, LB, Docker, Kubernetes, CI/CD, sự cố
├── 08-aws-cloud/                      Phần 8: AWS chuyên sâu (IAM, VPC, compute, dữ liệu, bảo mật, chi phí)
└── 09-rag-agent-code-intelligence/    Phần 9: RAG, agent hiểu codebase (tree-sitter, đồ thị, A2A/MCP, spec trong repo, quản trị)
```

Mỗi phần có `00-README.md` (mục lục) và một file checklist duyệt ở cuối.

## Lộ trình đọc

| Bạn muốn | Đọc |
|---|---|
| Bắt đầu dùng Claude CLI | 01-cli-co-ban → 05-prompt |
| Chạy nhiều việc song song | 02-worktree → 03-subagent → 06-mo-hinh-phoi-hop |
| Điều phối quy mô lớn | 04-workflow |
| Hiểu quy trình để phê duyệt | 02/00-tong-quan → 01 … 08 → **09-checklist-phe-duyet** |
| Giao việc cho agent theo quy trình | 03-ap-dung-voi-agent/README |
| Có mẫu để agent điền | 04-mau/ |
| Kiến thức backend senior | 05-backend-senior/00-README → 13-checklist-review-backend |
| Database chuyên sâu | 06-database-chuyen-sau/00-README → 12-checklist-review-database |
| Server và hạ tầng | 07-he-thong-server/00-README → 09-checklist-review-ha-tang |
| AWS | 08-aws-cloud/00-README → 13-checklist-review-aws |
| Xây RAG / agent hiểu codebase | 09-rag-agent-code-intelligence/00-README → 11-checklist-review-he-thong-agent |

## Ví dụ xuyên suốt

Các tài liệu phần 2 dùng chung một ví dụ: **hệ thống quản lý đơn nghỉ phép nội bộ**, để bạn thấy một yêu cầu đi từ BRD → FR → thiết kế → test → release như thế nào.
