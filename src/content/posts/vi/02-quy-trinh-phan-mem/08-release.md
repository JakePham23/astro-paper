---
title: "Release: phát hành, triển khai, rollback"
description: "Đưa phiên bản đã kiểm thử tới người dùng một cách có kiểm soát, luôn có đường lui. Đây là cổng G8 (Go/No-go)."
pubDatetime: 2026-11-19T19:00:00Z
featured: false
tags:
  - sdlc
  - quy-trinh-phan-mem
  - release
---
# Release: phát hành, triển khai, rollback

**Mục đích:** Đưa phiên bản đã kiểm thử tới người dùng một cách có kiểm soát, luôn có đường lui. Đây là cổng G8 (Go/No-go).
Câu hỏi của người duyệt không phải "phần mềm có tốt không?" (đã trả lời ở G6/G7), mà là **"phát hành bây giờ có an toàn không, và nếu hỏng thì quay lại thế nào, mất bao lâu?"**

**Liên quan:** [07-kiem-thu.md](07-kiem-thu.md) · [05-phat-trien.md](05-phat-trien.md) · [09-checklist-phe-duyet.md](09-checklist-phe-duyet.md) · [Mẫu release checklist](../04-mau/release-checklist-template.md) · [Mẫu biên bản phê duyệt](../04-mau/approval-record-template.md) · [Áp dụng với agent](../03-ap-dung-voi-agent/README.md)

---

## 1. Đánh phiên bản: SemVer

Định dạng **MAJOR.MINOR.PATCH** (ví dụ `1.4.2`).

| Tăng | Khi | Ví dụ *Leave* |
|------|-----|---------------|
| MAJOR | Thay đổi không tương thích ngược (API đổi, dữ liệu đổi cấu trúc buộc client sửa) | Đổi `POST /leave-requests` sang định dạng body mới → `2.0.0` |
| MINOR | Thêm tính năng, tương thích ngược | Thêm lịch nghỉ nhóm (FR-07) → `1.1.0` |
| PATCH | Sửa lỗi, tương thích ngược | Sửa tính nửa ngày qua ngày lễ → `1.1.1` |

Phiên bản trước phát hành: `1.1.0-rc.1` (release candidate), `1.1.0-beta.2`. Với Conventional Commits, phiên bản có thể tính tự động từ loại commit (xem [05](05-phat-trien.md)).

## 2. Nhánh release và tag

- **Trunk-based:** tag trực tiếp commit trên `main`: `git tag -a v1.1.0 -m "Leave 1.1.0"`.
- **GitFlow:** tạo `release/1.1.0` từ `develop`, chỉ sửa lỗi trên nhánh này, merge vào `main` + tag, rồi merge ngược về `develop`.
- **Quy tắc:** tag là bất biến. Không xóa/di chuyển tag đã phát hành; sai thì phát hành bản mới (`1.1.1`).
- **Build một lần, deploy nhiều nơi:** cùng một artefact (gói, image) đã test ở staging được đưa lên production — không build lại.

## 3. Changelog và release note

| | Changelog | Release note |
|--|-----------|--------------|
| Người đọc | Dev, vận hành | Người dùng, nghiệp vụ, hỗ trợ |
| Nội dung | Mọi thay đổi theo loại (Added, Changed, Fixed, Removed, Security) | Điều người dùng thấy khác, cách dùng, lưu ý |
| Nguồn | Sinh từ commit + chỉnh tay | Viết tay (agent có thể soạn nháp) |

Ví dụ release note:

> **Leave 1.1.0 — 05/03/2027**
> **Mới:** Quản lý xem lịch nghỉ của nhóm theo tháng (menu *Lịch nhóm*).
> **Sửa:** Đơn nửa ngày trùng ngày lễ không còn bị trừ 0,5 ngày.
> **Lưu ý:** Đơn tạo trước 05/03 hiển thị trong lịch sau khi tải lại trang.
> **Không thay đổi:** Cách gửi và duyệt đơn.

## 4. Họp Go/No-go

