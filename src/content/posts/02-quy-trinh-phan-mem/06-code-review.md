---
title: "Code review"
description: "Hướng dẫn người review đọc một PR (đặc biệt PR do agent viết) để quyết định Approve hay Request changes. Đây là phần \"đúng logic\" của cổng G5."
pubDatetime: 2026-11-19T21:00:00Z
featured: false
tags:
  - sdlc
  - quy-trinh-phan-mem
  - code-review
---
# Code review

**Mục đích:** Hướng dẫn người review đọc một PR (đặc biệt PR do agent viết) để quyết định **Approve** hay **Request changes**. Đây là phần "đúng logic" của cổng G5.
Agent có thể làm review vòng một (tìm lỗi), nhưng người review là người chịu trách nhiệm cuối cùng.

**Liên quan:** [05-phat-trien.md](05-phat-trien.md) · [07-kiem-thu.md](07-kiem-thu.md) · [09-checklist-phe-duyet.md](09-checklist-phe-duyet.md) · [Claude CLI nhiều agent](../01-claude-cli-multi-agent/) · [Áp dụng với agent](../03-ap-dung-voi-agent/README.md)

---

## 1. Mục tiêu của review

Theo thứ tự quan trọng:

1. **Đúng:** code làm đúng yêu cầu (AC), kể cả trường hợp lỗi và biên.
2. **An toàn:** không tạo lỗ hổng bảo mật, không lộ dữ liệu, không mất dữ liệu.
3. **Không phá cái đang chạy:** không hồi quy, tương thích ngược.
4. **Bảo trì được:** người khác đọc hiểu, sửa được sau 6 tháng.
5. **Phong cách:** để linter lo; đừng tốn thời gian review cho dấu cách.

Review **không** nhằm viết lại code theo sở thích của reviewer.

## 2. Mức độ ưu tiên của finding

| Mức | Ý nghĩa | Ví dụ (*Leave*) | Xử lý |
|-----|---------|-----------------|-------|
| **Blocker** | Sai nghiệp vụ, lỗ hổng bảo mật, mất dữ liệu | Nhân viên tự duyệt được đơn của mình; số dư bị trừ hai lần khi bấm đúp | Bắt buộc sửa trước merge |
| **Major** | Lỗi ở trường hợp ít gặp, thiếu test cho AC, xử lý lỗi sai | Đơn nửa ngày qua ngày lễ tính sai; thiếu test cho 409 | Sửa trước merge (trừ khi có lý do + ticket) |
| **Minor** | Khó đọc, đặt tên kém, trùng lặp nhỏ | Hàm 120 dòng; tên `data2` | Nên sửa; có thể ticket sau |
| **Nit** | Sở thích | Thứ tự import | Không chặn merge |

Ghi rõ mức trong mỗi bình luận: `[Blocker] ...`, `[Nit] ...`.

## 3. Cách đọc diff — trình tự khuyến nghị

1. **Đọc mô tả PR và task gốc trước.** Biết code *phải* làm gì trước khi xem nó *đang* làm gì.
2. **Xem danh sách file** (`git diff --stat main...HEAD`). File nào lạ so với phạm vi?
3. **Đọc test trước code.** Test có khớp AC không? Có trường hợp lỗi, phân quyền, biên không? Test có thể fail không (hay luôn pass)?
4. **Đọc code theo luồng dữ liệu**, từ điểm vào (controller/endpoint) tới DB, không theo thứ tự file.
5. **Với mỗi đầu vào từ bên ngoài**, hỏi: được kiểm tra chưa? Ai được phép?
6. **Với mỗi lời gọi ra ngoài**, hỏi: lỗi thì sao? chậm thì sao?
7. **Tìm phần bị xóa** — dòng đỏ trong diff thường nguy hiểm hơn dòng xanh.
8. **Chạy thử** nếu thay đổi có rủi ro: checkout nhánh, chạy test, gọi API.

Lệnh hữu ích:

```bash
git fetch origin
git diff --stat origin/main...origin/feat/T-1.2.3       # file nào đổi
git diff origin/main...origin/feat/T-1.2.3 -- tests/      # chỉ test
git log --oneline origin/main..origin/feat/T-1.2.3        # các commit
git diff origin/main...origin/feat/T-1.2.3 | grep -nE "skip|Ignore|no-verify|disable|TODO|catch *\(.*\) *\{ *\}"
```

Trong Claude Code: `/code-review` để agent review vòng một (xem [../01-claude-cli-multi-agent/](../01-claude-cli-multi-agent/)). Kết quả review của agent cũng phải được người kiểm tra — agent có thể bỏ sót hoặc báo lỗi giả.

## 4. Những gì agent hay làm sai

