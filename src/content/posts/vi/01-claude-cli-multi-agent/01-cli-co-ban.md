---
title: "Claude Code CLI – kiến thức nền"
description: "nắm các lệnh, cờ (flag) và chế độ quyền của claude trước khi làm việc với worktree, nhiều agent và workflow."
pubDatetime: 2026-11-20T09:00:00Z
featured: false
tags:
  - ai-agent
  - claude-code
  - multi-agent
---
# Claude Code CLI – kiến thức nền

**Mục đích:** nắm các lệnh, cờ (flag) và chế độ quyền của `claude` trước khi làm việc với worktree, nhiều agent và workflow.
**Phiên bản tham chiếu:** Claude Code 2.1.329 (kiểm tra bằng `claude --version`). Cờ có thể thay đổi giữa các bản — luôn đối chiếu `claude --help`.
**Liên quan:** [02-worktree.md](02-worktree.md) · [03-subagent.md](03-subagent.md) · [04-workflow.md](04-workflow.md) · [05-prompt.md](05-prompt.md)

---

## 1. Ba cách chạy Claude Code

| Cách chạy | Lệnh | Khi nào dùng |
|---|---|---|
| Phiên tương tác | `claude` | Làm việc hằng ngày, có hỏi đáp, duyệt quyền từng bước |
| Không tương tác (headless) | `claude -p "prompt"` | Script, CI, pipe kết quả sang lệnh khác |
| Phiên nền (background) | `claude --bg "prompt"` | Giao một việc dài rồi làm việc khác; xem lại sau |

```powershell
# Tương tác, có tên phiên để dễ tìm lại
claude -n "fix-login-bug"

# Headless: in kết quả rồi thoát
claude -p "Tóm tắt thay đổi trong git diff hiện tại"

# Headless, đầu ra JSON, giới hạn chi phí
claude -p "Liệt kê các TODO trong src/" --output-format json --max-budget-usd 1

# Headless, ép đầu ra theo JSON Schema
claude -p "Đếm số file .py" --json-schema '{"type":"object","properties":{"count":{"type":"integer"}},"required":["count"]}'
```

> Lưu ý `-p`: hộp thoại "tin tưởng thư mục" bị bỏ qua. Chỉ chạy `-p` trong thư mục bạn tin tưởng.

## 2. Tiếp tục và quản lý phiên

| Lệnh | Tác dụng |
|---|---|
| `claude -c` | Tiếp tục cuộc hội thoại gần nhất trong thư mục hiện tại |
| `claude -r` | Chọn phiên từ danh sách để tiếp tục |
| `claude -r "<tên hoặc id>"` | Tiếp tục đúng phiên đó |
| `claude -r <id> --fork-session` | Rẽ nhánh: tạo phiên mới từ lịch sử phiên cũ (thử hướng khác mà không làm hỏng phiên gốc) |
| `claude --from-pr 123` | Tiếp tục phiên gắn với PR #123 |

## 3. Chế độ quyền (permission mode)

Chọn bằng `--permission-mode <mode>` hoặc nhấn **Shift+Tab** trong phiên để chuyển vòng.

| Mode | Hành vi | Khuyến nghị |
|---|---|---|
| `manual` (mặc định) | Hỏi trước mỗi thao tác có rủi ro | Dùng khi mới làm quen, hoặc repo quan trọng |
| `plan` | Chỉ đọc và lập kế hoạch, không sửa file | **Bắt đầu mọi việc lớn bằng plan mode**, duyệt kế hoạch rồi mới cho làm |
| `acceptEdits` | Tự sửa file, vẫn hỏi lệnh shell | Khi đã duyệt kế hoạch và tin phạm vi |
| `auto` | Tự quyết định trong giới hạn an toàn, hỏi khi rủi ro | Làm việc dài, ít ngắt quãng |
| `dontAsk` | Từ chối mọi thứ chưa được cho phép sẵn, không hỏi | Script/CI với allowlist rõ ràng |
| `bypassPermissions` | Bỏ qua mọi kiểm tra | **Chỉ** trong sandbox không có mạng. Không dùng trên máy làm việc |

