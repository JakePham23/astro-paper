---
title: "Checklist phê duyệt tổng hợp — các cổng G0 đến G8"
description: "Đây là tài liệu người phê duyệt mở mỗi khi agent nộp một sản phẩm. Nó tổng hợp mọi cổng: cần gì để vào, phải ra cái gì, ai duyệt, câu hỏi bắt buộc, và dấu hiệu phải từ chối."
pubDatetime: 2026-11-19T18:00:00Z
featured: true
tags:
  - sdlc
  - quy-trinh-phan-mem
  - checklist
---
# Checklist phê duyệt tổng hợp — các cổng G0 đến G8

**Mục đích:** Đây là tài liệu người phê duyệt mở mỗi khi agent nộp một sản phẩm. Nó tổng hợp mọi cổng: cần gì để vào, phải ra cái gì, ai duyệt, câu hỏi bắt buộc, và dấu hiệu phải từ chối.
Phần 1 là các quy tắc chung áp dụng cho **mọi** cổng khi sản phẩm do agent làm. Đọc phần đó trước.

**Liên quan:** [00-tong-quan.md](00-tong-quan.md) · [01-brd.md](01-brd.md) · [02-yeu-cau-srs-prd.md](02-yeu-cau-srs-prd.md) · [03-thiet-ke.md](03-thiet-ke.md) · [04-lap-ke-hoach.md](04-lap-ke-hoach.md) · [05-phat-trien.md](05-phat-trien.md) · [06-code-review.md](06-code-review.md) · [07-kiem-thu.md](07-kiem-thu.md) · [08-release.md](08-release.md) · [Biên bản phê duyệt](../04-mau/approval-record-template.md) · [Áp dụng với agent](../03-ap-dung-voi-agent/README.md)

---

## 1. Quy tắc chung khi duyệt sản phẩm của agent

### 1.1 Mười quy tắc

1. **Bạn chịu trách nhiệm, không phải agent.** Ký duyệt = bạn xác nhận như thể chính bạn làm ra. Nếu không thể giải thích sản phẩm cho người khác, đừng ký.
2. **Đòi bằng chứng, không nhận lời khẳng định.** "Đã test", "đã kiểm tra", "tương thích", "an toàn" chỉ có giá trị khi kèm output lệnh, link CI, SHA commit, ảnh chụp, hoặc trích dẫn nguồn.
3. **Không chấp nhận "chắc là đúng".** Các cụm "có lẽ", "nên hoạt động", "thường thì", "should work" trong báo cáo của agent nghĩa là **chưa kiểm**. Yêu cầu kiểm hoặc ghi rõ là rủi ro chưa kiểm.
4. **Kiểm tra lệnh đã chạy thật.** Đối chiếu: lệnh nào, trên commit nào, môi trường nào, kết quả đầy đủ (số pass/fail/skip). Một con số tròn trịa không kèm output là đáng ngờ.
5. **So với yêu cầu gốc, không so với bản tóm tắt của agent.** Mở BRD/SRS/task gốc và đối chiếu từng mục. Agent tóm tắt việc nó làm theo cách có lợi cho nó — thường bỏ qua phần chưa làm.
6. **Tìm thứ bị thiếu, không chỉ thứ có mặt.** Hỏi: yêu cầu nào không được nhắc tới? Trường hợp lỗi nào không có? Phần nào agent im lặng?
7. **Xem phần bị xóa và phần ngoài phạm vi.** Dòng bị xóa, test bị skip, file ngoài phạm vi, cấu hình bị đổi là nơi lỗi nghiêm trọng hay ẩn.
8. **Mọi con số và sự kiện phải có nguồn.** Số liệu hiện trạng, tên thư viện, phiên bản, điều luật — kiểm tra ít nhất một cái ngẫu nhiên. Nếu một cái sai, nghi cả tài liệu.
9. **Duyệt đúng phiên bản.** Ghi phiên bản tài liệu / SHA commit vào biên bản. Agent có thể sửa tiếp sau khi bạn đọc; phê duyệt chỉ áp dụng cho phiên bản đã ghi.
10. **Từ chối là bình thường.** Agent làm lại rất rẻ. Duyệt một sản phẩm sai thì đắt. Khi nghi ngờ, chọn "Approve with conditions" hoặc "Reject" kèm lý do cụ thể.

