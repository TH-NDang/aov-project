# Quy ước viết

Cách viết chung cho nội dung kho của Wiki (trang bị, ngọc, phù hiệu, phụ trợ, thuật ngữ, ghi chú cập nhật) và cho chữ
trên giao diện của Admin, Wiki và Stream. Mục tiêu: một khái niệm chỉ có một cách gọi, một loại thông tin chỉ có một
cách ghi. Ví dụ "đúng" và "sai" đều lấy từ dữ liệu và mã của dự án tại ngày 13/11/2026.

Hai tài liệu đi cùng:

- Kho thuật ngữ trong Admin (mục "Thuật ngữ & tham chiếu", [ADR-011](../../backend/docs/adr/ADR-011-shared-terminology.md))
  giữ tên chuẩn và tên gọi khác của từng thuật ngữ để Wiki nhận ra khi hiển thị. Tên chuẩn ở đó và ở mục 2 dưới đây
  phải trùng nhau; cách gọi không chuẩn chỉ được nằm ở ô "tên gọi khác".
- [Bảng thuật ngữ Việt–Anh](THUAT-NGU-VIET-ANH.md) lấy cột tiếng Việt từ tài liệu này.

## 1. Chữ nào theo quy ước, chữ nào giữ nguyên

| Loại chữ | Cách xử lý |
|---|---|
| Chữ dự án tự viết hoặc biên tập: mô tả và tóm tắt của trang bị, ngọc, phù hiệu, phụ trợ, nhánh phù hiệu; tên mục; định nghĩa thuật ngữ; ghi chú cập nhật; chữ trên giao diện | Theo đúng quy ước này |
| Chữ chép nguyên văn từ game: mô tả và thẻ của kỹ năng tướng, nhãn bảng thông số theo cấp, mẹo chơi của tướng, tên trang phục, cẩm nang Cờ Liên Quân | Giữ như game viết, kể cả chỗ game viết không đều (`ST gốc`, `H.chiêu: 8s`, `(+100%Công vật lý)`). Chỉ sửa khi đối chiếu ảnh gốc thấy chép sai |
| Tên riêng trong game: tướng, kỹ năng, trang phục, trang bị, phù hiệu, phụ trợ, chế độ chơi | Giữ tên của game; chỉ chỉnh chính tả và viết hoa theo mục 2.4 và mục 6 |

Chính tả ở mục 2.4 áp dụng cho mọi loại chữ, vì đó là lỗi gõ chứ không phải cách diễn đạt.

## 2. Thuật ngữ chuẩn

### 2.1. Chỉ số và sát thương

| Dùng | Không dùng |
|---|---|
| Công vật lý, Công phép | Công VL, Công (đứng một mình trong tên ngọc) |
| Máu tối đa, Năng lượng tối đa | Máu, Năng lượng (khi là tên chỉ số) |
| Giáp, Giáp phép | Thủ phép, Kháng phép |
| Tốc đánh, Tốc chạy | Tốc độ đánh, Tốc độ di chuyển, tốc độ chạy |
| Giảm hồi chiêu | Hồi chiêu (khi là tên chỉ số) |
| Tỷ lệ chí mạng, Sát thương chí mạng | Tỉ lệ chí mạng, Chí mạng (khi là tên chỉ số) |
| Hút máu, Hút máu phép | Hút phép |
| Xuyên giáp, Xuyên giáp phép | Xuyên thủ phép |
| Hồi máu/5s, Hồi năng lượng/5s | Hồi máu mỗi 5 giây (khi là tên chỉ số) |
| Kháng hiệu ứng | |
| sát thương vật lý, sát thương phép, sát thương chuẩn | ST vật lý, ST phép, ST chuẩn, sát thương phép thuật |
| kinh nghiệm | EXP |
| hồi chiêu (thời gian chờ của một hiệu ứng) | CD, thời gian hồi chiêu |

`ST` chỉ còn ở chữ chép nguyên văn từ game (thẻ kỹ năng, nhãn bảng thông số) và ở ô "tên gọi khác" của kho thuật ngữ.

Những cách nói lặp lại nhiều trong mô tả trang bị, phù hiệu và phụ trợ cũng chỉ có một cách viết:

