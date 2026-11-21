---
title: "SRS — <Tên hệ thống>"
description: "- Mục đích tài liệu: <...>"
pubDatetime: 2026-11-19T11:00:00Z
featured: false
tags:
  - template
  - tai-lieu
---
# SRS — <Tên hệ thống>

> **Hướng dẫn:** Thay mọi `<...>`. Mọi FR/NFR phải có ID và truy vết về BR. Mọi NFR phải có con số và cách đo.
> Hướng dẫn chi tiết: [../02-quy-trinh-phan-mem/02-yeu-cau-srs-prd.md](../02-quy-trinh-phan-mem/02-yeu-cau-srs-prd.md)

| Mục | Giá trị |
|-----|---------|
| Mã tài liệu | SRS-<mã> |
| Phiên bản | <0.1> |
| BRD tham chiếu | BRD-<mã> phiên bản <x.y> |
| Trạng thái | Nháp / Chờ duyệt / Đã duyệt |
| Người soạn | <tên> (agent hỗ trợ: <có/không>) |

## 1. Giới thiệu
- Mục đích tài liệu: <...>
- Phạm vi hệ thống (tóm tắt từ BRD): <...>
- Người đọc: <...>

## 2. Tổng quan
- Người dùng và vai trò: <...>
- Môi trường vận hành: <...>
- Ràng buộc thiết kế/công nghệ: <...>
- Giả định và phụ thuộc: <...>

## 3. Yêu cầu chức năng

| ID | Yêu cầu ("Hệ thống phải …") | Truy vết BR | Ưu tiên | Ghi chú |
|----|-----------------------------|-------------|---------|---------|
| FR-01 | <...> | BR-01 | Must | <...> |

### 3.1 Mô hình trạng thái
> Bắt buộc cho đối tượng có vòng đời. Liệt kê cả chuyển trạng thái **không** được phép.

```mermaid
stateDiagram-v2
    [*] --> <TRẠNG_THÁI_1>
    <TRẠNG_THÁI_1> --> <TRẠNG_THÁI_2>: <sự kiện>
```

### 3.2 Quy tắc nghiệp vụ

| ID | Quy tắc | Nguồn xác nhận (người, ngày) |
|----|---------|------------------------------|
| RULE-01 | <...> | <...> |

## 4. Yêu cầu phi chức năng

| ID | Loại | Yêu cầu (có con số) | Cách kiểm chứng | Truy vết |
|----|------|---------------------|-----------------|----------|
| NFR-01 | Hiệu năng | <...> | <...> | BR-xx |
| NFR-02 | Bảo mật | <...> | <...> | |
| NFR-03 | Khả dụng | <...> | <...> | |
| NFR-04 | Phục hồi (RPO/RTO) | <...> | <...> | |
| NFR-05 | Bảo trì | <...> | <...> | |
| NFR-06 | Tuân thủ / dữ liệu cá nhân | <...> | <...> | |

## 5. User story và tiêu chí chấp nhận

### US-01 — <tiêu đề>
**Là** <vai trò>, **tôi muốn** <hành động>, **để** <giá trị>. *(FR-xx, BR-xx)*

- **AC-01.1** (happy path) — *Given* <...>, *When* <...>, *Then* <...>.
- **AC-01.2** (dữ liệu sai) — *Given* <...>, *When* <...>, *Then* <...>.
- **AC-01.3** (không có quyền) — *Given* <...>, *When* <...>, *Then* <...>.
- **AC-01.4** (biên / đồng thời) — *Given* <...>, *When* <...>, *Then* <...>.

## 6. Giao diện ngoài
- Giao diện người dùng: <...>
- Giao diện với hệ thống khác: <...>

## 7. Dữ liệu
- Thực thể chính và dữ liệu nhạy cảm: <...>
- Thời hạn lưu trữ: <...>

## 8. Ưu tiên (MoSCoW)

| Must | Should | Could | Won't (đợt này) |
|------|--------|-------|-----------------|
| <...> | <...> | <...> | <...> |

## 9. Ma trận truy vết

| BR | FR/NFR | Story/AC | Thiết kế | Test case |
|----|--------|----------|----------|-----------|
| BR-01 | FR-01 | US-01 | *(điền ở G3)* | *(điền ở G6)* |

## 10. Câu hỏi mở và giả định do người soạn tự đặt
- [ ] <...>

## 11. Phê duyệt và lịch sử phiên bản

| Vai trò | Họ tên | Quyết định | Ngày |
|---------|--------|-----------|------|
| PO | <...> | | |

| Phiên bản | Ngày | Người sửa | Thay đổi |
|-----------|------|-----------|----------|
| 0.1 | <...> | <...> | Bản nháp đầu |
