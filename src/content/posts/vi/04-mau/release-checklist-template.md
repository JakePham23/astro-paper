---
title: "Release checklist — <Tên hệ thống> v<MAJOR.MINOR.PATCH>"
description: "- [ ] <Đăng nhập được>"
pubDatetime: 2026-11-19T12:00:00Z
featured: false
tags:
  - template
  - tai-lieu
  - checklist
  - release
---
# Release checklist — <Tên hệ thống> v<MAJOR.MINOR.PATCH>

> **Hướng dẫn:** Điền trước họp Go/No-go. Mỗi dòng ghi bằng chứng (link, SHA, người xác nhận). Dòng nào "Không" phải có lý do và người chấp nhận rủi ro.
> Hướng dẫn chi tiết: [../02-quy-trinh-phan-mem/08-release.md](../02-quy-trinh-phan-mem/08-release.md)

| Mục | Giá trị |
|-----|---------|
| Phiên bản | v<...> |
| Tag / commit | <tag> / <SHA> |
| Artefact | <tên gói / image + digest> |
| Ngày giờ deploy dự kiến | <YYYY-MM-DD HH:MM> |
| Chiến lược | Big bang / Blue-green / Canary / Feature flag |
| Release manager | <tên> |
| Người trực sau deploy | <tên, số liên lạc nội bộ> |

## 1. Điều kiện tiên quyết

| # | Mục | Có/Không | Bằng chứng |
|---|-----|:-------:|-----------|
| 1 | G6 test exit đã Approve | | <biên bản> |
| 2 | G7 UAT đã Approve | | <biên bản> |
| 3 | Artefact phát hành = artefact đã test (cùng digest) | | <...> |
| 4 | Phiên bản đúng SemVer, tag đúng commit | | <...> |
| 5 | Changelog và release note đã duyệt | | <link> |
| 6 | Lỗi mở được liệt kê và chấp nhận | | <danh sách + người chấp nhận> |
| 7 | Bảo mật / Pháp chế chấp thuận (nếu có thay đổi dữ liệu cá nhân) | | <...> |

## 2. Dữ liệu và hạ tầng

| # | Mục | Có/Không | Bằng chứng |
|---|-----|:-------:|-----------|
| 1 | Migration tương thích ngược (expand–contract) | | <...> |
| 2 | Backup trước deploy, đã kiểm tra khôi phục | | <...> |
| 3 | Cấu hình/bí mật production đã sẵn sàng (không nằm trong repo) | | <...> |
| 4 | Feature flag đặt đúng trạng thái ban đầu | | <...> |

## 3. Kế hoạch rollback

| Mục | Nội dung |
|-----|----------|
| Điều kiện kích hoạt | <ví dụ: 5xx > 2% trong 10 phút; sai dữ liệu nghiệp vụ> |
| Người quyết định | <...> |
| Các bước | 1. <...> 2. <...> 3. <...> |
| Thời gian dự kiến | <≤ ... phút> |
| Đã diễn tập | Có / Không — ngày <...>, môi trường <...> |
| Xử lý dữ liệu phát sinh trong thời gian lỗi | <...> |

## 4. Truyền thông

| # | Mục | Có/Không |
|---|-----|:-------:|
| 1 | Người dùng được báo trước khung giờ và thay đổi | |
| 2 | Bộ phận hỗ trợ có release note và FAQ | |
| 3 | Kênh báo sự cố đã thông báo | |

## 5. Sau deploy — smoke test

- [ ] <Đăng nhập được>
- [ ] <Health check 200>
- [ ] <Luồng nghiệp vụ chính chạy với tài khoản test>
- [ ] <Log không có lỗi mới bất thường>
- [ ] <Dọn dữ liệu test>

## 6. Giám sát (24–72 giờ đầu)

| Chỉ số | Ngưỡng cảnh báo | Người theo dõi |
|--------|-----------------|----------------|
| <tỷ lệ lỗi> | <...> | <...> |
| <độ trễ p95> | <...> | <...> |
| <chỉ số nghiệp vụ> | <...> | <...> |

## 7. Quyết định Go/No-go

| Thành phần | Họ tên | Ý kiến (Go / No-go / Go có điều kiện) |
|-----------|--------|----------------------------------------|
| Release manager | | |
| PO | | |
| QA lead | | |
| Dev lead | | |
| Vận hành | | |

**Quyết định cuối:** Go / Go có điều kiện / No-go
**Điều kiện (nếu có):** <...>
**Người ký:** <...> — <YYYY-MM-DD HH:MM>