### 1.2 Câu hỏi chuẩn hỏi agent trước khi duyệt

Gửi cho agent (hoặc yêu cầu agent tự trả lời trong báo cáo):

```text
Trước khi tôi duyệt, trả lời từng câu, mỗi câu kèm bằng chứng (lệnh + output, đường dẫn file:dòng, hoặc nguồn):
1. Liệt kê từng yêu cầu/AC được giao và trạng thái: Đã làm + bằng chứng / Chưa làm / Làm một phần.
2. Những gì bạn đã tự giả định mà không có trong yêu cầu?
3. Những gì bạn KHÔNG kiểm tra được và vì sao?
4. File nào bạn đã sửa ngoài phạm vi được giao? Vì sao?
5. Test nào bạn đã sửa, xóa hoặc skip? Vì sao?
6. Các lệnh bạn đã chạy và kết quả nguyên văn (pass/fail/skip).
7. Rủi ro lớn nhất còn lại là gì?
```

Nếu agent trả lời "không có" cho câu 2, 3, 7 với sản phẩm không nhỏ — hỏi lại; câu trả lời đó hiếm khi đúng.

### 1.3 Ba quyết định

| Quyết định | Khi nào | Ghi gì |
|-----------|---------|--------|
| **Approve** | Mọi câu bắt buộc "Có", không red flag | Phiên bản/SHA, bằng chứng đã xem |
| **Approve with conditions** | Còn điểm nhỏ không chặn giai đoạn sau; có người và hạn xử lý | Điều kiện cụ thể, người chịu trách nhiệm, hạn, khi nào kiểm lại |
| **Reject** | Có red flag, hoặc câu bắt buộc "Không" không có lý do chấp nhận | Lý do cụ thể, cần sửa gì để nộp lại |

Ghi bằng [mẫu biên bản phê duyệt](../04-mau/approval-record-template.md).

### 1.4 Mức độ kiểm tra theo rủi ro

Không phải thay đổi nào cũng cần kiểm tra sâu như nhau.

| Rủi ro | Ví dụ | Mức kiểm |
|--------|-------|----------|
| Thấp | Sửa chính tả tài liệu, đổi màu nút | Đọc diff, CI pass |
| Trung bình | Thêm API đọc dữ liệu, sửa logic hiển thị | Checklist đầy đủ của cổng |
| Cao | Tiền, số dư, phân quyền, dữ liệu cá nhân, migration DB, xác thực, hạ tầng | Checklist + chạy thử bằng tay + reviewer thứ hai + (khuyến nghị) review độc lập bằng một agent khác không biết kết luận của agent đầu |

## 2. Bảng tổng hợp các cổng

| Gate | Đầu vào (phải có trước) | Đầu ra (sản phẩm được duyệt) | Người duyệt (A) | Người được hỏi (C) |
|------|-------------------------|-------------------------------|-----------------|---------------------|
| **G0** Khởi động | Mô tả nhu cầu, ước tính lợi ích/chi phí sơ bộ | Quyết định làm/không làm, sponsor, PO | Sponsor | PO, IT |
| **G1** BRD | Kết quả phỏng vấn, số liệu hiện trạng | BRD có phiên bản | Sponsor + đại diện nghiệp vụ | PO, Pháp chế, IT |
| **G2** Yêu cầu | BRD đã duyệt | SRS/PRD: FR, NFR, story + AC, ma trận truy vết BR→FR | PO | BA, Architect, QA, nghiệp vụ |
| **G3** Thiết kế | SRS đã duyệt | HLD, LLD, ADR, API contract, threat model | Architect / Tech lead | Dev, Security, Vận hành |
| **G4** Kế hoạch | Thiết kế đã duyệt | WBS, task có AC và phạm vi, ước lượng, phụ thuộc, rủi ro | PO + Tech lead | Dev, QA |
| **G5** Merge | Task đạt DoR | PR: code + test + mô tả, CI pass, review | Reviewer (người) | Agent review vòng 1 |
| **G6** Test exit | Build trên staging, test plan đã duyệt | Báo cáo test, danh sách lỗi mở, truy vết FR→TC→kết quả | QA lead | PO, Dev lead |
| **G7** UAT | G6 Approve | Biên bản UAT | PO + đại diện nghiệp vụ | QA |
| **G8** Go/No-go | G6, G7 Approve | Release checklist, release note, kế hoạch rollback | Release manager + Sponsor/PO | Vận hành, Security |