| Dùng | Không dùng |
|---|---|
| mục tiêu | nạn nhân (trong chữ dự án biên tập) |
| tướng đánh gần, tướng đánh xa | tướng cận chiến |
| (chỉ hữu hiệu với tướng đánh xa), (chỉ hữu hiệu với tướng đánh gần) | (chỉ có tác dụng với tướng đánh xa), (chỉ hữu hiệu khi dùng bởi tướng đánh xa), (chỉ đánh gần) |
| (gấp đôi với tướng đánh xa) | (tăng gấp đôi với tướng đánh xa) |
| lá chắn | lớp bảo hộ, khiên chắn |
| Mỗi 45 giây dự trữ 1 lần, tối đa dự trữ 2 lần. | Lưu trữ mỗi 45 giây, tối đa lưu trữ 2 lần. |
| hạ hoặc phụ hạ | hạ hoặc phụ |

"Giải khống" và "miễn khống" là thuật ngữ của game (có trong thẻ kỹ năng), không phải chữ viết tắt; dùng được cả trong
tóm tắt.

### 2.2. Các mục của Wiki

| Dùng | Ghi chú |
|---|---|
| Tướng | |
| Kỹ năng | Tên mục. Trong câu viết theo game: chiêu 1, chiêu cuối, tung chiêu |
| Nội tại | Cả kỹ năng nội tại của tướng lẫn hiệu ứng nội tại của trang bị |
| Trang phục | Không dùng "skin" |
| Trang bị | Không dùng "item", "đồ" |
| Phù hiệu | |
| Bảng ngọc (tên mục), ngọc (một viên) | |
| Phụ trợ | Tên mục và tên gọi chung. Trong câu có thể viết "kỹ năng phụ trợ" như game. Không dùng "phép bổ trợ", "phép phụ trợ" |
| Chế độ chơi | |
| Thuật ngữ | |
| Bản cập nhật | Chữ cho người đọc. Trong Admin được gọi tắt là "patch" |
| Liên Quân Mobile, Cờ Liên Quân | "Quân" luôn viết hoa vì là tên game |

### 2.3. Thao tác biên tập

| Dùng | Nghĩa | Không dùng |
|---|---|---|
| bản nháp | Nội dung đang sửa, người đọc chưa thấy | draft |
| xuất bản | Đưa nội dung lên trang công khai: thao tác trong Admin và cách nói với người đọc | publish, công bố |
| ngừng xuất bản | Gỡ nội dung khỏi trang công khai | gỡ công bố, thu hồi công bố |
| công bố | Chỉ khi nhà phát hành hoặc ban tổ chức thông báo một thông tin: trạng thái giải "Đã công bố", "nguồn công bố" của bản cập nhật | (không dùng cho việc đưa nội dung lên trang) |
| phát hành | Game ra một bản cập nhật ở một thị trường | |
| phiên bản | Một bản nội dung đã lưu của một mục | (không dùng thay cho "bản cập nhật") |
| nhập | Đưa dữ liệu từ tệp vào hệ thống | import |
| tải lên | Đưa tệp từ máy lên kho | upload |
| tệp | | file |
| liên kết | Địa chỉ web, và việc gắn hai mục với nhau | link |
| biểu tượng | | icon |
| ảnh đại diện | | avatar |
| ghi công | Ghi tên người hoặc đơn vị giữ quyền của ảnh | credit |
| tên gọi khác | | alias |
| bộ quy tắc | | ruleset |
| máy chủ | | backend |
| bản lưu đệm | | cache |
| cửa hàng | Cửa hàng trang bị trong trận | shop |
| dòng thời gian | | timeline |

Từ tiếng Anh được giữ vì người chơi Việt dùng hằng ngày hoặc chưa có từ Việt gọn hơn: patch (chỉ trong Admin), build,
video, logo, tab, menu, email, stream, livestream, meta, BO3/BO5, tên định dạng tệp (JSON, CSV, ZIP, PNG), URL khi nói
về định dạng địa chỉ. Ba loại ảnh Portrait, Head và Cover trong "Không gian ảnh" của Admin là tên kỹ thuật của dự án.

