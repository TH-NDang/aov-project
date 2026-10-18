# Nhập thay đổi tướng tháng 09–10/2026

Đã nhập vào backend local ngày 18/10/2026 qua API quản trị, không ghi SQL trực tiếp:

| Patch | Tướng có change set | Mục thay đổi |
| --- | ---: | ---: |
| 29/09/2026 | 15 | 29 |
| 15/10/2026 | 9 | 18 |
| Mùa S4 2026 | 24 | 47 |

Nguồn: [bài ngày 29/09](https://lienquan.garena.vn/chi-tiet-ban-cap-nhat-vet-nut-thoi-khong-29-09-2026/),
[bài ngày 15/10](https://lienquan.garena.vn/dieu-chinh-giua-mua-pb-vet-nut-thoi-khong-15-10-2026/).

## Phạm vi và độ tin cậy

- Bộ nền chứa một số giá trị đã cập nhật ngày 29/09. Chỉ những trường cũ được bài công bố rõ mới được dựng lại.
  Phần không đổi kế thừa dữ liệu nền, không khẳng định là quan sát đầy đủ của lịch sử S3.
- `official-hero-changes.json` giữ các sự kiện số liệu và diễn giải ngắn; loại thay đổi do biên tập.
- `skill-overrides.json` lưu mô tả trước/sau và từng thay thế đã kiểm tra, giữ các đoạn nguồn còn bị cắt.
- `roles.json` có bằng chứng vai trò từ taxonomy chính thức hiện tại; đây không phải bằng chứng vai trò đã đổi trong patch.
- Không sửa chỉ số chiến đấu, đánh giá, trang phục hoặc tham chiếu ảnh đang có.
- 13 placeholder kỹ năng phụ không có mô tả, ảnh hay effect được giữ trong bản sao gốc và không đưa vào các snapshot xuất bản.
  Kỹ năng chính cùng slot vẫn giữ mô tả đã thu thập; không điền nội dung giả để vượt kiểm tra xuất bản.
- Preyta tạm hoãn: bộ nền đã là bản làm lại, chưa có bộ kỹ năng cũ đủ tin cậy.
- Evita là tướng mới chưa có nền đầy đủ; lỗi Nakroth được bài ghi riêng ngày 16/10 nên không gán vào 15/10.
- Chỉ ghi gameplay của tướng, không nhập trang bị, bản đồ hoặc lỗi hiệu ứng trang phục.

Mỗi tướng được hoàn thiện bản nền từ nguồn đã kiểm tra, xuất bản, tạo `GAME_PATCH` kế thừa, lưu phần thay đổi,
xuất bản bản mới rồi ghi change set có nguồn. Ngày xuất bản dữ liệu là thời điểm thao tác quản trị;
patch áp dụng gameplay vẫn là 29/09 hoặc 15/10, không tự thay lịch áp dụng của các thị trường.

## Chạy và kiểm chứng

Từ thư mục gốc repository, khi backend và Keycloak local đang chạy:

```powershell
python -X utf8 research/patches/2026/import-patches.py
python -X utf8 research/patches/2026/import-patches.py --apply
python -X utf8 research/patches/2026/import-patches.py --verify
```

Mặc định chỉ đọc và chuẩn bị kế hoạch. Chỉ `--apply` mới ghi dữ liệu. Script chỉ chấp nhận endpoint loopback;
đăng nhập bằng `wiki-local-cli`, dùng tài khoản dev trong file realm local hoặc biến môi trường
`WIKI_IMPORT_USERNAME`, `WIKI_IMPORT_PASSWORD`. Không lưu token hay mật khẩu trong kết quả.

`.local-state/` được Git bỏ qua, chứa kế hoạch có bản sao đầy đủ trước nhập, receipt và kết quả kiểm chứng.
Thư mục này nằm ngoài Maven `target`, nên `mvn clean` không xóa bản sao. Giữ nguyên kế hoạch và receipt
để tiếp tục khi gián đoạn; script kiểm tra chính xác nội dung, version và nguồn trước khi tiếp tục,
không ghi đè thay đổi ngoài kế hoạch và không tạo lại change set đã tồn tại.

Kiểm chứng thực tế: đủ 24 cặp snapshot published có khác biệt; bộ lọc S4 có 24 tướng,
29/09 có 15 và 15/10 có 9; chạy lại không tăng số bản hoặc change set.