| Lỗi | Biểu hiện | Ví dụ *Leave* | Cách kiểm |
|-----|-----------|---------------|-----------|
| **Bịa API / thư viện** | Gọi hàm không tồn tại, tham số sai, phiên bản không khớp | `holidays.IsBusinessDay(date)` — không có hàm này | Build/compile; tra tài liệu chính thức |
| **Sửa test cho pass** | Đổi kỳ vọng thay vì sửa code | `Assert.Equal(4, days)` thành `Assert.Equal(5, days)` | Đọc diff thư mục test; hỏi "vì sao đổi kỳ vọng?" |
| **Test không kiểm gì** | Test luôn pass, mock mọi thứ, không có assert | Test gọi API rồi chỉ kiểm `!= null` | Tạm làm hỏng code, test có fail không? |
| **Bỏ xử lý lỗi** | `catch {}` rỗng, nuốt exception, trả 200 khi lỗi | Email lỗi → nuốt → không ai biết | Tìm `catch`, `except`, `try` |
| **Over-engineering** | Interface, factory, generic cho một trường hợp duy nhất | `ILeaveDecisionStrategyFactory` cho 2 lựa chọn | Hỏi "bỏ lớp này thì mất gì?" |
| **Thay đổi ngoài phạm vi** | Refactor file khác, đổi format toàn bộ, nâng version thư viện | Đổi tên cột trong migration cũ | `git diff --stat` |
| **Tuyên bố không có bằng chứng** | "Đã test kỹ, tất cả pass" | Không có log CI | Đòi link CI / output lệnh |
| **Hard-code** | Giá trị cố định để qua test hoặc demo | Năm `2026` cứng trong code | Tìm số, ngày, chuỗi cứng |
| **Phân quyền thiếu** | Kiểm vai trò nhưng không kiểm sở hữu bản ghi | Quản lý phòng A duyệt được đơn phòng B | Test với người dùng khác phòng |
| **Race condition** | Đọc rồi ghi không khóa | Hai request duyệt đồng thời trừ số dư hai lần | Tìm đọc–sửa–ghi không có transaction/lock |
| **Bỏ qua yêu cầu khó** | Làm happy path, im lặng bỏ AC khó | Không làm AC-07.4 (409) | Đối chiếu từng AC với test |

## 5. Checklist cho reviewer

**Đúng yêu cầu**
- [ ] Mỗi AC của task có code và test tương ứng.
- [ ] Trường hợp lỗi, biên, phân quyền đều được xử lý.

**An toàn**
- [ ] Mọi đầu vào từ client được kiểm tra; không tin giá trị client tự tính (`days`, `employee_id`).
- [ ] Phân quyền kiểm tra trên bản ghi cụ thể.
- [ ] Không SQL nối chuỗi; không log dữ liệu nhạy cảm (lý do nghỉ ốm, token).
- [ ] Không có bí mật trong code.

**Dữ liệu**
- [ ] Thao tác nhiều bước nằm trong transaction.
- [ ] Đồng thời được xử lý (lock / version).
- [ ] Migration có đường lùi; không xóa cột/dữ liệu mà không có kế hoạch.

**Chất lượng**
- [ ] Không có code chết, debug print, TODO không ticket.
- [ ] Không thêm trừu tượng không cần.
- [ ] Tên rõ nghĩa; hàm ngắn vừa đủ.

**Bằng chứng**
- [ ] CI pass trên commit cuối.
- [ ] Test thực sự fail khi code sai (ít nhất kiểm tra một test quan trọng).

## 6. Approve hay Request changes

| Quyết định | Khi nào |
|-----------|---------|
| **Approve** | Không có Blocker/Major; Minor/Nit được ghi nhận hoặc đã sửa; CI pass |
| **Approve with comments** | Chỉ còn Minor/Nit, tác giả có thể sửa sau merge với ticket |
| **Request changes** | Có ít nhất một Blocker hoặc Major; hoặc thiếu bằng chứng test; hoặc ngoài phạm vi |
| **Close / làm lại** | Sai hướng thiết kế, PR quá lớn để review, hoặc phần lớn code không đáp ứng task |

Quy tắc: **nếu bạn không hiểu một đoạn code, đừng approve.** Yêu cầu giải thích hoặc đơn giản hóa. Code bạn không hiểu là code không ai bảo trì được.

## Checklist phê duyệt

| # | Câu hỏi | Có/Không |
|---|---------|:-------:|
| 1 | Tôi đã đọc task/AC gốc trước khi đọc code? | |
| 2 | Tôi đã đọc toàn bộ diff (không chỉ phần agent tóm tắt)? | |
| 3 | Mọi AC đều có test và test kiểm tra đúng điều AC nói? | |
| 4 | Tôi đã kiểm phần test bị sửa/xóa và chấp nhận lý do? | |
| 5 | Không có Blocker/Major nào còn mở? | |
| 6 | Phân quyền, đầu vào, transaction, concurrency đã được xem? | |
| 7 | Mọi API/thư viện được gọi là có thật và đúng phiên bản (build pass)? | |
| 8 | CI pass trên commit cuối cùng? | |
| 9 | Tôi hiểu toàn bộ code mình đang approve? | |
| 10 | Không có thay đổi ngoài phạm vi chưa được chấp thuận? | |

## Dấu hiệu phải từ chối (red flags)

- Bạn không hiểu một phần code và tác giả (agent) không giải thích được thuyết phục.
- Test kỳ vọng bị đổi để khớp với code mới mà không có thay đổi yêu cầu.
- Có `catch` rỗng hoặc lỗi bị nuốt ở đường đi quan trọng.
- Mô tả PR nói "đã test" nhưng không có log/CI.
- Diff có file ngoài phạm vi hoặc đổi CI/lint/hook.
- Có lời gọi hàm/thư viện mà bạn không tìm thấy trong tài liệu chính thức.
- Kết quả review của agent nói "không có vấn đề" nhưng bạn tự thấy vấn đề — đừng tin review agent hơn mắt mình.