Ngày 15/11/2026 chọn "xuất bản" cho việc đưa nội dung lên trang. Admin đã đổi ở phần hồ sơ cộng đồng và video; phần giải
đấu của Admin, Wiki và Stream còn "công bố" theo nghĩa này, danh sách chỗ cần đổi nằm trong ghi chú bàn giao.

### 2.4. Chính tả

| Dùng | Không dùng | Lý do |
|---|---|---|
| tỷ lệ, tỷ số | tỉ lệ, tỉ số | Game viết "Tỷ lệ chí mạng" |
| kỹ năng, vật lý, quý | kĩ năng, vật lí, quí | Theo game và phần lớn dữ liệu |
| hóa, hỏa, thủy, hủy, tùy, lũy, xóa, khóa | hoá, hoả, thuỷ, huỷ, tuỳ, luỹ, xoá, khoá | 802 chỗ trong dữ liệu và giao diện đặt dấu kiểu này, chỉ 47 chỗ đặt kiểu kia |

Chữ có dấu phải ở dạng dựng sẵn (Unicode NFC). 14 tên trang phục đang lưu ở dạng tổ hợp: nhìn giống hệt nhưng tìm kiếm
không ra.

## 3. Con số và đơn vị

| Quy ước | Đúng | Sai |
|---|---|---|
| Số liệu trong game viết như game: không tách hàng nghìn, thập phân dùng dấu chấm | `1200 máu`, `0.35 giây` | `1.200 máu`, `0,35 giây` |
| Phần trăm viết liền số | `16%` | `16 %` |
| "giây", "phút" viết đủ chữ, cách số một khoảng trắng | `3 giây` | `3s`, `3giây` |
| `/5s` chỉ có trong tên hai chỉ số hồi phục | `+30 Hồi máu/5s` | `hồi 20 máu mỗi 5s` |
| Mét viết liền số | `5m`, `2.5m` | `4 m`, `8 mét` |
| Khoảng giá trị dùng gạch nối dài, không cách | `140–280`, `5%–10%` | `140 – 280`, `32 - 60`, `45-87`, `1~4` |
| Phần cộng thêm theo chỉ số đặt trong ngoặc, có dấu cộng, một khoảng trắng sau số | `100 (+30% công vật lý)` | `(+25%công vật lý thêm)`, `(+ 100% công phép)` |
| Phần tăng theo cấp | `(+5 mỗi cấp tướng)` | `(+5 / cấp tướng)`, `(+ mỗi cấp tướng*8)`, `28+2* cấp tướng` |
| Phép cộng trong câu có khoảng trắng hai bên dấu cộng | `(30% công vật lý + 80% công phép)` | `(30% công vật lý+80% công phép)` |
| Hồi chiêu là câu cuối của hiệu ứng | `Hồi chiêu: 60 giây.` | `60 giây hồi chiêu`, `0.65 giây hồi`, `Thời gian hồi chiêu: 60 giây`, `hồi chiêu 120s` |

Dòng chi tiết của đặc điểm tướng và nhận định của biên tập viên (ADR-029) cũng viết số theo bảng trên:
`Hào hoa (choáng 0.75 giây)`, không viết `0,75 giây`.

**Thời gian trong câu.** Mỗi số giây chỉ được đọc theo một cách. Trước khi viết, xác định nó thuộc loại nào:

| Loại | Đúng | Sai |
|---|---|---|
| Khoảng thời gian để làm gì đó: "có N giây để …" | `Sau khi tung chiêu, có 5 giây để đòn đánh thường tiếp theo gây thêm …` | `Trong vòng 5 giây sau khi tung chiêu, đòn đánh thường tiếp theo …`, `có thể dùng lần 2 trong vòng 5 giây` |
| Thời gian hiệu lực: ngay sau hiệu ứng, hoặc mở đầu câu | `hồi tổng cộng 400–610 máu trong 5 giây`, `giảm 20% sát thương hắn gây ra, kéo dài 3 giây` | `trong 5 giây sẽ hồi tổng cộng 400–610 máu`, `giảm 20% sát thương hắn gây ra trong 3 giây` (thời gian bám vào "gây ra") |
| Thời gian chờ: "mỗi N giây … một lần" hoặc `Hồi chiêu: N giây.` | `Mỗi 15 giây trị liệu một lần` | `15 giây mới trị liệu lại` |
| Thời gian cộng thêm có chữ "thêm" | `kéo dài hút máu phép thêm 3 giây` | `kéo dài hút máu phép 3 giây` |