Thành phần: Release manager (chủ trì), PO, QA lead, Dev lead, vận hành/IT, đại diện nghiệp vụ, người phê duyệt.

Chương trình:
1. Trạng thái test exit (G6) và UAT (G7) — có biên bản chưa?
2. Lỗi còn mở và rủi ro chấp nhận.
3. Kế hoạch triển khai, khung giờ, người trực.
4. Kế hoạch rollback — đã diễn tập chưa?
5. Truyền thông tới người dùng.
6. Quyết định: **Go** / **Go có điều kiện** / **No-go** — ghi biên bản.

**No-go không phải thất bại.** No-go đúng lúc rẻ hơn rất nhiều so với rollback lúc 2 giờ sáng.

## 5. Chiến lược triển khai

| Chiến lược | Cách làm | Ưu | Nhược | Khi dùng |
|-----------|----------|----|-------|----------|
| **Big bang** | Thay toàn bộ một lần | Đơn giản | Rủi ro cao, có downtime | Hệ thống nội bộ nhỏ, có cửa sổ bảo trì |
| **Blue-green** | Hai môi trường giống nhau; deploy lên "green", chuyển traffic từ "blue" sang | Rollback tức thì (chuyển lại) | Gấp đôi hạ tầng; DB dùng chung phải tương thích cả hai bản | Cần downtime ≈ 0 |
| **Canary** | Cho một phần nhỏ người dùng (5% → 25% → 100%) dùng bản mới, theo dõi chỉ số | Phát hiện lỗi với ít người bị ảnh hưởng | Cần định tuyến và giám sát tốt | Hệ thống nhiều người dùng |
| **Feature flag** | Code mới đã deploy nhưng tắt; bật theo nhóm người dùng | Tách deploy khỏi release; tắt nhanh | Nợ kỹ thuật nếu không dọn flag | Tính năng rủi ro, trunk-based |

*Leave* (420 người dùng nội bộ): blue-green hoặc big bang ngoài giờ + feature flag cho tính năng mới (bật cho phòng Kỹ thuật trước 1 tuần, sau đó toàn công ty).

**Migration DB** là phần nguy hiểm nhất: dùng mô hình *expand → migrate → contract* — thêm cột mới (tương thích bản cũ) → deploy code mới → chuyển dữ liệu → chỉ xóa cột cũ ở release sau. Như vậy rollback code không cần rollback DB.

## 6. Kế hoạch rollback

Phải trả lời **trước** khi deploy:

| Câu hỏi | Ví dụ *Leave* 1.1.0 |
|---------|---------------------|
| Điều kiện kích hoạt rollback? | Tỷ lệ lỗi 5xx > 2% trong 10 phút, hoặc bất kỳ sai số dư nào được báo, hoặc không đăng nhập được |
| Ai có quyền quyết định? | Release manager (hoặc Dev lead trực khi vắng) |
| Các bước cụ thể? | 1. Tắt flag `team-calendar`. 2. Nếu vẫn lỗi: chuyển traffic về blue. 3. Không chạy down-migration (schema tương thích ngược). |
| Mất bao lâu? | ≤ 15 phút (đã diễn tập trên staging ngày 03/03) |
| Dữ liệu tạo trong thời gian lỗi xử lý thế nào? | Đơn tạo bằng bản mới vẫn đọc được bằng bản cũ (cùng schema) |
| Thông báo cho ai? | Kênh #leave-support, email HR |

Rollback chưa từng diễn tập = không có rollback.

## 7. Smoke test sau deploy

Một danh sách ngắn (5–10 phút) chạy ngay sau khi deploy production:

- [ ] Trang chủ tải, đăng nhập SSO được.
- [ ] Health check `GET /health` trả 200, kết nối DB OK.
- [ ] Tạo đơn test bằng tài khoản test → quản lý test duyệt → số dư giảm → email tới.
- [ ] Xuất báo cáo tháng gần nhất.
- [ ] Log không có lỗi mới bất thường.
- [ ] Xóa/đánh dấu dữ liệu test.

## 8. Giám sát sau release

