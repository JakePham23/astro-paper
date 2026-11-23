---
title: "BRD — Tài liệu yêu cầu nghiệp vụ (Business Requirements Document)"
description: "BRD trả lời câu hỏi \"Tại sao làm và làm để đạt được gì về mặt kinh doanh?\" — không trả lời \"hệ thống làm thế nào\". Đây là cổng G1: duyệt BRD tức là đồng ý rằng vấn đề, mục tiêu..."
pubDatetime: 2026-11-20T02:00:00Z
featured: false
tags:
  - sdlc
  - quy-trinh-phan-mem
---
# BRD — Tài liệu yêu cầu nghiệp vụ (Business Requirements Document)

**Mục đích:** BRD trả lời câu hỏi **"Tại sao làm và làm để đạt được gì về mặt kinh doanh?"** — không trả lời "hệ thống làm thế nào". Đây là cổng G1: duyệt BRD tức là đồng ý rằng vấn đề, mục tiêu và phạm vi đã đúng.
Sai ở BRD là sai đắt nhất: mọi giai đoạn sau sẽ xây đúng một thứ sai.

**Liên quan:** [00-tong-quan.md](00-tong-quan.md) · [02-yeu-cau-srs-prd.md](02-yeu-cau-srs-prd.md) · [09-checklist-phe-duyet.md](09-checklist-phe-duyet.md) · [Mẫu BRD](../04-mau/brd-template.md) · [Áp dụng với agent](../03-ap-dung-voi-agent/README.md)

---

## 1. BRD là gì, không phải là gì

| BRD **là** | BRD **không phải** |
|------------|--------------------|
| Mô tả vấn đề nghiệp vụ và mục tiêu đo được | Đặc tả màn hình, API, cơ sở dữ liệu |
| Nói bằng ngôn ngữ nghiệp vụ, người không biết kỹ thuật đọc hiểu được | Tài liệu kỹ thuật cho dev |
| Xác định phạm vi trong và ngoài | Danh sách tính năng "có thì tốt" |
| Căn cứ để đo dự án thành công hay thất bại | Kế hoạch dự án hay báo giá |

**Ai viết:** BA (hoặc PO) cùng các bên liên quan. Agent có thể soạn nháp từ biên bản họp, ghi chú phỏng vấn, email — nhưng **mọi con số và mọi khẳng định về hiện trạng phải đến từ người, không phải agent tự suy ra.**

**Ai duyệt:** Sponsor + đại diện người dùng nghiệp vụ (ví dụ trưởng phòng HR) + PO.

## 2. Cấu trúc chi tiết

### 2.1 Bối cảnh (Background)
Tình hình hiện tại, quy trình đang chạy như thế nào, ai liên quan.
> *Leave:* "Hiện nhân viên gửi đơn nghỉ phép qua email cho quản lý; quản lý trả lời email; HR ghi tay vào file Excel `NghiPhep_2026.xlsx`. Công ty có 420 nhân viên, khoảng 180 đơn/tháng."

### 2.2 Vấn đề (Problem statement)
Nỗi đau cụ thể, có số liệu. Một câu vấn đề tốt có dạng: *Ai* gặp *vấn đề gì*, *ảnh hưởng thế nào*, *đo bằng gì*.
> *Leave:* "Thời gian từ lúc gửi đến lúc có quyết định trung bình 3,1 ngày (đo trên 200 email tháng 9/2026). 12% đơn bị thất lạc và phải gửi lại. HR mất 16 giờ công mỗi tháng để tổng hợp và đối chiếu số ngày phép còn lại; mỗi quý có khoảng 5 khiếu nại do sai số dư."

### 2.3 Mục tiêu (Objectives) — theo SMART
SMART = **S**pecific (cụ thể), **M**easurable (đo được), **A**chievable (khả thi), **R**elevant (liên quan đến vấn đề), **T**ime-bound (có thời hạn).

| Không đạt SMART | Đạt SMART |
|-----------------|-----------|
| "Tăng tốc quy trình nghỉ phép" | "Giảm thời gian duyệt đơn trung bình từ 3,1 ngày xuống ≤ 1 ngày làm việc trong 3 tháng sau go-live" |
| "Giảm việc cho HR" | "Giảm thời gian tổng hợp báo cáo phép hằng tháng của HR từ 16 giờ xuống ≤ 2 giờ vào tháng 3/2027" |
| "Chính xác hơn" | "0 khiếu nại về sai số dư phép trong 2 quý liên tiếp sau go-live" |

### 2.4 Phạm vi (Scope)
Ghi **cả trong phạm vi lẫn ngoài phạm vi**. Mục "ngoài phạm vi" quan trọng ngang mục "trong phạm vi" vì nó chặn việc agent/dev tự mở rộng.