Không dùng "trong vòng N giây": người đọc dễ hiểu thành phải chờ N giây. Tóm tắt kỹ năng tướng theo cùng quy tắc này.

Tiền thật, ngày giờ và số liệu thống kê lớn không theo bảng này: giao diện hiển thị chúng theo lựa chọn của người đọc
(`LocalMoney`, `LocalTime`).

## 4. Trang bị

Mô tả của một trang bị gồm ba phần, cách nhau một dòng trống:

```text
+100 Công vật lý
+10% Giảm hồi chiêu
+500 Máu tối đa

Kích hoạt duy nhất – Bất khuất: Nhận 35% miễn thương trong 3 giây, có thể dùng khi bị khống chế. Hồi chiêu: 90 giây.

Nội tại duy nhất – Trì trệ: Tung chiêu trúng sẽ làm chậm tướng địch đầu tiên 30% và giảm 20% sát thương hắn gây ra, kéo dài 3 giây. Hồi chiêu: 8 giây.

(Lời dẫn của trang bị, nếu có.)
```

**Dòng chỉ số.** Mỗi chỉ số một dòng: dấu cộng liền số, rồi tên chỉ số theo mục 2.1, viết hoa chữ đầu, không có dấu
chấm.

| Đúng | Sai |
|---|---|
| `+600 Máu tối đa` | `+ 600 Máu tối đa`, `+600 Máu tối đâ`, `+1500 máu tối đa` |
| `+10 Công vật lý` | `10 Công vật lý` |
| `+5% Giảm hồi chiêu` | `+5% Giảm Hồi chiêu`, `+10% giảm hồi chiêu` |

**Dòng hiệu ứng.** Mỗi hiệu ứng một đoạn, viết trên một dòng, theo khuôn `Nhãn – Tên: mô tả.`

- Nhãn đứng đầu và là một trong bốn chữ: `Nội tại`, `Nội tại duy nhất`, `Kích hoạt`, `Kích hoạt duy nhất`. "Duy nhất"
  nghĩa là nhiều món cùng hiệu ứng này không cộng dồn. Không viết "Kích hoạt chủ động": đã kích hoạt thì là chủ động.
- Giữa nhãn và tên là gạch nối dài có khoảng trắng hai bên (` – `). Sau tên là dấu hai chấm.
- Tên hiệu ứng viết hoa chữ đầu, các chữ sau viết thường trừ tên riêng: `Đông băng`, `Sức mạnh nguyên tố`.
- Hiệu ứng không có tên thì bỏ phần tên: `Nội tại duy nhất: Giảm 10% sát thương vật lý phải chịu.`
- Hiệu ứng chỉ cộng một chỉ số thì viết chỉ số như một dòng chỉ số, không có dấu chấm:
  `Nội tại duy nhất – Gia tốc: +60 Tốc chạy`.
- Trong câu mô tả, tên chỉ số viết thường: `tăng 10% tốc chạy`, `8% máu hiện tại`.
- Hồi chiêu là câu cuối: `Hồi chiêu: 3 giây.` Hồi chiêu của riêng một phần trong hiệu ứng thì để trong ngoặc ngay
  sau phần đó.
- Điều kiện kèm theo để trong ngoặc trước dấu chấm: `(chỉ hữu hiệu với tướng đánh xa).`

