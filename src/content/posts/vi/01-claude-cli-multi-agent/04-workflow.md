---
title: "Workflow – điều phối nhiều agent bằng script"
description: "hiểu workflow là gì, cách yêu cầu, theo dõi, chạy lại, và kiểm soát chi phí."
pubDatetime: 2026-11-20T06:00:00Z
featured: false
tags:
  - ai-agent
  - claude-code
  - multi-agent
  - workflow
---
# Workflow – điều phối nhiều agent bằng script

**Mục đích:** hiểu workflow là gì, cách yêu cầu, theo dõi, chạy lại, và kiểm soát chi phí.
**Liên quan:** [03-subagent.md](03-subagent.md) · [06-mo-hinh-phoi-hop.md](06-mo-hinh-phoi-hop.md)

---

## 1. Workflow khác subagent ở đâu

| | Subagent | Workflow |
|---|---|---|
| Ai quyết định bước tiếp theo | Claude (theo suy luận) | Script JavaScript (xác định, lặp lại được) |
| Quy mô | Vài agent | Hàng chục agent (giới hạn đồng thời ~min(16, số CPU−2)) |
| Kiểm chứng chéo | Tự bạn yêu cầu | Đóng thành pattern: tìm → xác minh đối nghịch → tổng hợp |
| Chạy lại | Không | `resume` dùng lại kết quả agent đã xong |
| Chi phí | Thấp–vừa | **Cao** — có thể tiêu rất nhiều token |

## 2. Khi nào Claude được chạy workflow

Claude **không** tự chạy workflow chỉ vì việc "có vẻ hợp". Bạn phải chủ động cho phép bằng một trong các cách:

- Nói rõ: *"dùng workflow"*, *"fan out agents"*, *"điều phối bằng nhiều subagent"*.
- Thêm từ khóa **`ultracode`** vào prompt (hoặc bật ultracode cho cả phiên) — khi đó Claude dùng workflow cho mọi việc đáng kể, ưu tiên độ đầy đủ hơn chi phí.
- Gọi một workflow đã lưu theo tên, hoặc một skill/lệnh slash có hướng dẫn chạy workflow.

Có thể đặt trần token: thêm `+500k` vào prompt → workflow dừng tạo agent mới khi chạm trần.

## 3. Cấu trúc một workflow (để đọc hiểu khi Claude cho xem script)

```javascript
export const meta = {
  name: 'review-changes',
  description: 'Review thay đổi theo nhiều khía cạnh, xác minh từng phát hiện',
  phases: [{ title: 'Review' }, { title: 'Verify' }],
}

const DIMENSIONS = [
  { key: 'bugs',     prompt: 'Tìm lỗi logic trong git diff main...HEAD' },
  { key: 'security', prompt: 'Tìm lỗ hổng bảo mật trong git diff main...HEAD' },
]

const results = await pipeline(
  DIMENSIONS,
  d => agent(d.prompt, { phase: 'Review', schema: FINDINGS_SCHEMA }),
  review => parallel(review.findings.map(f => () =>
    agent(`Cố gắng BÁC BỎ phát hiện: ${f.title}`, { phase: 'Verify', schema: VERDICT_SCHEMA })
      .then(v => ({ ...f, verdict: v }))))
)
return results.flat().filter(Boolean).filter(f => f.verdict?.isReal)
```

Các khối chính:

| Hàm | Ý nghĩa |
|---|---|
| `agent(prompt, opts)` | Tạo một subagent; `schema` ép trả về JSON có cấu trúc; `isolation: 'worktree'` khi sửa file song song; `model`, `effort` để chỉnh chi phí |
| `pipeline(items, s1, s2…)` | Mỗi item chạy qua các bước độc lập, không chờ nhau (mặc định nên dùng) |
| `parallel([...])` | Chạy song song và **chờ tất cả** (rào chắn) |
| `phase(title)`, `log(msg)` | Nhóm tiến độ và in thông báo |
| `budget` | Đọc trần token người dùng đặt |

## 4. Các mẫu (pattern) hay gặp

| Mẫu | Dùng cho |
|---|---|
| **Understand** – nhiều agent đọc các phân hệ → bản đồ hệ thống | Tiếp nhận codebase lạ |
| **Design / Judge panel** – N phương án độc lập → chấm điểm → tổng hợp | Chọn kiến trúc |
| **Review** – nhiều khía cạnh → tìm → xác minh đối nghịch | Review PR lớn |
| **Migrate** – tìm các vị trí → sửa mỗi chỗ trong worktree riêng → kiểm chứng | Nâng cấp thư viện, đổi API hàng loạt |
| **Loop-until-dry** – lặp tìm đến khi K vòng liên tiếp không ra gì mới | Kiểm toán lỗi |

Lời khuyên: chia việc lớn thành **nhiều workflow nối tiếp** (hiểu → thiết kế → làm → review), đọc kết quả từng bước trước khi cho chạy bước sau. Bạn vẫn là người quyết định giữa các giai đoạn.

## 5. Theo dõi, dừng, chạy lại

- `/workflows` — xem tiến độ trực tiếp từng phase/agent.
- Workflow chạy nền; khi xong Claude nhận thông báo và báo cáo lại.
- Dừng giữa chừng: yêu cầu Claude dừng (công cụ TaskStop) hoặc Esc.
- Chạy lại sau khi sửa script hoặc bị ngắt: Claude dùng `resumeFromRunId` — các agent đã hoàn thành và không đổi được lấy từ cache, không tốn lại token.
- Workflow lưu sẵn để tái sử dụng: `.claude/workflows/` trong dự án.

## 6. Ví dụ prompt

```
dùng workflow: review toàn bộ thay đổi của nhánh này so với main theo 4 khía cạnh
(logic, bảo mật, hiệu năng, test). Mỗi phát hiện phải được 2/3 agent xác minh độc lập
mới giữ lại. Trả về bảng file:dòng, mức độ, bằng chứng. +300k
```

```
ultracode: tìm mọi chỗ dùng moment.js trong src/, thay bằng date-fns,
mỗi file một agent trong worktree riêng, chạy test sau mỗi file, báo cáo file nào thất bại.
```

## 7. Kiểm soát rủi ro và chi phí

- Hỏi Claude **ước lượng số agent và chi phí** trước khi chạy; mặc định phiên này giữ workflow dưới khoảng 10 agent trừ khi bạn yêu cầu lớn hơn.
- Đặt trần `+Nk`.
- Workflow sửa file: yêu cầu `isolation: 'worktree'` và bước kiểm chứng (chạy test) cho mỗi thay đổi.
- Kết quả "đã xác minh" vẫn là đánh giá của mô hình — với quyết định quan trọng, tự kiểm tra lại các phát hiện mức cao.
