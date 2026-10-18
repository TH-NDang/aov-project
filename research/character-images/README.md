# Nhập không gian ảnh nhân vật

Script đọc `resources/Lien-Quan-v3/data/heroes.json`, ánh xạ chính xác mã tướng và `skinKey`
trong ruleset `aov-standard`. Không sửa file tài nguyên. Chỉ gọi API quản trị; bytes ảnh được
PUT trực tiếp tới presigned URL của object storage local, sau đó gọi complete.

```powershell
python research/character-images/import-images.py
python research/character-images/import-images.py --apply --hero airi
python research/character-images/import-images.py --apply
python research/character-images/import-images.py --verify
python -m unittest discover -s research/character-images -p "test_*.py"
```

Chế độ mặc định chỉ thống kê. `--backend`, `--keycloak`, `--ruleset`, `--hero` (lặp được) và
`--limit` giới hạn phạm vi. Backend, Keycloak và storage phải đang chạy. Endpoint chỉ chấp nhận
loopback HTTP. Dùng tài khoản local dev đã có quyền catalog/hero/media; có thể truyền
`WIKI_IMPORT_USERNAME` và `WIKI_IMPORT_PASSWORD` qua môi trường. Không ghi credentials hoặc
presigned URL vào báo cáo.

`--workers` mặc định 3 (1–8): chạy từng tướng độc lập, giới hạn tải đồng thời; checkpoint ghi
tuần tự và khóa theo đường dẫn/semantic để tránh tạo hai asset cho cùng file. Kết nối local
dùng IPv4 nhưng giữ Host gốc để không đổi chữ ký presigned URL và issuer của Keycloak.

- Giữ ảnh chính đang có; thêm tất cả head/portrait/cover, `listHead` và `portraitAlternates`.
  Nhãn giữ tên file, gồm `-1`, `-2`; không loại file khác tên vì bytes giống nhau.
  Các file cùng tên trong `variants/01`, `variants/02` có nhãn `-1`, `-2`; ghi chú Media vẫn
  giữ đường dẫn gốc chính xác. GIF không thuộc định dạng Media hỗ trợ: ghi rõ skippedImages,
  giữ lựa chọn đang có/ô chưa có ảnh, không tự chuyển ảnh động thành ảnh tĩnh.
- Ảnh tướng dùng semantic theo vai trò; mọi ảnh trang phục dùng HERO_SKIN_ART. Giữ các kỹ năng,
  bản dịch và nguồn đang có. Thiếu trang phục thì tạo từ mã/tên thực trong tài nguyên, không
  tự bổ sung mô tả.
- Chọn revision theo thứ tự gameplay rồi revisionNo. Snapshot đã xuất bản tạo bản nháp
  VISUAL_UPDATE kế thừa đúng mốc, không tự xuất bản. Có bản nháp ở mốc khác thì báo lỗi để
  tránh ghi đè ngữ cảnh. Bản nháp đang có được cập nhật bằng expectedDraftVersion.
- Icon nhãn từ bộ tài nguyên này được gắn vào **vi-VN**. Giữ nguyên các bản dịch/icon khác.
  Tên thư viện giữ nội dung của mã nguồn, gồm chữ “Bậc” ở các nhãn có tiền tố `bac-`;
  quản trị viên có thể chỉnh tên dịch. Không tự phân loại bậc/sự kiện. Kind chưa biết là UNKNOWN.
- `.local-state/` bị Git bỏ qua: checkpoint SHA-256/asset/upload ID, bản sao nội dung trước sửa,
  receipt và verification. Chạy lại `--apply` để tiếp tục, bỏ qua ảnh đã complete. Giữ thư mục
  này cho đúng backend đang dùng; khi đổi/reset DB cần lưu trữ riêng rồi bắt đầu checkpoint mới.
- `--verify` đối chiếu mọi tham chiếu và nhãn file trong snapshot đã chọn; bản đầy đủ còn kiểm
  tra icon vi-VN của danh mục nhãn đang dùng được. Đối chiếu backup đầu tiên để kiểm tra giữ ảnh
  chính, metadata/bản dịch trang phục và các phần gameplay không liên quan. Không thay đổi dữ
  liệu trong chế độ này. Trang phục thiếu tên ngắn giữ fullName có sẵn hoặc mã ổn định làm nhãn
  tạm của bản nháp, kèm nguồn UNVERIFIED và warning trong receipt để kiểm tra lại.

Script đọc file lần lượt và ghi checkpoint sau từng bước. Nếu một tướng lỗi, các tướng khác
vẫn được xử lý; receipt lưu lỗi theo mã. Chạy lại sau khi xử lý nguyên nhân. Nó không xóa asset
cũ hoặc hạ trạng thái nội dung đã xuất bản.

## Chuẩn hóa định danh

`rename-identifiers.py` lập kế hoạch trong `canonical-identifiers.json`; `--apply` đổi file và
tham chiếu dữ liệu. Script kiểm tra hash, đường dẫn trong package, xung đột và dùng hai pha
để không ghi đè file. Bản sao JSON/preview/note trước sửa nằm trong `.local-state/`.
Khóa dữ liệu và metadata Media đổi qua Flyway V019–V021, có alias theo ADR-010; không chạy SQL
trực tiếp để thay schema. Không sửa migration đã áp dụng; generator từ chối ghi đè file có sẵn.
V022 khôi phục chữ “Bậc” cho bảy tên nguồn đã bị rút gọn; giữ tên đã chỉnh riêng, bản dịch khác,
icon và mã liên kết hiện có. Kế hoạch đổi file hiện có 4.108 mục, gồm tám portrait tạm chưa khớp.

Importer đọc bảng alias đường dẫn để dùng tiếp checkpoint cũ. UUID/hash/storage object không
đổi; `--verify` nhận diện các thay đổi mã được duyệt khi so với backup, nhưng vẫn kiểm tra nội
dung, bản dịch và ảnh chính nguyên vẹn. Tên hiển thị nhãn suy ra từ mã nguồn chỉ phục vụ tổ chức
thư viện, không làm kind UNKNOWN thành RARITY/EVENT hay đánh dấu bản dịch đã kiểm chứng.