| Đúng | Sai (đang có trong dữ liệu) |
|---|---|
| `Kích hoạt duy nhất – Hấp huyết: Tăng 60% hút máu trong 3 giây (chỉ hữu hiệu với tướng đánh xa). Hồi chiêu: 60 giây.` | `Hấp huyết: tăng 60% hút máu trong 3 giây; 60 giây hồi chiêu (chỉ hữu hiệu với tướng đánh xa) – Kích hoạt duy nhất` |
| `Kích hoạt – Thần khiên: Lập tức tạo 1 lớp lá chắn … trong 3 giây. Hồi chiêu: 60 giây.` | `Thần khiên: Lập tức tạo 1 lớp lá chắn … Hồi chiêu 60 giây – Kích hoạt chủ động` |
| `Kích hoạt duy nhất – Bất khuất: Nhận 35% miễn thương … Hồi chiêu: 90 giây.` | `Nhận 35% miễn thương … Thời gian hồi chiêu: 90 giây. <Bất khuất>– Kích hoạt duy nhất` |
| `Nội tại duy nhất – Hiền giả: Mỗi giây hồi 1% năng lượng.` | `Mỗi giây hồi 1% năng lượng - Hiền giả - Nội tại duy nhất` |
| `Nội tại duy nhất – Gia tốc: +60 Tốc chạy` | `+60 Tốc chạy – Nội tại duy nhất: Gia tốc` |
| `Nội tại – Tưởng thưởng: Tăng 32–60 thuộc tính chủ đạo …` | `Nội tại - Tưởng thường: Tăng 32 - 60 thuộc tính chủ đạo …` |

**Lời dẫn.** Một dòng riêng ở cuối, nằm trọn trong ngoặc đơn, dấu chấm đứng trước ngoặc đóng:
`(Từ chối tử thần một lúc.)`

**Tóm tắt.** Cụm từ ngắn nói món này để làm gì: viết hoa chữ đầu, các ý cách nhau bằng dấu phẩy, không viết tắt.
Đúng: `Sát thương thêm, làm chậm`. Sai: `ST thêm, làm chậm`, `Chịu ST Tăng ST`, `Tốc đáng Làm chậm`.

Wiki đọc được cả cách ghi cũ lẫn cách ghi này (`packages/ui/src/lib/item-description.ts`, kiểm thử ở
`packages/ui/tests/item-description.test.mjs`), nên có thể sửa dần từng món.

## 5. Ngọc, phù hiệu, phụ trợ

**Ngọc.** Tên theo khuôn `Màu Cấp Chỉ số/Chỉ số`: màu viết hoa chữ đầu, cấp bằng số La Mã, tên chỉ số theo mục 2.1
(riêng "Hồi máu/5s" rút thành "Hồi máu" để không lẫn với dấu gạch chéo). Ba cấp của cùng một loại ngọc có tên giống
nhau, chỉ khác cấp. Mô tả liệt kê chỉ số theo đúng thứ tự trong tên, cách nhau bằng dấu chấm phẩy.

| Đúng | Sai |
|---|---|
| `Đỏ I Công phép/Tốc đánh` | `ĐỎ I CÔNG PHÉP/TỐC ĐÁNH` |
| `Đỏ II Tỷ lệ chí mạng` | `Đỏ II Tỉ lệ chí mạng1` |
| `Tím I Tốc đánh/Tốc chạy` | `Tím I Tốc đánh/chạy` |
| `Xanh I Hút máu phép/Giáp` | `Xanh I Hút phép/Giáp` |
| `Giáp +3.1; Giáp phép +3.1` | `Giáp +3.1; Giáp phép 3.1` |

**Phù hiệu và phụ trợ.** Mô tả là câu văn bình thường, có dấu chấm cuối câu, không xuống dòng giữa câu (dữ liệu hiện
bị ngắt theo khổ ảnh chụp). Hồi chiêu là câu cuối như trang bị. Tóm tắt viết như tóm tắt trang bị.

| Đúng | Sai |
|---|---|
| `Trở thành bất khả xâm phạm và bất động trong 1.5 giây. Hồi chiêu: 120 giây.` | `120 giây hồi chiêu: Trở thành bất⏎khả xâm phạm và bất động trong⏎1.5 giây.` |
| `Nhận được 12.5% kháng hiệu ứng.` | `Nhận được 12,5% kháng⏎hiệu ứng` |
| `gây 80 (+8 mỗi cấp tướng) (+30% công phép) sát thương phép` | `gây 80⏎(+ mỗi cấp tướng*8)(+30%⏎công phép) sát thương⏎phép` |

## 6. Viết hoa

- Tiêu đề, nhãn, nút, tên mục và tên hiệu ứng viết hoa chữ đầu của cả cụm, không viết hoa từng chữ, không viết hoa
  toàn bộ. Đúng: `Kho trang bị`, `Lịch phát hành`, `Trói buộc tinh thần`. Sai: `Trói Buộc Tinh Thần`, `ĐỎ I CÔNG PHÉP`.
