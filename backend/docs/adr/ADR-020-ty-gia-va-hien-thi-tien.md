# ADR-020 — Tỷ giá và hiển thị tiền theo đơn vị người dùng chọn

**Trạng thái:** Chấp nhận  
**Ngày:** 2026-11-06

## Bối cảnh

Tiền thưởng giải đấu được ghi bằng nhiều đơn vị: USD, VND, THB, TWD, IDR và nhiều đơn vị khác. Người đọc muốn
xem số tiền theo đơn vị mình chọn, giống cách thời gian được đổi theo múi giờ của họ. Sau này xem lại, người đọc vẫn
phải biết số tiền đổi được bao nhiêu **tại thời điểm đó**, nên tỷ giá phải được giữ lại theo ngày chứ không chỉ giữ
giá trị mới nhất. Số tiền chỉ để xem, không dùng để thanh toán.

Dự án chưa có nguồn tỷ giá. Không được thêm dịch vụ mới khi chưa có ADR.

## Quyết định

- `community-service` có thêm module `currency` với schema riêng `currency` và bảng `currency.exchange_rate`. Một dòng
  là một đơn vị trong một ngày: số đơn vị đó đổi được từ 1 USD. USD là gốc nên không có dòng riêng. Không có dịch vụ
  chạy riêng nào được thêm.
- Lịch sử giữ vĩnh viễn, từ `2016-01-01` (giải cũ nhất trong dữ liệu bắt đầu cuối năm 2016).
- Một job trong `community-service` lấy tỷ giá sau khi khởi động một phút rồi lặp lại mỗi 6 giờ. Lần đầu, job lấp lịch
  sử theo từng năm và lưu ngay từng năm, nên lỗi giữa chừng thì lần sau chạy tiếp từ chỗ đã dừng. Các lần sau, job lấy
  lại 7 ngày gần nhất vì nguồn có thể công bố trễ hoặc sửa số. Ghi là upsert nên nhiều instance chạy cùng lúc không làm
  hỏng dữ liệu. Không giữ transaction trong lúc gọi nguồn.
- Nguồn là tỷ giá tổng hợp của [Frankfurter](https://frankfurter.dev) (`GET /v2/rates`): không cần khóa, có đủ VND, TWD,
  THB, IDR, có lịch sử đủ xa, có cả cuối tuần. Nguồn nằm sau port `ExchangeRateSource`, URL cấu hình bằng
  `COMMUNITY_EXCHANGE_RATES_URL`, và Frankfurter tự host được bằng Docker nên có thể đổi mà không sửa logic.
- API công khai `GET /api/community/v1/exchange-rates?on=` trả tỷ giá của từng ngày được hỏi: với mỗi đơn vị là tỷ giá
  mới nhất công bố vào hoặc trước ngày đó, kèm ngày của tỷ giá. Một ngày cũ hơn lịch sử trả danh sách rỗng chứ không
  mượn tỷ giá của ngày sau.
- Tiền thưởng của một giải đổi theo tỷ giá ngày kết thúc giải, hoặc ngày bắt đầu nếu chưa có ngày kết thúc. Tổng tiền
  thưởng của đội gộp nhiều giải nên không có một ngày chung, và đổi theo tỷ giá mới nhất. Popup luôn ghi ngày của tỷ giá
  đã dùng.
- Lựa chọn của người dùng lưu như múi giờ: trong trình duyệt khi chưa đăng nhập, trong `user_profile.profile.currency`
  khi đã có hồ sơ. Trường này được phép null; client không gửi trường này thì giá trị đã lưu được giữ nguyên.
- Frontend dùng `LocalMoney` trong `packages/ui`. Thiếu tỷ giá hoặc chưa đọc chắc được số tiền thì hiện đúng số gốc.
- Vàng và quân huy trong game không phải tiền thật nên không đi qua cơ chế này.

## Lựa chọn đã cân nhắc

- **Nhập tay trong Admin.** Không phụ thuộc bên ngoài nhưng phải có người cập nhật đều, và lịch sử cũ phải nhập lại từ
  đầu. Người dùng chọn lấy tự động.
- **Bảng tỷ giá cố định trong mã nguồn.** Đổi số phải deploy lại và không có lịch sử.
- **Nguồn dựa riêng trên ECB, hoặc `open.er-api.com`.** ECB không có VND và TWD. `open.er-api.com` yêu cầu ghi nguồn
  trên trang, không cho phát lại dữ liệu và bản miễn phí không có lịch sử.
- **Chốt tỷ giá vào dữ liệu của từng giải khi kết thúc.** Không dùng được cho hàng trăm giải đã có, và phải đổi tài liệu
  giải mỗi khi thêm một đơn vị. Một bảng theo ngày trả lời được mọi trường hợp.

## Hệ quả

- `community-service` cần ra được Internet tới nguồn. Đặt `COMMUNITY_EXCHANGE_RATES_ENABLED=false` để tắt; khi đó tỷ giá
  đã lưu vẫn dùng được và popup vẫn ghi đúng ngày của chúng.
- Frankfurter ghi rõ tỷ giá tổng hợp là phép tính của họ, không phải tỷ giá chính thức của tổ chức nào, được cung cấp
  nguyên trạng và có thể trễ hoặc được sửa. Điều này chấp nhận được vì số tiền chỉ để xem. Không dùng số này cho thuế,
  kế toán hay thanh toán.
- Nguồn dừng hoạt động thì trang vẫn chạy với tỷ giá cuối cùng đã lưu. Khi đó cần đổi URL sang bản tự host hoặc viết một
  adapter khác cho `ExchangeRateSource`.
- Các dòng tiền nhập từ Liquipedia có sẵn cả USD lẫn nội tệ, nên người đọc dùng một trong hai đơn vị đó thấy đúng số đã
  ghi, không qua quy đổi.