| Trong phạm vi (In scope) | Ngoài phạm vi (Out of scope) |
|--------------------------|------------------------------|
| Tạo, duyệt, từ chối, hủy đơn nghỉ phép | Chấm công, tính lương |
| Theo dõi số dư phép năm, phép ốm | Nghỉ thai sản (theo luật riêng, giai đoạn 2) |
| Thông báo email cho nhân viên và quản lý | Ứng dụng di động native |
| Báo cáo tháng cho HR (xuất Excel) | Tích hợp với hệ thống ERP |

### 2.5 Bên liên quan (Stakeholders)

| Bên liên quan | Quan tâm | Ảnh hưởng | Người đại diện |
|---------------|----------|-----------|----------------|
| Nhân viên | Gửi đơn nhanh, biết kết quả | Trung bình | Đại diện công đoàn |
| Quản lý trực tiếp | Duyệt nhanh, thấy lịch nghỉ của nhóm | Cao | Trưởng phòng Kỹ thuật |
| HR | Số liệu đúng, báo cáo nhanh, tuân thủ luật lao động | Cao | Trưởng phòng HR |
| IT | Vận hành, bảo mật, SSO | Trung bình | IT Manager |
| Ban giám đốc | Chi phí, hiệu quả | Quyết định | Sponsor |

### 2.6 Yêu cầu nghiệp vụ (BR-xx)
Phát biểu **cái nghiệp vụ cần**, không nói giải pháp. Mỗi BR có ID, mô tả, lý do, ưu tiên, người yêu cầu.

| ID | Yêu cầu | Lý do | Ưu tiên | Nguồn |
|----|---------|-------|---------|-------|
| BR-01 | Nhân viên phải gửi được đơn và quản lý phải ra quyết định mà không cần email | Giảm thời gian và thất lạc | Must | Trưởng phòng HR |
| BR-02 | Số dư phép của mỗi nhân viên phải luôn đúng và nhân viên tự xem được | Giảm khiếu nại | Must | HR |
| BR-03 | HR phải có báo cáo phép theo tháng, theo phòng ban | Giảm 16 giờ tổng hợp | Must | HR |
| BR-04 | Quản lý thấy được ai trong nhóm nghỉ ngày nào | Tránh thiếu người | Should | Trưởng phòng Kỹ thuật |
| BR-05 | Dữ liệu nghỉ ốm là dữ liệu nhạy cảm, chỉ HR và quản lý trực tiếp xem lý do | Tuân thủ bảo vệ dữ liệu cá nhân | Must | Pháp chế |

> Sai: "BR-01: Hệ thống dùng React và có nút Duyệt màu xanh." — đây là giải pháp, thuộc SRS/thiết kế.

### 2.7 KPI / tiêu chí thành công
Cách đo sau khi go-live, ai đo, đo khi nào, nguồn dữ liệu. Phải có **giá trị nền (baseline)** hiện tại.

| KPI | Baseline | Mục tiêu | Cách đo | Thời điểm |
|-----|----------|----------|---------|-----------|
| Thời gian duyệt trung bình | 3,1 ngày | ≤ 1 ngày làm việc | Log hệ thống: `decided_at - submitted_at` | 3 tháng sau go-live |
| Tỷ lệ đơn thất lạc | 12% | 0% | Số đơn không có quyết định sau 5 ngày | Hằng tháng |
| Giờ công HR tổng hợp | 16 giờ/tháng | ≤ 2 giờ/tháng | HR tự ghi nhận | Tháng 3/2027 |
| Tỷ lệ người dùng dùng hệ thống | 0% | ≥ 95% đơn qua hệ thống | Đếm đơn hệ thống / tổng đơn | 2 tháng sau go-live |

### 2.8 Giả định (Assumptions)
Những điều coi là đúng nhưng **chưa được chứng minh**. Mỗi giả định sai là một rủi ro.
> "Mọi nhân viên có tài khoản Microsoft 365 để đăng nhập SSO." · "Chính sách phép năm 2027 không đổi so với 2026."

### 2.9 Ràng buộc (Constraints)
Những điều **không được thay đổi**: ngân sách, thời hạn, công nghệ bắt buộc, luật.
> "Go-live trước 01/03/2027." · "Chạy trên hạ tầng nội bộ, không dùng SaaS bên ngoài." · "Tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân."

### 2.10 Rủi ro (Risks)

| Rủi ro | Khả năng | Ảnh hưởng | Biện pháp giảm | Người theo dõi |
|--------|----------|-----------|----------------|----------------|
| Quản lý không quen dùng, tiếp tục duyệt qua email | Trung bình | Cao | Đào tạo, tắt kênh email sau 1 tháng | PO |
| Dữ liệu số dư Excel hiện tại sai | Cao | Cao | HR đối soát trước khi nhập | HR |