- Tên riêng giữ chữ hoa của nó: `Gươm Loki`, `Phong ấn Uriel`, `Đường Caesar`, `Liên Quân Mobile`.
- Tên trang bị viết như một cụm thường có tên riêng: `Quỷ kiếm`, `Thánh kiếm`, `Kiếm Muramasa`. 109 trên 112 món đã
  viết như vậy.
- Tên chỉ số viết hoa chữ đầu khi đứng đầu dòng chỉ số hoặc làm nhãn; trong câu thì viết thường.
- Số người mỗi bên viết `5v5`, `3v3` với chữ v thường.
- Tên sản phẩm: `AOV WiKi`, `AOV Stream`, `AOV Admin`. Wiki đang có cả `AOV WiKi` lẫn `AOV Wiki`.

## 7. Dấu câu

- Gạch nối dài có khoảng trắng hai bên (` – `) tách nhãn với tên. Gạch nối dài không cách (`–`) cho khoảng giá trị.
  Gạch ngắn (`-`) chỉ dùng trong từ ghép và mã.
- Dấu hai chấm đứng liền chữ trước nó, sau nó một khoảng trắng.
- Dấu gạch chéo không có khoảng trắng hai bên: `Tung chiêu/đánh thường`, `xuyên giáp/xuyên giáp phép`.
- Không có khoảng trắng sau ngoặc mở và trước ngoặc đóng. Hai ngoặc liền nhau cách một khoảng trắng: `50 (+5 mỗi cấp
  tướng) (+15% công phép)`.
- Dấu ba chấm là một ký tự (`…`), dùng cho việc đang chạy: `Đang lưu…`. Không gõ ba dấu chấm rời.
- Trích tên nút hay tên mục thì dùng ngoặc kép cong: `Mở “Sửa đội hình” để xem chi tiết.`
- Viết "và", không viết "&", trừ khi là tên riêng hoặc tiêu đề có sẵn của game.
- Câu mô tả có dấu chấm cuối. Nhãn, nút, tiêu đề và dòng chỉ số thì không.

## 8. Giọng văn trên giao diện

- Gọi người dùng là "bạn". Câu ngắn, nói việc gì đã xảy ra rồi mới nói làm gì tiếp:
  `Ảnh vừa thay đổi. Kiểm tra thông tin mới và xác nhận lại trước khi xóa.`
- Nút là một động từ: `Lưu`, `Hủy`, `Xóa`, `Sửa`, `Thêm`, `Đóng`, `Thử lại`. Nút lưu bản nháp là `Lưu nháp`. Nút bỏ
  hết điều kiện lọc là `Xóa bộ lọc`; bỏ một điều kiện là `Bỏ lọc <tên>`.
- Việc đang chạy: `Đang tải…`, `Đang lưu…`. Việc đã xong: `Đã lưu.`
- Chỗ chưa có dữ liệu: `Chưa có …`. Với người đọc Wiki và Stream, nói thứ còn thiếu chứ không nói quy trình biên tập:
  `Chưa có bản cập nhật nào cho mùa này.` thay cho `Chưa có bản cập nhật được công bố cho mùa này.`
- Lỗi: `Không <làm gì> được <cái gì>` kèm cách xử lý, không dùng "thất bại", không đưa mã lỗi hay tên kỹ thuật ra
  trước: `Không đọc được tệp. Hãy dùng nút chọn thư mục hoặc tệp.`
- Không dùng tiếng Anh khi mục 2.3 đã có từ Việt.

## 9. Việc còn mở

- Wiki hiển thị số liệu có cấu trúc theo kiểu Việt (`+1.200`, `+0,5%`) trong khi mô tả viết theo game (`1200`, `0.5`).
  Nên cho thẻ chỉ số hiển thị như game.
- Ba phù hiệu Ma chú, Đấu khí và Luyện kim bị cắt giữa câu từ nguồn; cần chép lại từ game.
- Admin còn gọi "patch" ở 252 chỗ, "gameplay" ở 31 chỗ. Giữ "patch" như một từ nội bộ; "gameplay" nên đổi thành
  "lối chơi" hoặc "số liệu trận đấu" tùy câu.
