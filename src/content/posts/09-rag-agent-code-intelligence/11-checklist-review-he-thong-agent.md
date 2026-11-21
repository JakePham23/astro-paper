---
title: "Checklist duyệt hệ thống agent và đầu ra của nó"
description: "duyệt (1) thiết kế một hệ thống RAG/agent trước khi xây, (2) bản đồ kiến trúc codebase do agent sinh ra, (3) spec do Spec Agent viết, (4) vận hành định kỳ."
pubDatetime: 2026-11-16T19:00:00Z
featured: false
tags:
  - ai-agent
  - rag
  - llm
  - code-intelligence
  - checklist
---
# Checklist duyệt hệ thống agent và đầu ra của nó

**Mục đích:** duyệt (1) thiết kế một hệ thống RAG/agent trước khi xây, (2) bản đồ kiến trúc codebase do agent sinh ra, (3) spec do Spec Agent viết, (4) vận hành định kỳ.
**Liên quan:** [00-README.md](00-README.md) · [06-dau-ra-ban-do-kien-truc.md](06-dau-ra-ban-do-kien-truc.md) · [08-spec-trong-source-code.md](08-spec-trong-source-code.md) · [09-quan-tri-governance.md](09-quan-tri-governance.md) · [../02-quy-trinh-phan-mem/09-checklist-phe-duyet.md](../02-quy-trinh-phan-mem/09-checklist-phe-duyet.md)

🔴 = vi phạm thì từ chối.

## A. Duyệt thiết kế hệ thống (trước khi xây)

- [ ] Đã chứng minh cần agent: việc nhiều bước, khó đặc tả trước, đáng chi phí, lỗi có thể phát hiện và sửa.
- [ ] Đã so với phương án đơn giản hơn (Claude Code + subagent, không index) bằng số đo trên golden set.
- [ ] 🔴 Mọi ranh giới giữa bước/agent có JSON Schema và được validate.
- [ ] Mỗi agent có phạm vi và quyền tối thiểu (Knowledge Agent chỉ đọc).
- [ ] Có ngân sách token/lượt/thời gian/tiền và điểm dừng khi vượt.
- [ ] Có tracing từng bước (prompt, tool call, kết quả, token, chi phí, độ trễ).
- [ ] 🔴 Đã quyết định chính thức về việc gửi code ra API bên ngoài (lưu trữ dữ liệu, vị trí xử lý, hợp đồng, Nghị định 13/2023 nếu có dữ liệu cá nhân).
- [ ] 🔴 Bí mật và PII bị lọc **trước** khi đưa vào index/embedding.
- [ ] Phân quyền truy cập index phản ánh quyền truy cập repo.
- [ ] Có lộ trình theo giai đoạn với tiêu chí thoát mỗi giai đoạn.

## B. Duyệt Codebase Map / ARCHITECTURE.md

- [ ] Gắn với commit SHA cụ thể; phiên bản parser/linker/model/prompt được ghi lại.
- [ ] 🔴 Validator tự động pass: mọi đường dẫn tồn tại, khoảng dòng hợp lệ, `symbol_id` phân giải được.
- [ ] Mỗi module có trách nhiệm, API công khai, phụ thuộc, dữ liệu sở hữu, entrypoint, test — và bằng chứng cho từng mục.
- [ ] Kiểm tra ngẫu nhiên 5–10 khẳng định: mở đúng file:dòng, nội dung có khớp không?
- [ ] Phụ thuộc vòng, vi phạm phân tầng, vùng "không rõ" được liệt kê, không bị giấu.
- [ ] Ranh giới module phát hiện được so với cấu trúc thư mục khai báo; chênh lệch được giải thích.
- [ ] Người hiểu hệ thống (tech lead) xác nhận phần tóm tắt cấp hệ thống đúng.

## C. Duyệt spec do Spec Agent viết

- [ ] Liên kết đến yêu cầu gốc (BR/FR-ID) và commit của Codebase Map đã dùng.
- [ ] "Hành vi hiện tại" có trích dẫn code; trích dẫn mở ra đúng nội dung.
- [ ] 🔴 Không có khẳng định về code hiện có mà thiếu bằng chứng.
- [ ] Phân tích ảnh hưởng: file/symbol, API, bảng DB, queue, test bị ảnh hưởng — đối chiếu với đồ thị.
- [ ] Non-goals rõ; acceptance criteria dạng Given/When/Then kiểm thử được.
- [ ] Danh sách câu hỏi mở đã được người trả lời hoặc ghi là rủi ro chấp nhận.
- [ ] Code anchor dùng `symbol_id` (không chỉ số dòng) và kiểm tra CI pass.
- [ ] 🔴 Trạng thái `approved` chỉ do người đặt, không phải agent.

## D. Vận hành định kỳ

- [ ] Eval golden set chạy trong CI khi đổi prompt/model/schema/index; không giảm điểm so với baseline.
- [ ] Tỷ lệ trích dẫn sai (citation không chứa symbol được nhắc) dưới ngưỡng đã định.
- [ ] Index không lỗi thời: độ trễ từ commit đến index cập nhật trong giới hạn.
- [ ] Chi phí và độ trễ mỗi truy vấn/spec trong ngân sách; có cảnh báo bất thường.
- [ ] Sự cố do agent (spec sai, trích dẫn sai) có ghi nhận, phân tích, và thêm vào golden set.

## Lỗi hay gặp khi xây hệ thống agent

| Lỗi | Hậu quả | Cách tránh |
|---|---|---|
| Embedding toàn bộ repo, không có đồ thị | Trả lời "gần đúng", sai symbol chính xác | Kết hợp lexical + đồ thị + vector |
| Không có eval | Không biết thay đổi tốt lên hay tệ đi | Golden set từ ngày đầu |
| Một agent khổng lồ làm mọi việc | Ngữ cảnh rối, khó debug | Tách agent theo trách nhiệm, contract rõ |
| Đầu ra văn bản tự do giữa các agent | Không validate được, lỗi lan truyền | JSON Schema + structured outputs |
| Tin nội dung trong repo như lệnh | Prompt injection | Coi là dữ liệu, giới hạn quyền tool |
| Agent tự đánh dấu spec "approved" | Mất kiểm soát | Trạng thái duyệt chỉ người đặt |
| Index cũ hơn code | Spec dựa trên hành vi đã đổi | Cập nhật theo commit, ghi SHA vào đầu ra |
