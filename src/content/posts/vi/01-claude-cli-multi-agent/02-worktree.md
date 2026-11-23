---
title: "Git worktree với Claude Code"
description: "chạy nhiều phiên Claude song song trên cùng một repo mà không giẫm chân nhau."
pubDatetime: 2026-11-20T08:00:00Z
featured: false
tags:
  - ai-agent
  - claude-code
  - multi-agent
  - git
---
# Git worktree với Claude Code

**Mục đích:** chạy nhiều phiên Claude song song trên cùng một repo mà không giẫm chân nhau.
**Liên quan:** [01-cli-co-ban.md](01-cli-co-ban.md) · [03-subagent.md](03-subagent.md) · [06-mo-hinh-phoi-hop.md](06-mo-hinh-phoi-hop.md)

---

## 1. Worktree là gì, tại sao cần

Một repo Git bình thường chỉ có **một** thư mục làm việc → chỉ checkout được **một** nhánh tại một thời điểm. Nếu hai phiên Claude cùng sửa một thư mục, chúng ghi đè file của nhau, `git status` lẫn lộn, test chạy trên code nửa vời.

`git worktree` cho phép một repo có **nhiều thư mục làm việc**, mỗi thư mục checkout một nhánh khác nhau, dùng chung một kho `.git` (lịch sử, object, remote).

```
D:\SourceCode\app\               ← worktree chính, nhánh main
D:\SourceCode\app-feature-a\     ← worktree 2, nhánh feature/a   (phiên Claude A)
D:\SourceCode\app-bugfix-42\     ← worktree 3, nhánh fix/42      (phiên Claude B)
```

Quy tắc của Git: **một nhánh chỉ được checkout ở một worktree** tại một thời điểm.

## 2. Cách 1 – Để Claude Code tự tạo worktree (khuyến nghị)

```powershell
cd D:\SourceCode\app
claude -w feature-login        # tạo worktree tên feature-login và mở phiên trong đó
claude -w                      # tạo worktree với tên tự sinh
claude --bg -w fix-42 "Sửa lỗi #42 theo mô tả trong issue, viết test tái hiện trước"
```

- Claude Code tạo worktree + nhánh mới và chạy phiên trong đó. Vị trí cụ thể có thể khác giữa các phiên bản — xem bằng `git worktree list`.
- Kết hợp `--bg` để chạy nền; `claude agents` để xem; `claude attach <id>` để vào xem/điều khiển.
- `claude rm <id>` xóa phiên nền **và worktree của nó** khi an toàn (hội thoại vẫn giữ để `--resume`).
- Trên macOS/Linux có `--tmux` để mở worktree trong cửa sổ tmux riêng (không áp dụng Windows thuần).

Trong phiên đang chạy, bạn cũng có thể yêu cầu: *"Tạo worktree riêng cho việc này"* — Claude có công cụ `EnterWorktree`/`ExitWorktree`.

## 3. Cách 2 – Tự tạo bằng git rồi mở Claude

```powershell
cd D:\SourceCode\app
git fetch origin
git worktree add ..\app-feature-a -b feature/a origin/main   # nhánh mới từ origin/main
git worktree add ..\app-hotfix hotfix/1.2.1                  # nhánh đã có sẵn

cd ..\app-feature-a
claude -n "feature-a"
```

Dọn dẹp:

```powershell
git worktree list                     # xem tất cả worktree
git worktree remove ..\app-feature-a  # xóa (từ chối nếu còn thay đổi chưa commit)
git worktree prune                    # dọn bản ghi worktree mà thư mục đã bị xóa tay
git branch -d feature/a               # xóa nhánh sau khi đã merge
```

## 4. Worktree tự động cho subagent và workflow

- **Subagent:** khi Claude gọi công cụ Agent với `isolation: "worktree"`, subagent làm việc trong worktree tạm; nếu không có thay đổi, worktree tự xóa. Bạn chỉ cần nói: *"Dùng 3 agent song song, mỗi agent một worktree riêng."*
- **Workflow:** `agent(prompt, {isolation: 'worktree'})` — chỉ dùng khi nhiều agent **cùng sửa file** song song; tốn đĩa và thời gian khởi tạo.

## 5. Những điều phải nhớ

| Vấn đề | Cách xử lý |
|---|---|
| Worktree mới **không có** `node_modules`, `.venv`, file build, `.env` | Chạy lại bước cài đặt trong worktree (hoặc dặn Claude làm). Không copy file bí mật nếu không cần |
| File không được Git theo dõi (`.claude/settings.local.json`…) không có trong worktree mới | Cấu hình lại nếu cần |
| Hai worktree sửa cùng file → conflict khi merge | Chia việc theo ranh giới file/module rõ ràng trước khi giao |
| Git hook nằm ở `<git-common-dir>/hooks` | Dùng chung cho mọi worktree (plugin `aiic-astec` cài hook ở đây) |
| Ổ đĩa đầy vì worktree cũ | `git worktree list` định kỳ, `claude rm`, `git worktree prune` |
| Đường dẫn dài trên Windows | Đặt repo gần gốc ổ đĩa; bật `git config core.longpaths true` cho repo (không đổi cấu hình global) |

## 6. Quy trình mẫu: 2 tính năng + 1 bugfix song song

```powershell
cd D:\SourceCode\app
claude --bg -w feat-export  -n feat-export  --permission-mode acceptEdits "Làm tính năng xuất Excel theo docs/specs/export.md. Viết test. Không sửa ngoài src/export/."
claude --bg -w feat-filter  -n feat-filter  --permission-mode acceptEdits "Làm bộ lọc theo docs/specs/filter.md. Viết test. Không sửa ngoài src/filter/."
claude --bg -w fix-42       -n fix-42       "Tái hiện lỗi #42 bằng test, sau đó sửa."

claude agents          # theo dõi
claude attach feat-export
```

Sau khi xong: vào từng worktree, đọc `git diff main...`, chạy test, duyệt theo [../02-quy-trinh-phan-mem/06-code-review.md](../02-quy-trinh-phan-mem/06-code-review.md), rồi mới tạo PR.
