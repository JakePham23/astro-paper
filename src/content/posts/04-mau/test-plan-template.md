---
title: "Test plan — <Tên hệ thống> <phiên bản>"
description: "- Môi trường: <staging URL / cấu hình>"
pubDatetime: 2026-11-19T10:00:00Z
featured: false
tags:
  - template
  - tai-lieu
  - testing
---
# Test plan — <Tên hệ thống> <phiên bản>

> **Hướng dẫn:** Tiêu chí vào/ra phải được duyệt **trước** khi bắt đầu test và không đổi sau khi có kết quả.
> Hướng dẫn chi tiết: [../02-quy-trinh-phan-mem/07-kiem-thu.md](../02-quy-trinh-phan-mem/07-kiem-thu.md)

| Mục | Giá trị |
|-----|---------|
| Mã tài liệu | TP-<mã> |
| Phiên bản | <0.1> |
| SRS tham chiếu | SRS-<mã> phiên bản <x.y> |
| Build / commit được test | <tag hoặc SHA> |
| QA lead | <tên> |

## 1. Mục tiêu
<...>

## 2. Phạm vi kiểm thử

| Trong phạm vi | Ngoài phạm vi (và lý do) |
|---------------|--------------------------|
| <FR/NFR/tính năng> | <...> — <lý do> |

## 3. Chiến lược

| Cấp độ | Kiểm cái gì | Tự động/Thủ công | Công cụ | Người/agent |
|--------|-------------|------------------|---------|-------------|
| Unit | <...> | Tự động | <...> | <...> |
| Integration | <...> | | | |
| System / E2E | <...> | | | |
| Regression | <...> | | | |
| Performance | <NFR-xx> | | | |
| Security | <NFR-xx> | | | |
| UAT | <BR Must> | Thủ công | | Người dùng nghiệp vụ |

## 4. Môi trường và dữ liệu
- Môi trường: <staging URL / cấu hình>
- Dữ liệu test: <nguồn, cách ẩn danh>
- Tài khoản test theo vai trò: <...>

## 5. Tiêu chí vào (entry)
- [ ] <Build đã deploy lên môi trường test, smoke test pass>
- [ ] <Test case đã được duyệt>
- [ ] <...>

## 6. Tiêu chí ra (exit)
- [ ] <100% test case ưu tiên Cao đã chạy>
- [ ] <≥ ...% pass>
- [ ] <0 lỗi Critical/High mở>
- [ ] <NFR hiệu năng đạt: ...>
- [ ] <Lỗi Medium/Low mở được PO chấp nhận>

## 7. Tiêu chí tạm dừng / tiếp tục
- Tạm dừng khi: <ví dụ: không đăng nhập được, > 30% test chặn bởi một lỗi>
- Tiếp tục khi: <...>

## 8. Quản lý lỗi
- Công cụ: <...>
- Định nghĩa severity: Critical / High / Medium / Low — <link hoặc mô tả>
- Người phân loại priority: <PO>

## 9. Truy vết

| FR/NFR | Test case | Loại | Kết quả |
|--------|-----------|------|---------|
| FR-01 | TC-001..TC-00x | <...> | *(điền khi chạy)* |

## 10. Lịch và nguồn lực

| Hoạt động | Bắt đầu | Kết thúc | Người |
|-----------|---------|----------|-------|
| <...> | | | |

## 11. Rủi ro kiểm thử
- <...>

## 12. Bằng chứng phải nộp khi kết thúc
- [ ] Link CI / báo cáo công cụ cho build <SHA>
- [ ] Số test chạy / pass / fail / skip (kèm lý do skip)
- [ ] Ma trận truy vết đã điền kết quả
- [ ] Báo cáo test tải
- [ ] Danh sách lỗi mở
- [ ] Danh sách điều chưa kiểm và lý do

## 13. Phê duyệt

| Vai trò | Họ tên | Quyết định | Ngày |
|---------|--------|-----------|------|
| QA lead | | | |
| PO | | | |
