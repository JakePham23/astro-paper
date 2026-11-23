---
title: "Biên bản phê duyệt — <Gate> — <Tên artefact>"
description: "Red flags phát hiện: Không có / <liệt kê>"
pubDatetime: 2026-11-19T14:00:00Z
featured: false
tags:
  - template
  - tai-lieu
---
# Biên bản phê duyệt — <Gate> — <Tên artefact>

> **Hướng dẫn:** Một biên bản cho một lần duyệt một cổng. Phê duyệt chỉ có hiệu lực cho đúng phiên bản / commit ghi dưới đây; artefact thay đổi sau đó phải duyệt lại.
> Agent có thể soạn sẵn phần "Đầu vào" và "Bằng chứng", nhưng phần "Quyết định" chỉ người phê duyệt điền.
> Hướng dẫn: [../02-quy-trinh-phan-mem/09-checklist-phe-duyet.md](../02-quy-trinh-phan-mem/09-checklist-phe-duyet.md)

## 1. Thông tin

| Mục | Giá trị |
|-----|---------|
| Mã biên bản | APR-<mã dự án>-<số> |
| Gate | G0 / G1 / G2 / G3 / G4 / G5 / G6 / G7 / G8 |
| Artefact được duyệt | <BRD / SRS / thiết kế / kế hoạch / PR #… / báo cáo test / release …> |
| Đường dẫn | <đường dẫn file hoặc link PR> |
| Phiên bản / commit SHA | <...> |
| Người / agent soạn | <tên> / <agent, model, phiên làm việc nếu có> |
| Người phê duyệt | <họ tên, vai trò> |
| Người được hỏi ý kiến | <...> |
| Ngày duyệt | <YYYY-MM-DD> |
| Cổng được gộp (nếu có) | <ví dụ: G2–G4 gộp cho bug fix BUG-112> |

## 2. Bằng chứng đã xem

> Ghi cụ thể: cái gì, ở đâu. Không ghi "đã xem tài liệu".

| # | Bằng chứng | Vị trí (link / file / SHA) | Kết quả kiểm |
|---|-----------|----------------------------|--------------|
| 1 | <ví dụ: CI run trên commit abc1234> | <link> | <248 pass, 0 fail, 2 skip (lý do: …)> |
| 2 | <ví dụ: ma trận truy vết BR→FR> | <file:mục> | <đủ 12/12 BR Must> |
| 3 | <ví dụ: kiểm ngẫu nhiên nguồn số liệu baseline> | <...> | <khớp / không khớp> |

## 3. Kết quả checklist

| Checklist | Số câu "Có" / tổng | Câu "Không" và lý do chấp nhận |
|-----------|--------------------|--------------------------------|
| Checklist chung ([09](../02-quy-trinh-phan-mem/09-checklist-phe-duyet.md)) | <.../8> | <...> |
| Checklist riêng của cổng | <.../...> | <...> |

**Red flags phát hiện:** Không có / <liệt kê>

## 4. Quyết định

- [ ] **Approve**
- [ ] **Approve with conditions**
- [ ] **Reject**

**Lý do:** <...>

### Điều kiện (khi Approve with conditions)

| # | Điều kiện | Người chịu trách nhiệm | Hạn | Cách kiểm lại |
|---|-----------|------------------------|-----|---------------|
| 1 | <...> | <...> | <...> | <...> |

### Việc phải làm để nộp lại (khi Reject)

1. <...>

## 5. Rủi ro được chấp nhận
> Rủi ro biết trước nhưng vẫn cho đi tiếp, và ai chấp nhận.

| Rủi ro | Người chấp nhận | Ghi chú |
|--------|-----------------|---------|
| <...> | <...> | <...> |

## 6. Ký

| Vai trò | Họ tên | Chữ ký / xác nhận | Ngày |
|---------|--------|-------------------|------|
| Người phê duyệt | | | |
| <Người được hỏi ý kiến> | | | |
