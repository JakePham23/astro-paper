---
title: "Subagent và phiên nền – làm việc với nhiều agent"
description: "hiểu các cách để Claude giao việc cho agent khác, khi nào nên và không nên."
pubDatetime: 2026-11-20T07:00:00Z
featured: false
tags:
  - ai-agent
  - claude-code
  - multi-agent
---
# Subagent và phiên nền – làm việc với nhiều agent

**Mục đích:** hiểu các cách để Claude giao việc cho agent khác, khi nào nên và không nên.
**Liên quan:** [02-worktree.md](02-worktree.md) · [04-workflow.md](04-workflow.md) · [06-mo-hinh-phoi-hop.md](06-mo-hinh-phoi-hop.md)

---

## 1. Bốn cấp độ "nhiều agent"

| Cấp | Cơ chế | Ai điều phối | Dùng khi |
|---|---|---|---|
| 1 | **Subagent** (công cụ Agent) | Claude trong phiên của bạn | Tìm kiếm rộng, việc độc lập chạy song song, review độc lập |
| 2 | **Phiên nền** (`claude --bg`) | Bạn | Nhiều việc lớn độc lập, mỗi việc một worktree |
| 3 | **Workflow** (công cụ Workflow) | Script JavaScript xác định | Fan-out hàng chục agent, có bước kiểm chứng chéo — xem [04-workflow.md](04-workflow.md) |
| 4 | **Cloud** (`claude --cloud`, `/code-review ultra`) | Hạ tầng Anthropic | Review đa agent, việc chạy trên máy chủ |

## 2. Subagent

Subagent là một phiên Claude con: nhận prompt, có bộ công cụ riêng, **ngữ cảnh riêng**, trả về một bản tóm tắt cho phiên chính.

**Ưu:** giữ ngữ cảnh phiên chính sạch (không đổ hàng trăm dòng kết quả tìm kiếm vào), chạy song song.
**Nhược:** subagent chỉ biết những gì có trong prompt; bạn chỉ thấy bản tóm tắt, không thấy quá trình; tốn token.

### Subagent có sẵn

| Loại | Việc |
|---|---|
| `Explore` | Tìm kiếm chỉ đọc, quét nhiều file |
| `Plan` | Lập kế hoạch triển khai, không sửa file |
| `general-purpose` | Việc nhiều bước bất kỳ |
| `fork` | Bản sao của chính phiên hiện tại (thừa hưởng toàn bộ ngữ cảnh), chạy nền |

Cách gọi: chỉ cần nói trong prompt, ví dụ:

```
Dùng agent Explore tìm mọi chỗ gọi API /v1/leave, báo cáo file:dòng.
Dùng 3 subagent song song, mỗi cái review một thư mục: src/api, src/db, src/ui.
```

### Tạo subagent tùy chỉnh

Gõ `/agents` để tạo bằng giao diện, hoặc tự viết file Markdown:

- `.claude/agents/<tên>.md` — dùng chung cho dự án (commit vào repo)
- `~/.claude/agents/<tên>.md` — riêng cho bạn

```markdown
---
name: test-reviewer
description: Review test mới được thêm. Dùng sau khi viết hoặc sửa test.
tools: Read, Grep, Glob, Bash
model: sonnet
---

Bạn là reviewer chuyên về test. Với mỗi test thay đổi:
1. Test có thất bại nếu bỏ phần code được sửa không? (test có thật sự kiểm tra hành vi)
2. Có assert yếu (chỉ kiểm tra "không lỗi") không?
3. Có test bị skip, bị xóa, hoặc expected bị sửa cho khớp kết quả sai không?
Trả về danh sách vấn đề: file:dòng, mức độ, lý do.
```

- `description` quyết định khi nào Claude tự chọn agent này — viết rõ "dùng khi nào".
- `tools` — chỉ cấp đúng công cụ cần (reviewer không cần Edit/Write).
- Dùng tạm thời không cần file: `claude --agents '{"reviewer":{"description":"Reviews code","prompt":"You are a code reviewer"}}'`
- Chạy cả phiên dưới vai một agent: `claude --agent test-reviewer`

> Repo này (`aiic-astec-claude-code-kit`): `CLAUDE.md` cấm **plugin** đóng gói agent trong giai đoạn hiện tại. Agent cá nhân trong `~/.claude/agents/` hoặc `.claude/agents/` của dự án khác thì không bị ràng buộc này.

## 3. Phiên nền (background session)

```powershell
claude --bg -w task-a -n task-a "..."   # chạy nền trong worktree riêng
claude agents                            # bảng điều khiển: xem, mở, giao việc mới
claude logs task-a                       # xem output gần đây
claude attach task-a                     # vào phiên để trả lời câu hỏi / duyệt quyền
claude stop task-a                       # dừng
claude --bg -r <session-id>              # tiếp tục một phiên cũ ở chế độ nền
claude rm task-a                         # dọn phiên và worktree
```

Phiên nền vẫn có thể dừng lại chờ bạn duyệt quyền → kiểm tra `claude agents` định kỳ. Muốn chạy không bị chặn, cấp sẵn allowlist (`--allowedTools`) hoặc dùng `--permission-mode acceptEdits`/`auto` — đừng dùng `bypassPermissions` trên máy thật.

## 4. Khi nào KHÔNG nên dùng nhiều agent

- Việc chỉ cần vài lệnh đọc/sửa → tự làm trong một phiên nhanh và rẻ hơn.
- Các phần phụ thuộc chặt vào nhau (B cần kết quả của A) → làm tuần tự.
- Nhiều agent cùng sửa một file → chắc chắn conflict.
- Bạn không có thời gian duyệt kết quả của N agent → đừng tạo N agent.

## 5. Đánh giá kết quả từ subagent

Kết quả subagent được viết với giọng tự tin như nhau dù đúng hay sai. Trước khi tin:

1. Nó có dẫn chứng cụ thể (file:dòng, lệnh đã chạy + output) không?
2. Kiểm tra ngẫu nhiên 1–2 khẳng định quan trọng bằng chính mắt bạn.
3. Nếu giao cho subagent "xác nhận giả thuyết X", nó có xu hướng xác nhận. Hãy giao "tìm bằng chứng X **sai**".