| Chỉ số | Ngưỡng cảnh báo |
|--------|-----------------|
| Tỷ lệ lỗi 5xx | > 1% trong 5 phút |
| Độ trễ p95 | > 500 ms (NFR-01) |
| Thông báo thất bại (`notification_failed`) | > 0 trong 15 phút |
| Số đơn được tạo/giờ | Giảm bất thường so với tuần trước |

Theo dõi sát 24–72 giờ đầu; có người trực rõ ràng. SLO (mục tiêu dịch vụ) lấy từ NFR (ví dụ NFR-05 uptime 99,5%).

## 9. Hotfix

Lỗi nghiêm trọng trên production cần sửa ngay:
1. Đánh giá: rollback hay hotfix? (Rollback thường nhanh và an toàn hơn.)
2. Nhánh `hotfix/1.1.1` từ tag `v1.1.0`.
3. Test tái hiện lỗi → sửa → test pass → review (có thể rút gọn nhưng **không bỏ**).
4. Release `1.1.1`, merge ngược về nhánh chính.
5. Post-mortem.

Hotfix vẫn đi qua G5 và G8 ở dạng rút gọn; ghi rõ trong biên bản phê duyệt.

## 10. Post-mortem (blameless)

Sau sự cố hoặc sau release lớn. **Không đổ lỗi cá nhân** — tìm lỗ hổng trong quy trình.

| Mục | Nội dung |
|-----|----------|
| Tóm tắt | Chuyện gì, ảnh hưởng ai, bao lâu |
| Dòng thời gian | Phát hiện lúc nào, ai làm gì, khi nào khắc phục |
| Nguyên nhân gốc | Dùng "5 Why" |
| Điều đã làm tốt / chưa tốt | |
| Hành động | Mỗi hành động có người chịu trách nhiệm và hạn; ví dụ "Thêm test hồi quy cho ngày lễ trùng nửa ngày", "Thêm câu hỏi về ngày lễ vào checklist G2" |

Hành động post-mortem nên quay về cập nhật checklist ở [09-checklist-phe-duyet.md](09-checklist-phe-duyet.md) — đó là cách quy trình tự cải thiện.

## Checklist phê duyệt

**G8 — Go/No-go** (đầy đủ trong [mẫu](../04-mau/release-checklist-template.md))

| # | Câu hỏi | Có/Không |
|---|---------|:-------:|
| 1 | G6 test exit và G7 UAT đã có biên bản Approve? | |
| 2 | Artefact phát hành chính là artefact đã test (cùng build/SHA/digest)? | |
| 3 | Số phiên bản đúng SemVer; tag đã tạo trên đúng commit? | |
| 4 | Changelog và release note đã duyệt? | |
| 5 | Lỗi còn mở được liệt kê và người có thẩm quyền chấp nhận rủi ro? | |
| 6 | Migration DB tương thích ngược hoặc có kế hoạch lùi đã diễn tập? | |
| 7 | Kế hoạch rollback có điều kiện kích hoạt, người quyết, các bước, thời gian, và đã diễn tập? | |
| 8 | Có backup trước deploy và đã kiểm tra khôi phục được? | |
| 9 | Smoke test và giám sát đã sẵn sàng; có người trực? | |
| 10 | Khung giờ deploy được chấp thuận; người dùng được thông báo? | |
| 11 | Bảo mật/Pháp chế đã chấp thuận nếu thay đổi dữ liệu cá nhân? | |

## Dấu hiệu phải từ chối (red flags)

- Không có kế hoạch rollback, hoặc có nhưng chưa từng diễn tập.
- Artefact được build lại sau khi test ("code giống hệt mà").
- Migration xóa cột/bảng trong cùng release với code mới.
- Còn lỗi Critical/High mở, hoặc vừa bị hạ mức ngay trước họp.
- Deploy vào chiều thứ Sáu / trước nghỉ lễ mà không có người trực.
- Release note do agent viết chưa ai kiểm, có tính năng không có trong release.
- Không ai được chỉ định quyền quyết định rollback.
- UAT chưa ký nhưng "sẽ ký sau".
