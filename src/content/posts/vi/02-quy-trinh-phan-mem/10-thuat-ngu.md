---
title: "Thuật ngữ Anh – Việt"
description: "Tra nhanh các từ viết tắt và thuật ngữ dùng trong bộ tài liệu quy trình và khi làm việc với agent."
pubDatetime: 2026-11-19T17:00:00Z
featured: false
tags:
  - sdlc
  - quy-trinh-phan-mem
---
# Thuật ngữ Anh – Việt

**Mục đích:** Tra nhanh các từ viết tắt và thuật ngữ dùng trong bộ tài liệu quy trình và khi làm việc với agent.

**Liên quan:** [00-tong-quan.md](00-tong-quan.md) · [09-checklist-phe-duyet.md](09-checklist-phe-duyet.md)

---

## Yêu cầu và tài liệu

| Thuật ngữ | Đầy đủ | Nghĩa tiếng Việt |
|-----------|--------|------------------|
| BRD | Business Requirements Document | Tài liệu yêu cầu nghiệp vụ — vì sao làm, đạt mục tiêu kinh doanh gì |
| PRD | Product Requirements Document | Tài liệu yêu cầu sản phẩm — tính năng, người dùng, giá trị |
| SRS | Software Requirements Specification | Đặc tả yêu cầu phần mềm — hệ thống phải làm gì, chi tiết, kiểm thử được |
| BR | Business Requirement | Yêu cầu nghiệp vụ |
| FR | Functional Requirement | Yêu cầu chức năng — hệ thống làm gì |
| NFR | Non-Functional Requirement | Yêu cầu phi chức năng — tốt tới mức nào (hiệu năng, bảo mật, khả dụng…) |
| User story | — | Câu chuyện người dùng: "Là…, tôi muốn…, để…" |
| AC | Acceptance Criteria | Tiêu chí chấp nhận — điều kiện để coi một story là đạt |
| Given/When/Then | — | Cho trước / Khi / Thì — cách viết AC thành kịch bản kiểm thử |
| Use case | — | Ca sử dụng — luồng tương tác chi tiết giữa tác nhân và hệ thống |
| MoSCoW | Must, Should, Could, Won't | Phương pháp xếp ưu tiên: Bắt buộc / Nên có / Có thể / Không làm lần này |
| SMART | Specific, Measurable, Achievable, Relevant, Time-bound | Mục tiêu cụ thể, đo được, khả thi, liên quan, có thời hạn |
| KPI | Key Performance Indicator | Chỉ số đo hiệu quả chính |
| Baseline | — | Giá trị nền / hiện trạng trước khi thay đổi |
| Scope creep | — | Phạm vi phình to dần không kiểm soát |
| Traceability | — | Truy vết — liên kết yêu cầu ↔ thiết kế ↔ code ↔ test |
| RTM | Requirements Traceability Matrix | Ma trận truy vết yêu cầu |
| DoR | Definition of Ready | Định nghĩa sẵn sàng — điều kiện để bắt đầu làm một story |
| DoD | Definition of Done | Định nghĩa hoàn thành — điều kiện để coi một việc là xong |
| INVEST | Independent, Negotiable, Valuable, Estimable, Small, Testable | Tiêu chí của user story tốt |
| Stakeholder | — | Bên liên quan |
| Sponsor | — | Nhà tài trợ / người cấp ngân sách và quyết định cuối |
| PO | Product Owner | Chủ sản phẩm — sở hữu backlog và ưu tiên |
| BA | Business Analyst | Chuyên viên phân tích nghiệp vụ |

## Thiết kế

