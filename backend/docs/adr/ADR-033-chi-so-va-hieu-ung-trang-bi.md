# ADR-033 — Chỉ số cố định và chỉ số từ hiệu ứng của trang bị

**Trạng thái:** Chấp nhận (người dùng duyệt ngày 20/11/2026)  
**Ngày:** 2026-11-20  
**Bổ sung:** mục Kho trang bị của `02-DATABASE-DU-AN.md` và `03-API-DU-AN.md`

## Bối cảnh

- Trang bị có `stats[{key,value,unit}]` trong jsonb `gameplay`, nhưng cả 114 món trên dev và VPS đều để rỗng. Wiki và
  Admin đọc chỉ số từ chữ trong mô tả: chỉ các dòng dạng "+N tên chỉ số".
- Nút "điền từ mô tả" của Admin ghi mã kiểu `physicalAttack` và đơn vị `PERCENT`/`POINT`. Backend chỉ nhận mã dạng
  `physical-attack`, nên lưu luôn bị từ chối. Ngọc đã dùng mã gạch nối và đơn vị `%` hoặc rỗng.
- Khoảng 70 câu nội tại hoặc kích hoạt cho thêm chỉ số nhưng không viết dạng "+N". Ví dụ Ma pháp trường bào: "Nhận
  32–60 (+3% máu bản thân thêm) xuyên giáp phép, tối đa không vượt quá 150 điểm". Bộ lọc "Xuyên giáp" bỏ sót món này.
- Các câu đó có nhiều dạng: tăng theo cấp tướng (32–60), mỗi lần cộng dồn (0.8% tốc đánh, tối đa 25 lần), tỷ lệ theo
  chỉ số khác (+50% công phép), có trần (không vượt quá 230), chỉ trong vài giây (60% hút máu trong 3 giây), cho cả
  đồng đội, hoặc gộp hai chỉ số ("song giáp" là giáp và giáp phép).
- Đoán những dạng này từ chữ rất mong manh và mỗi ngôn ngữ phải đoán lại.

## Quyết định

1. **"Chỉ số" chỉ là phần cố định** của món, đúng các dòng "+N" game ghi. Phần do hiệu ứng cho thêm là "chỉ số từ hiệu
   ứng": chi tiết món hiển thị riêng, ghi tên hiệu ứng, khoảng, trần, thời gian. Bộ lọc chỉ số tính cả phần này, nên
   lọc "Xuyên giáp" ra Ma pháp trường bào; thẻ món trong danh sách vẫn chỉ ghi chỉ số cố định.
2. **Một bộ mã chỉ số dùng chung**, `platform.CatalogStats`: mã gạch nối của Ngọc cộng các mã trang bị cần (`max-mana`,
   `mana-regen-per-five-seconds`, `tenacity`, `adaptive-attack` cho "thuộc tính chủ đạo", `attack-range`). Đơn vị là
   `%` hoặc rỗng (điểm). Trang bị chỉ nhận mã trong bộ này, cả ở `stats` lẫn ở hiệu ứng. Ngọc chưa đổi luật.
3. **Hiệu ứng có phần gameplay** trong jsonb `gameplay`, danh sách `effects`, theo đúng thứ tự mô tả viết các hiệu ứng:
   - `key`: mã của tên hiệu ứng theo tiếng Việt (`pha-phep`). Cùng tên là cùng cơ chế giữa các món.
   - `activation` `PASSIVE`/`ACTIVE`, `unique`, `cooldownSeconds`, `maxStacks`.
   - `grants[]`: chỉ số được cho thêm, gồm `stat`, `value`, `maxValue`, `unit`, `growth` (`LEVEL` tăng theo cấp tướng
     từ `value` lên `maxValue`; `STACK` là mỗi lần cộng dồn, tối đa `maxStacks` lần; để trống là cố định), `scalings[]`
     (`source`,`value`,`unit`: tỷ lệ theo chỉ số khác), `cap`, `durationSeconds` (để trống là luôn có khi mang món),
     `target` `SELF`/`TEAM`.
   - Chữ của hiệu ứng vẫn nằm trong mô tả của từng bản dịch; phần gameplay không chứa chữ. Wiki ghép hiệu ứng thứ n với
     hiệu ứng thứ n trong mô tả của ngôn ngữ đang đọc.
4. `effects` là gameplay: bản dịch không được đổi nó. Bổ sung dữ liệu cho món đã xuất bản đi qua bản sửa nội dung
   (`CONTENT_CORRECTION`), không tạo thay đổi gameplay của patch.
5. Không migration: revision cũ không có khóa này đọc ra danh sách rỗng. Backend cũ từ chối khóa lạ trong jsonb, nên
   triển khai backend mới trước khi ghi dữ liệu ở bất kỳ môi trường nào.

## Hệ quả

- Bộ lọc, chi tiết món và Admin đọc cùng một dữ liệu đã duyệt thay vì đoán chữ. Món chưa có dữ liệu vẫn đọc mô tả như cũ.
- Thêm một mã chỉ số mới cần sửa `CatalogStats` và phát hành backend.
- Thứ tự hiệu ứng trong mô tả của mọi bản dịch phải giống nhau. Admin đặt hàng hiệu ứng cạnh hiệu ứng đọc từ mô tả để
  người sửa thấy lệch.
- Sát thương, lá chắn và hồi máu của hiệu ứng chưa có cấu trúc; chỉ phần chỉ số được ghi.