## 3. Chi tiết từng cổng

### G0 — Khởi động

**Câu hỏi bắt buộc**
1. Vấn đề có thật và có số liệu ban đầu không?
2. Ai tài trợ, ai là PO?
3. Có giải pháp rẻ hơn không cần phần mềm mới (đổi quy trình, dùng công cụ sẵn có)?
4. Có ràng buộc pháp lý, bảo mật nào cần biết ngay?

**Red flags:** "Làm vì công nghệ mới hay"; không ai sở hữu nghiệp vụ; không có số liệu nào.

### G1 — BRD

**Câu hỏi bắt buộc** (chi tiết: [01-brd.md](01-brd.md#checklist-phê-duyệt))
1. Số liệu hiện trạng có nguồn kiểm chứng được?
2. Mục tiêu SMART, có baseline?
3. Có phạm vi trong **và ngoài**?
4. BR là nhu cầu, không phải giải pháp; mỗi BR có người yêu cầu?
5. Người dùng nghiệp vụ đã đọc và xác nhận?

**Red flags:** số liệu không nguồn; BR không ai yêu cầu; không có ngoài phạm vi; văn bản chung chung.

### G2 — Yêu cầu (SRS/PRD)

**Câu hỏi bắt buộc** (chi tiết: [02-yeu-cau-srs-prd.md](02-yeu-cau-srs-prd.md#checklist-phê-duyệt))
1. Mọi FR truy vết về BR; mọi BR Must có FR?
2. Mọi NFR có con số và cách đo?
3. Mọi story có AC Given/When/Then gồm cả lỗi, biên, phân quyền?
4. Quy tắc nghiệp vụ có nguồn từ người nghiệp vụ?
5. Ưu tiên MoSCoW thực sự, có Won't?

**Red flags:** FR mồ côi; "nhanh/dễ/an toàn" không số; quy tắc nghiệp vụ bịa; chỉ happy path.

### G3 — Thiết kế

**Câu hỏi bắt buộc** (chi tiết: [03-thiet-ke.md](03-thiet-ke.md#checklist-phê-duyệt))
1. FR/NFR Must đều ánh xạ vào thiết kế?
2. Quyết định lớn có ADR với ≥ 2 phương án?
3. Có xử lý lỗi, concurrency, phân quyền theo bản ghi, threat model?
4. Thư viện/API được nhắc tới có thật ở đúng phiên bản?
5. Độ phức tạp tương xứng quy mô?

**Red flags:** không phương án thay thế; hạ tầng mới không NFR nào đòi; bảo mật một dòng; thư viện không tìm thấy.

### G4 — Kế hoạch

**Câu hỏi bắt buộc** (chi tiết: [04-lap-ke-hoach.md](04-lap-ke-hoach.md#checklist-phê-duyệt))
1. Mỗi task nhỏ, có AC, có phạm vi file được/không được sửa?
2. Task song song không sửa cùng file?
3. Có task cho test, migration, tài liệu, release?
4. Ước lượng tính cả thời gian người review?

**Red flags:** task "làm backend"; chỉ có task code; tiêu chí hoàn thành là "agent báo xong".

### G5 — Merge PR

**Câu hỏi bắt buộc** (chi tiết: [05-phat-trien.md](05-phat-trien.md#checklist-phê-duyệt), [06-code-review.md](06-code-review.md#checklist-phê-duyệt))
1. Diff nằm trong phạm vi task (`git diff --stat`)?
2. Mỗi AC có test; test thực sự fail khi code sai?
3. Không test nào bị xóa/skip/nới kỳ vọng mà không lý do?
4. CI pass trên commit cuối?
5. Không bí mật, không tắt hook/lint, không dependency lạ?
6. Reviewer hiểu toàn bộ code?

**Red flags:** test bị sửa cho pass; `--no-verify`; "đã test" không log; file ngoài phạm vi; PR quá lớn.

### G6 — Test exit

**Câu hỏi bắt buộc** (chi tiết: [07-kiem-thu.md](07-kiem-thu.md#checklist-phê-duyệt))
1. Mọi FR/NFR Must có test case và đã chạy trên build xác định?
2. 0 lỗi Critical/High mở?
3. Test phân quyền, dữ liệu nhạy cảm, hiệu năng có kết quả thật?
4. Tiêu chí ra không bị đổi sau khi có kết quả?

**Red flags:** skip tăng không giải thích; hạ mức lỗi trước release; test tải trên máy dev.

### G7 — UAT

**Câu hỏi bắt buộc**
1. Người dùng nghiệp vụ thật chạy kịch bản, bao phủ BR Must?
2. Dữ liệu giống thật đã ẩn danh?
3. Có biên bản ký?

**Red flags:** đội dev/agent làm UAT thay người dùng; "người dùng sẽ ký sau".

### G8 — Go/No-go

**Câu hỏi bắt buộc** (chi tiết: [08-release.md](08-release.md#checklist-phê-duyệt))
1. Artefact phát hành là artefact đã test?
2. Rollback có điều kiện, người quyết, các bước, thời gian, đã diễn tập?
3. Migration tương thích ngược; có backup kiểm tra được?
4. Smoke test, giám sát, người trực sẵn sàng?
5. Lỗi mở và rủi ro được người có thẩm quyền chấp nhận?

**Red flags:** không rollback; build lại sau test; migration phá vỡ; deploy trước nghỉ lễ không người trực.

## 4. Gộp cổng cho thay đổi nhỏ

| Loại thay đổi | Cổng có thể gộp | Cổng không được bỏ |
|---------------|-----------------|--------------------|
| Sửa lỗi nhỏ (bug fix) | G1–G4 gộp thành ticket lỗi có AC | G5, G6 (hồi quy), G8 rút gọn |
| Tính năng nhỏ trong phạm vi BRD đã duyệt | G1 không cần lại; G2–G4 gộp trong một ticket | G5, G6, G8 |
| Hotfix khẩn | G2–G4 gộp, G6 rút gọn | G5 (review vẫn bắt buộc), G8, post-mortem |
| Chỉ tài liệu | Chỉ G5 | G5 |

Luôn ghi các cổng đã gộp vào biên bản.

## Checklist phê duyệt

Câu hỏi chung trước khi ký **bất kỳ** cổng nào:

| # | Câu hỏi | Có/Không |
|---|---------|:-------:|
| 1 | Tôi đã mở và đối chiếu với tài liệu/yêu cầu gốc, không chỉ bản tóm tắt của agent? | |
| 2 | Mọi khẳng định quan trọng có bằng chứng (output, CI, SHA, nguồn)? | |
| 3 | Tôi đã kiểm ngẫu nhiên ít nhất một số liệu/tên thư viện/trích dẫn? | |
| 4 | Agent đã liệt kê giả định, điều chưa kiểm, và rủi ro còn lại? | |
| 5 | Không có thay đổi/nội dung ngoài phạm vi chưa được chấp thuận? | |
| 6 | Tôi hiểu sản phẩm đủ để giải thích cho người khác? | |
| 7 | Phiên bản/SHA đang duyệt được ghi vào biên bản? | |
| 8 | Checklist riêng của cổng này đã hoàn thành? | |

## Dấu hiệu phải từ chối (red flags)

Chung cho mọi cổng:

- Khẳng định không bằng chứng: "đã kiểm tra kỹ", "hoạt động tốt", "tuân thủ đầy đủ".
- Ngôn ngữ phỏng đoán trong kết quả: "có lẽ", "nên chạy được", "về cơ bản là xong".
- Báo cáo của agent không nhắc tới một yêu cầu nào đó trong tài liệu gốc (thường là phần chưa làm).
- Số liệu, tên thư viện, điều luật, trích dẫn không tìm thấy khi kiểm tra.
- Sản phẩm thay đổi sau khi bạn đã đọc nhưng trước khi bạn ký.
- Agent tự đánh dấu "Approved", tự merge, tự tag, hoặc tự sửa trạng thái phê duyệt.
- Bị hối thúc ký "cho kịp" mà không đủ thời gian đọc.
- Bạn không hiểu sản phẩm và không ai giải thích được.
