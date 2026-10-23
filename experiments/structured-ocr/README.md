# Thử nghiệm OCR có cấu trúc trên CPU

Nhánh độc lập: `codex/ocr-structured-actions-trial`. Không sửa ứng dụng backend/frontend và không merge vào main.

## Phạm vi và trạng thái

Workflow dùng **Surya OCR 2 (surya-ocr 0.22.1)** với llama.cpp CPU, không phải Chandra, Marker hay kết quả Datalab Playground. Lượt đầu tạo một ảnh giả lập bằng Python khi chạy. Đây **không phải ảnh người dùng đã gửi**; kết quả chỉ kiểm tra đường chạy và khả năng xuất block, chưa đánh giá độ chính xác trên ảnh game.

Không commit ảnh người dùng, không nhận URL tùy ý, không cần API key, không dùng runner GPU trả phí. Artifact tồn tại 7 ngày trong repo public: chỉ chứa ảnh giả lập và kết quả của ảnh đó. Chưa có đường truyền ảnh riêng tư được triển khai.

Marker 1.10.2 trước đó bị HTTP 403/Cloudflare 1010 từ nguồn model `models.datalab.to`. Không thử lại nguồn bị chặn từ GitHub Actions. Marker 2 vẫn gọi OCR-error predictor cũ; vì vậy thử nghiệm dùng trực tiếp RecognitionPredictor của Surya 2, theo API chính thức, với GGUF do Datalab phát hành độc lập trên Hugging Face. Đường tải model cũ bị vô hiệu hóa để lỗi rõ ràng nếu vô tình gọi. Không tắt OCR hoặc giả lập kết quả để làm CI xanh.

## Chạy

Push thay đổi trong thư mục thử nghiệm hoặc workflow lên nhánh trên sẽ chạy tự động. `workflow_dispatch` được khai báo cho trường hợp GitHub cho phép chạy thủ công workflow từ nhánh. Runner tiêu chuẩn `ubuntu-24.04`, tối đa 30 phút cho job, tối đa 11 phút cho tiến trình suy luận, một ảnh và một slot. Không chạy lịch định kỳ.

Workflow kiểm tra tài nguyên, cài PyTorch CPU, kiểm thử exporter, tải đúng revision GGUF và xác minh SHA-256, rồi chạy suy luận offline với model local. Phiên bản trực tiếp được ghim; `installed-packages.txt` ghi toàn bộ phiên bản phụ thuộc đã giải quyết của lượt chạy. Không tuyên bố dependency lock hoàn toàn tái lập.

Kiểm thử exporter cục bộ (Python 3.12, Pillow 10.4.0):

```sh
PYTHONPATH=experiments/structured-ocr python -m unittest discover -s experiments/structured-ocr/tests -v
```

## Đọc artifact

- `generation-NNN.txt`: chuỗi model trả về qua backend, không sửa nội dung.
- `generation-NNN.json`: metadata và chuỗi raw cho từng lời gọi, gồm fallback nếu có. Đây là output public API trả về sau retry nội bộ, không ghi lại từng lần thử nội bộ.
- `native.json`: output schema của thư viện Surya sau parser nguyên bản. Thư viện có thể chuẩn hóa nhãn/lọc block; file này không phải chuỗi token raw. Không sửa lỗi OCR.
- `viewer.html`: trang xem được ghép từ HTML của block, tách biệt với raw output và không phải HTML do Playground xuất. Nội dung nằm trong iframe sandbox, có CSP; ảnh Picture được nhúng để mở offline một file.
- `picture-NNN.png`: chỉ cắt vùng được model gán nhãn `Picture`; không biến vùng Text thành ảnh minh họa. Có thể không có ảnh nếu model không phát hiện Picture.
- `picture-crops.json`: ánh xạ block và tọa độ crop đã chặn trong biên ảnh.
- `status.json`: thành công/thất bại, số block, phiên bản, thời gian, hash input.
- `checksums.json`: kiểm tra toàn bộ file sau khi lưu status và log chẩn đoán cuối lượt (không tự hash chính manifest).

Job lỗi hoặc timeout không chứng minh OCR thành công. Kiểm tra kết luận CI và `status.json`; timeout có thể không tạo được status cuối. Màu chữ HEX không được trích riêng trong thử nghiệm này. Model có thể đọc sai hoặc bỏ sót block; không sửa đầu ra bằng tay.

## Nguồn chính thức và pin

- [Surya README/API](https://github.com/datalab-to/surya)
- [Surya 0.22.1 trên PyPI](https://pypi.org/project/surya-ocr/0.22.1/)
- [GGUF chính thức](https://huggingface.co/datalab-to/surya-ocr-2-gguf/tree/6a3a4c30e5e74446d4f8b6afd05b2f2da970f470): model 1,266,400,864 byte + mmproj 204,986,688 byte. Hash trong workflow.
- [llama.cpp b11838](https://github.com/ggml-org/llama.cpp/releases/tag/b11838): bản Ubuntu x64 chính thức, hash trong workflow.
- [Marker hiện hành](https://github.com/datalab-to/marker): pipeline khác, không chạy ở đây.

Giấy phép phần mềm/model theo các dự án nguồn; thử nghiệm không phân phối lại trọng số. Không suy ra kết quả này tương đương dịch vụ Chandra 2.5 có quản lý.