### 2.11 Phụ thuộc (Dependencies)
Việc/hệ thống/người khác mà dự án cần. > "Cần IT cấp ứng dụng SSO trên Azure AD trước 15/12/2026."

### 2.12 Thuật ngữ, phê duyệt, lịch sử phiên bản
Bảng từ ngữ nghiệp vụ (ví dụ "phép năm", "phép ốm", "ngày làm việc"), danh sách người ký, bảng lịch sử thay đổi.

## 3. Lỗi thường gặp

| Lỗi | Ví dụ | Hậu quả |
|-----|-------|---------|
| Viết giải pháp thay vì nhu cầu | "Cần một ứng dụng web có dashboard" | Khóa giải pháp quá sớm, bỏ qua phương án rẻ hơn |
| Mục tiêu không đo được | "Cải thiện trải nghiệm" | Không biết dự án thành công hay không |
| Thiếu baseline | "Giảm thời gian duyệt 50%" — 50% của bao nhiêu? | Không chứng minh được hiệu quả |
| Không có "ngoài phạm vi" | — | Phạm vi phình to, trễ hạn |
| Thiếu bên liên quan quan trọng | Quên Pháp chế khi xử lý dữ liệu sức khỏe | Bị chặn lúc release |
| **(Agent)** Bịa số liệu hiện trạng | "Theo khảo sát, 78% nhân viên không hài lòng" — không có khảo sát nào | Quyết định dựa trên số giả |
| **(Agent)** Thêm yêu cầu không ai đưa ra | Tự thêm "BR-07 Tích hợp chatbot AI" | Mở rộng phạm vi |
| **(Agent)** Văn phong chung chung, đúng với mọi dự án | "Hệ thống phải thân thiện, hiện đại, bảo mật" | BRD không có giá trị quyết định |

## 4. Giao việc cho agent viết BRD

- Đưa vào: biên bản phỏng vấn, số liệu thật, mẫu [brd-template.md](../04-mau/brd-template.md).
- Yêu cầu rõ: *"Mọi số liệu phải trích từ tài liệu tôi đưa, ghi nguồn sau mỗi số. Nếu thiếu số liệu, ghi `[CẦN XÁC NHẬN: …]`, không được tự điền."*
- Yêu cầu agent liệt kê ở cuối: các giả định nó đã tự đặt ra, các câu hỏi mở.

## Checklist phê duyệt

Trả lời **Có / Không**. Mọi câu "Không" phải có lý do được chấp nhận hoặc phải sửa trước khi duyệt.

| # | Câu hỏi | Có/Không |
|---|---------|:-------:|
| 1 | Vấn đề được mô tả bằng số liệu thật, có nguồn (ai đo, đo khi nào)? | |
| 2 | Người dùng nghiệp vụ đọc mục Vấn đề và xác nhận "đúng là thế"? | |
| 3 | Mỗi mục tiêu đạt đủ 5 tiêu chí SMART, có baseline? | |
| 4 | Có mục "Ngoài phạm vi" và nó loại trừ được các mong muốn dễ phát sinh? | |
| 5 | Mỗi BR là nhu cầu nghiệp vụ, không phải giải pháp kỹ thuật? | |
| 6 | Mỗi BR có ID duy nhất, ưu tiên, nguồn (người yêu cầu)? | |
| 7 | Mỗi BR liên kết được với ít nhất một mục tiêu? (Không có BR "mồ côi") | |
| 8 | Mỗi KPI có cách đo, nguồn dữ liệu, thời điểm đo? | |
| 9 | Đủ bên liên quan, kể cả Pháp chế/Bảo mật/IT khi có dữ liệu cá nhân? | |
| 10 | Giả định, ràng buộc, rủi ro, phụ thuộc được ghi và có người theo dõi? | |
| 11 | Không còn mục `[CẦN XÁC NHẬN]` nào chưa xử lý (hoặc được chấp nhận có điều kiện)? | |
| 12 | Có lịch sử phiên bản và đúng phiên bản đang được duyệt? | |

## Dấu hiệu phải từ chối (red flags)

- Có con số hiện trạng **không có nguồn** hoặc nguồn không kiểm chứng được → nghi agent bịa.
- BRD mô tả màn hình, công nghệ, cơ sở dữ liệu — đã nhảy sang giải pháp.
- Không có mục tiêu đo được, hoặc mục tiêu không gắn với vấn đề đã nêu.
- Không có "Ngoài phạm vi".
- Có BR mà không ai trong danh sách bên liên quan yêu cầu.
- Người dùng nghiệp vụ chưa đọc, chỉ có team kỹ thuật duyệt.
- Có dữ liệu cá nhân/nhạy cảm nhưng không có yêu cầu bảo vệ dữ liệu và không có Pháp chế trong stakeholder.
- Văn bản chung chung tới mức thay tên dự án khác vào vẫn đúng.
