# Nhập kho trang bị từ tài nguyên

`import-warehouse.py` đọc các file hiện có trong `resources/Lien-Quan-v3/data/`, chuyển sang hợp đồng backend và tải ảnh qua Media. Chương trình không sửa nguồn, không gửi ảnh qua backend và không tự xuất bản.

## Dữ liệu được nhập

| Mục | Số bản ghi | Ảnh |
|---|---:|---:|
| Trang bị | 112 | 112 |
| Phù hiệu | 31, thuộc 4 hệ | 31 biểu tượng + 4 biểu tượng hệ + 4 nền hệ |
| Ngọc | 88 | 88 |
| Phụ trợ | 14 | 16, gồm trạng thái và ảnh tham khảo |

Backend nhận 6 nhóm trang bị và 4 hệ phù hiệu trước khi nhận nội dung. Tất cả nội dung tạo thành bản nháp trong `aov-standard`, không gán vào patch theo ngày thu thập. Tên, mô tả, tóm tắt và nhãn chỉ số nằm trong bản dịch `vi-VN`; số liệu, vị trí và quan hệ nằm ngoài bản dịch.

Trang bị được tạo danh tính trước, sau đó mới ánh xạ 192 nguyên liệu sang UUID thật. Chỉ các công thức đã xác nhận được nhập thành quan hệ; `xa-nhat-cung` và `thuong-khung-kiem` giữ trạng thái chưa xác nhận. Giá chênh lệch nguyên liệu không bị coi là phí ghép đã được xác minh.

Ngọc `xanh-1-giap-phep` và `xanh-1-mau-hoi-chieu` chưa có chỉ số từ nguồn nên giữ trống. Hai trạng thái Trừng trị có ảnh riêng, mô tả riêng còn thiếu thì không tự lấy mô tả chung. Phụ trợ đã bị loại bỏ vẫn được lưu với trạng thái `REMOVED`. Nguồn ảnh tái tạo bằng AI của các hệ phù hiệu được giữ trong provenance.

## Chạy

Từ thư mục gốc dự án:

```powershell
python research/warehouse/import-warehouse.py
python -m unittest discover -s research/warehouse -p "test_*.py"
```

Lệnh đầu chỉ đọc và tạo bản xem trước tại `.local-state/preview.json`. Khi backend, Keycloak và object storage cục bộ đã chạy:

```powershell
python research/warehouse/import-warehouse.py --apply
python research/warehouse/import-warehouse.py --verify
```

Mặc định dùng backend `http://localhost:8080`, Keycloak `http://localhost:8081`, tối đa 3 ảnh tải đồng thời. Có thể giảm bằng `--workers 1`. Tài khoản nhập liệu dùng `WIKI_IMPORT_USERNAME` và `WIKI_IMPORT_PASSWORD` nếu đã thiết lập; nếu không thì dùng tài khoản phát triển trong cấu hình realm cục bộ, giống công cụ nhập ảnh nhân vật. Không ghi token hay mật khẩu ra checkpoint.

## Khôi phục và kiểm chứng

`.local-state/` bị Git bỏ qua. Checkpoint lưu UUID tài nguyên, upload chưa hoàn tất, SHA-256 nguồn và digest nội dung đã lưu. Chạy lại `--apply` sẽ dùng lại ảnh đã hoàn tất, thử hoàn tất upload còn dang dở và tiếp tục các bản nháp chưa xong. Khi ảnh nguồn đổi hoặc bản nháp đã có chỉnh sửa bên ngoài, chương trình dừng để tránh ghi đè.

`--verify` kiểm tra nội dung backend với checkpoint, kiểm tra mỗi asset còn hoạt động và đúng loại Media, đồng thời ghi `.local-state/verification.json`. Các ghi chú nguồn giữ nguyên bản ghi JSON gốc và chứng cứ thu thập; không suy ra thời điểm cập nhật game từ ngày thu thập.

Đã chạy nhập liệu và kiểm chứng trên backend cục bộ ngày 18/10/2026: 245 bản nháp, 255 asset hoạt động, 10 nhóm/hệ và 192 quan hệ nguyên liệu. Mỗi mục có đúng bản sửa đổi số 1, phiên bản khóa 2 sau khi gắn ảnh; không gán patch. Chạy lại `--apply` dùng lại toàn bộ 255 ảnh, tải mới 0 ảnh và không đổi phiên bản nội dung. Kiểm chứng độc lập bằng `--verify` cũng thành công.

## Sửa phù hiệu theo ảnh chụp trong game

`enchantment-corrections.json` giữ nội dung đã đối chiếu với ảnh chụp màn hình phù hiệu ngày 20/11/2026 cho đủ 33 phù hiệu: tên, tóm tắt, mô tả viết theo `frontend/docs/QUY-UOC-VIET.md` mục 5 và cách dùng trong trận (nội tại, kích hoạt hay đổi phụ trợ; hồi chiêu; số lần dùng; mốc thời gian). `correct-enchantments.py` so tệp này với bản đang xuất bản rồi tạo bản nháp `CONTENT_CORRECTION` cho các mục khác đi; bản dịch ngôn ngữ khác giữ nguyên.

```powershell
python research/warehouse/correct-enchantments.py
python research/warehouse/correct-enchantments.py --apply
python research/warehouse/correct-enchantments.py --apply --publish
python -m unittest discover -s research/warehouse -p "test_*.py"
```

`enchantment-translations-en.json` là bản tiếng Anh của cùng nội dung, áp dụng bằng `--file research/warehouse/enchantment-translations-en.json` thành bản nháp `TRANSLATION_UPDATE`; tệp không ghi cách dùng nên số liệu gameplay giữ nguyên. Ngày 20/11/2026 trên dữ liệu dev: bỏ 33 bản nháp tiếng Anh cũ (lưu lại trong `.local-state/`), xuất bản 33 bản sửa tiếng Việt rồi 33 bản dịch tiếng Anh.

Lệnh đầu chỉ đọc. Mục đang có bản nháp mở bị bỏ qua và được liệt kê kèm nguyên nhân của bản nháp đó; phải xuất bản hoặc bỏ bản nháp ấy trước. Mỗi bước ghi vào `.local-state/enchantment-corrections.jsonl`.

Với bản đã triển khai, chạy từ máy của người có quyền, đặt khóa của client `wiki-importer` vào `WIKI_IMPORTER_CLIENT_SECRET` trong shell của mình (công cụ không in hay lưu khóa) rồi thêm `--backend https://athahub.com --keycloak https://athahub.com/idp`. `--apply --discard-translation-drafts` lưu nội dung các bản nháp dịch đang chặn vào `.local-state/` rồi bỏ chúng.