Giới hạn công cụ theo nhu cầu (nguyên tắc "cấp quyền tối thiểu" trong `CLAUDE.md` của repo này):

```powershell
claude --allowedTools "Read Grep Glob Bash(git diff *)" --disallowedTools "Bash(git push *)"
claude --tools "Read,Grep,Glob"        # chỉ cho phép đọc
```

## 4. Mô hình và mức suy luận

```powershell
claude --model opus            # alias: fable, opus, sonnet (hoặc tên đầy đủ)
claude --effort high           # low | medium | high | xhigh | max
claude --fallback-model sonnet # dự phòng khi model chính bận
```

Nguyên tắc chọn: việc cơ học (đổi tên, format) → `sonnet`/`low`; thiết kế, review, debug khó → `opus`/`high`. `max` chỉ dùng khi thật cần vì tốn chi phí.

## 5. Ngữ cảnh: CLAUDE.md, @file, thư mục bổ sung

- `CLAUDE.md` ở gốc repo được nạp tự động mỗi phiên — đặt quy ước dự án ở đây (repo này đã có).
- `/init` tạo `CLAUDE.md` ban đầu cho repo chưa có.
- Gõ `@đường/dẫn/file` trong prompt để đính kèm file.
- `--add-dir ../repo-khac` cho phép Claude đọc thêm thư mục ngoài.

## 6. Lệnh slash hay dùng trong phiên

Gõ `/help` để xem danh sách đầy đủ của phiên bản bạn đang dùng. Các lệnh thường dùng:

| Lệnh | Tác dụng |
|---|---|
| `/clear` | Xóa ngữ cảnh, bắt đầu việc mới (nên làm khi chuyển chủ đề) |
| `/compact` | Tóm tắt ngữ cảnh khi hội thoại dài |
| `/resume` | Chọn phiên cũ |
| `/model`, `/config` | Đổi model, cấu hình |
| `/permissions` | Xem/sửa allow/deny |
| `/agents` | Quản lý subagent tùy chỉnh (xem [03-subagent.md](03-subagent.md)) |
| `/workflows` | Theo dõi workflow đang chạy (xem [04-workflow.md](04-workflow.md)) |
| `/plugin` | Cài, bật/tắt plugin |
| `/code-review`, `/simplify`, `/security-review` | Review diff hiện tại |
| `/doctor` | Kiểm tra cài đặt |

Phím tắt: **Esc** dừng Claude giữa chừng; **Esc Esc** quay lại một tin nhắn trước để sửa prompt; **Shift+Tab** đổi permission mode; gõ `! <lệnh>` để tự chạy lệnh shell và đưa kết quả vào hội thoại.

## 7. Lệnh con (subcommand) quan trọng

```powershell
claude agents              # màn hình quản lý các phiên nền
claude agents --json       # liệt kê phiên dạng JSON (cho script)
claude attach <id>         # mở phiên nền trong terminal này
claude logs <id>           # xem output gần đây của phiên nền
claude stop <id>           # dừng phiên nền (hội thoại vẫn giữ)
claude rm <id>             # xóa phiên nền khỏi danh sách và xóa worktree của nó
claude plugin validate .   # kiểm tra plugin/marketplace
claude mcp                 # cấu hình MCP server
claude doctor              # kiểm tra sức khỏe cài đặt
claude ultrareview         # review đa agent trên cloud (tính phí, do người dùng tự chạy)
```

## 8. Lưu ý riêng cho repo này

- Plugin `aiic-astec` có `bash_guard`: một số lệnh (tải mạng, sửa lịch sử nhánh được bảo vệ…) sẽ bị chặn trong phiên Claude. Đó là hành vi mong muốn, không phải lỗi.
- Không commit/push khi chưa có sự cho phép (quy tắc trong `CLAUDE.md`).
