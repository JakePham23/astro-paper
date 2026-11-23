---
title: "Viết prompt hiệu quả cho Claude Code"
description: "viết yêu cầu để agent làm đúng ngay lần đầu, và để bạn duyệt được kết quả."
pubDatetime: 2026-11-20T05:00:00Z
featured: false
tags:
  - ai-agent
  - claude-code
  - multi-agent
  - prompt-engineering
---
# Viết prompt hiệu quả cho Claude Code

**Mục đích:** viết yêu cầu để agent làm đúng ngay lần đầu, và để bạn duyệt được kết quả.
**Liên quan:** [03-subagent.md](03-subagent.md) · [../03-ap-dung-voi-agent/README.md](../03-ap-dung-voi-agent/README.md)

---

## 1. Cấu trúc một prompt giao việc tốt

| Thành phần | Câu hỏi trả lời | Ví dụ |
|---|---|---|
| **Mục tiêu** | Xong thì đạt được gì? | "Nhân viên gửi được đơn nghỉ phép nửa ngày" |
| **Ngữ cảnh** | Đọc gì trước? | "Xem `@docs/srs/leave.md` mục FR-07, code ở `src/leave/`" |
| **Phạm vi** | Được sửa đâu, không được sửa đâu? | "Chỉ sửa `src/leave/` và `tests/leave/`. Không đổi schema DB" |
| **Ràng buộc** | Quy tắc kỹ thuật | "Không thêm thư viện mới. Theo style hiện có" |
| **Tiêu chí hoàn thành** | Làm sao biết xong? | "AC-1..AC-3 có test; `pytest tests/leave` pass" |
| **Bằng chứng** | Báo cáo gì? | "Liệt kê file đã sửa, lệnh test đã chạy và output" |
| **Điểm dừng** | Khi nào phải hỏi lại? | "Nếu cần đổi schema, dừng và hỏi" |

### Mẫu

```
Mục tiêu: <một câu>.
Đọc trước: @<file spec>, @<file liên quan>.
Phạm vi: chỉ sửa <thư mục>. Không <điều cấm>.
Hoàn thành khi: <AC>, <lệnh kiểm tra> chạy pass.
Báo cáo: file đã sửa, lệnh đã chạy kèm output, điều chưa làm và lý do.
Nếu gặp <tình huống mơ hồ>, dừng và hỏi tôi.
```

## 2. Quy trình 4 bước: Khám phá → Kế hoạch → Làm → Kiểm chứng

1. **Khám phá** (plan mode, Shift+Tab): *"Đọc code liên quan và giải thích luồng xử lý đơn nghỉ phép. Chưa sửa gì."*
2. **Kế hoạch**: *"Đề xuất kế hoạch sửa, liệt kê file sẽ đụng và test sẽ viết."* → bạn **duyệt kế hoạch** (đây là điểm kiểm soát rẻ nhất).
3. **Làm**: chuyển sang `acceptEdits`, *"Thực hiện kế hoạch đã duyệt."*
4. **Kiểm chứng**: *"Chạy test, chạy lint, báo cáo output thật."* Sau đó `/code-review`.

## 3. Mẹo thực tế

- **Cụ thể hơn là dài hơn.** "Sửa lỗi login" kém; "Login trả 500 khi email có dấu + ; tái hiện bằng test trước, rồi sửa" tốt.
- **Cho ví dụ đầu vào/đầu ra** khi yêu cầu định dạng.
- **Yêu cầu test trước (TDD)** cho bugfix: test phải *thất bại* trước khi sửa.
- **Một việc một phiên.** Đổi chủ đề → `/clear`. Hội thoại dài → `/compact`.
- **Sửa hướng sớm.** Thấy đi sai → Esc ngay, đừng đợi xong.
- **Cấm điều hay sai:** "Không sửa test để cho pass", "Không xóa xử lý lỗi", "Không thêm abstraction không cần".
- **Hỏi lại về sự thật:** "Bạn đã thực sự chạy lệnh đó chưa? Dán output."
- **Đặt quy ước lâu dài vào `CLAUDE.md`** thay vì nhắc mỗi lần.

## 4. Prompt giao việc cho subagent / agent khác

Subagent chỉ biết những gì bạn (hoặc Claude) viết trong prompt. Một brief tốt có:

- Mục tiêu và *tại sao*.
- Những gì đã loại trừ (để không làm lại).
- File/tài liệu cần đọc (đường dẫn, không dán nội dung dài).
- Phạm vi hẹp, rõ.
- Định dạng kết quả trả về.

Tránh đưa sẵn kết luận ("xác nhận rằng lỗi ở X") — agent sẽ có xu hướng xác nhận. Viết "tìm nguyên nhân; nếu là X, đưa bằng chứng".

## 5. Prompt mẫu theo tình huống

| Tình huống | Prompt |
|---|---|
| Hiểu codebase | "Giải thích kiến trúc repo này: các module chính, luồng dữ liệu, điểm vào. Có sơ đồ mermaid. Không sửa gì." |
| Viết spec | "Từ @docs/brd.md, viết SRS theo mẫu @knowledege/04-mau/srs-template.md. Đánh dấu chỗ BRD mơ hồ là [CẦN XÁC NHẬN], không tự đoán." |
| Bugfix | "Lỗi: <mô tả>. Bước 1 viết test tái hiện, chạy cho thấy fail. Bước 2 sửa tối thiểu. Bước 3 chạy toàn bộ test liên quan." |
| Review | "/code-review high" hoặc "Review diff so với main: tìm lỗi logic và thay đổi ngoài phạm vi FR-07. Mỗi phát hiện kèm file:dòng và kịch bản lỗi." |
| Refactor | "Refactor X để Y. Hành vi không đổi: toàn bộ test hiện có phải pass trước và sau. Không đổi API public." |
| Release note | "Từ git log v1.2.0..HEAD, viết release note theo Conventional Commits, nhóm Feature/Fix/Breaking." |