| Thuật ngữ | Đầy đủ | Nghĩa tiếng Việt |
|-----------|--------|------------------|
| HLD | High-Level Design | Thiết kế tổng thể — các khối lớn và cách chúng kết nối |
| LLD | Low-Level Design | Thiết kế chi tiết — lớp, hàm, bảng, thuật toán |
| C4 | Context, Container, Component, Code | Mô hình vẽ kiến trúc theo 4 mức phóng to |
| ADR | Architecture Decision Record | Bản ghi quyết định kiến trúc — quyết định gì, vì sao, phương án bị loại |
| API contract | — | Hợp đồng API — đặc tả request/response/lỗi đã thống nhất |
| OpenAPI | — | Chuẩn mô tả API REST bằng YAML/JSON |
| Trade-off | — | Đánh đổi giữa các phương án |
| STRIDE | Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege | Mô hình phân loại mối đe dọa bảo mật |
| Threat model | — | Mô hình mối đe dọa — phân tích ai có thể tấn công thế nào |
| IDOR | Insecure Direct Object Reference | Truy cập trực tiếp bản ghi không được phép (ví dụ đổi ID trong URL để xem dữ liệu người khác) |
| Optimistic locking | — | Khóa lạc quan — dùng số phiên bản để phát hiện ghi đè đồng thời |
| Idempotent | — | Lũy đẳng — gọi nhiều lần cho kết quả như gọi một lần |
| Outbox pattern | — | Lưu sự kiện vào bảng trong cùng giao dịch, gửi đi sau, để không mất sự kiện |

## Lập kế hoạch và phát triển

| Thuật ngữ | Đầy đủ | Nghĩa tiếng Việt |
|-----------|--------|------------------|
| WBS | Work Breakdown Structure | Cấu trúc phân rã công việc |
| Story point | — | Điểm câu chuyện — đơn vị ước lượng tương đối |
| PERT | Program Evaluation and Review Technique | Ước lượng 3 điểm: (Lạc quan + 4×Khả dĩ + Bi quan)/6 |
| Critical path | — | Đường găng — chuỗi việc dài nhất quyết định ngày hoàn thành |
| Spike | — | Thử nghiệm ngắn để giảm bất định trước khi ước lượng |
| Sprint | — | Chu kỳ làm việc cố định (1–4 tuần) trong Scrum |
| Backlog | — | Danh sách việc chờ làm, có thứ tự ưu tiên |
| WIP | Work In Progress | Việc đang làm dở |
| Trunk-based | — | Phát triển trên nhánh chính, nhánh phụ rất ngắn |
| GitFlow | — | Mô hình nhánh main/develop/feature/release/hotfix |
| PR / MR | Pull Request / Merge Request | Yêu cầu gộp code, kèm review |
| Conventional Commits | — | Quy ước viết commit `type(scope): mô tả` |
| TDD | Test-Driven Development | Phát triển hướng kiểm thử: viết test trước, code sau |
| Lint / Linter | — | Công cụ kiểm tra phong cách và lỗi tĩnh của code |
| SAST | Static Application Security Testing | Kiểm thử bảo mật tĩnh (phân tích mã nguồn) |
| Worktree | git worktree | Thư mục làm việc thứ hai cùng repo, trên nhánh khác — cho agent làm song song |
| Feature flag | — | Cờ tính năng — bật/tắt tính năng mà không deploy lại |

## Kiểm thử

| Thuật ngữ | Đầy đủ | Nghĩa tiếng Việt |
|-----------|--------|------------------|
| Unit test | — | Kiểm thử đơn vị — một hàm/lớp cô lập |
| Integration test | — | Kiểm thử tích hợp — các thành phần thật nối với nhau |
| SIT | System Integration Testing | Kiểm thử tích hợp hệ thống — toàn hệ thống cùng hệ thống ngoài |
| E2E | End-to-End | Kiểm thử đầu-cuối qua giao diện như người dùng thật |
| Regression test | — | Kiểm thử hồi quy — đảm bảo cái cũ không bị hỏng |
| Smoke test | — | Kiểm thử khói — vài kiểm tra nhanh xem hệ thống có "sống" không |
| UAT | User Acceptance Testing | Kiểm thử chấp nhận người dùng — nghiệp vụ nghiệm thu |
| Test plan | — | Kế hoạch kiểm thử |
| Test case (TC) | — | Ca kiểm thử |
| Entry / Exit criteria | — | Tiêu chí bắt đầu / kết thúc một giai đoạn test |
| Severity | — | Mức nghiêm trọng của lỗi (kỹ thuật) |
| Priority | — | Mức ưu tiên sửa lỗi (nghiệp vụ) |
| Coverage | — | Độ phủ — tỷ lệ code/yêu cầu được test chạm tới |
| Mutation testing | — | Kiểm thử đột biến — cố ý làm hỏng code xem test có bắt được không |
| Mock / Stub | — | Đối tượng giả thay cho phụ thuộc thật trong test |
| Flaky test | — | Test chập chờn — lúc pass lúc fail không do code đổi |
| p95 / p99 | Percentile 95 / 99 | 95% / 99% request nhanh hơn giá trị này |

## Release và vận hành

| Thuật ngữ | Đầy đủ | Nghĩa tiếng Việt |
|-----------|--------|------------------|
| SemVer | Semantic Versioning | Đánh phiên bản ngữ nghĩa MAJOR.MINOR.PATCH |
| RC | Release Candidate | Bản ứng viên phát hành |
| Tag | git tag | Nhãn đánh dấu một commit là một phiên bản |
| Artefact / Artifact | — | Sản phẩm build (gói, image, file cài đặt) |
| Changelog | — | Nhật ký thay đổi (cho kỹ thuật) |
| Release note | — | Ghi chú phát hành (cho người dùng) |
| Go/No-go | — | Quyết định phát hành / không phát hành |
| Deploy | — | Triển khai code lên môi trường |
| Blue-green | — | Triển khai hai môi trường song song, chuyển traffic |
| Canary | — | Phát hành dần cho một phần nhỏ người dùng trước |
| Rollback | — | Quay lui về phiên bản trước |
| Hotfix | — | Bản sửa khẩn trên production |
| Downtime | — | Thời gian dịch vụ ngừng |
| Migration | — | Chuyển đổi cấu trúc / dữ liệu (thường là DB) |
| Expand–contract | — | Mở rộng trước, thu hẹp sau — cách đổi schema tương thích ngược |
| SLA | Service Level Agreement | Thỏa thuận mức dịch vụ (có ràng buộc, phạt) |
| SLO | Service Level Objective | Mục tiêu mức dịch vụ nội bộ (ví dụ uptime 99,5%) |
| SLI | Service Level Indicator | Chỉ số đo mức dịch vụ thực tế |
| RPO | Recovery Point Objective | Lượng dữ liệu tối đa chấp nhận mất khi sự cố |
| RTO | Recovery Time Objective | Thời gian tối đa để khôi phục dịch vụ |
| Post-mortem | — | Phân tích sau sự cố (không đổ lỗi cá nhân) |
| 5 Why | — | Hỏi "vì sao" 5 lần để tìm nguyên nhân gốc |

## Quản lý và phê duyệt

| Thuật ngữ | Đầy đủ | Nghĩa tiếng Việt |
|-----------|--------|------------------|
| RACI | Responsible, Accountable, Consulted, Informed | Ma trận trách nhiệm: Làm / Chịu trách nhiệm cuối / Được hỏi / Được báo |
| Gate | Quality gate / Stage gate | Cổng phê duyệt giữa hai giai đoạn |
| Approve with conditions | — | Phê duyệt có điều kiện |
| Waterfall | — | Mô hình thác nước — tuần tự |
| V-model | — | Mô hình chữ V — mỗi giai đoạn định nghĩa có một cấp kiểm thử tương ứng |
| Agile / Scrum / Kanban | — | Các mô hình phát triển lặp, linh hoạt |
| Hallucination | — | Ảo giác (AI) — agent tạo ra thông tin trông hợp lý nhưng sai/không tồn tại |
| Human-in-the-loop | — | Có người trong vòng lặp — người kiểm tra và quyết định ở các điểm then chốt |
