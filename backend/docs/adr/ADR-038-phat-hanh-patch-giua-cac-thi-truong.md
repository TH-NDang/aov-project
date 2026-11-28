# ADR-038 — Một thời điểm phát hành cho mọi thị trường, nguồn theo khu vực và video của patch

**Trạng thái:** Chấp nhận  
**Ngày:** 2026-11-28

## Bối cảnh

- Chủ dự án xem trang chính thức của các thị trường và thấy một bản cập nhật ra cùng ngày, cùng nội dung ở các nơi; chỉ
  giờ địa phương khác nhau. Trước đây Admin đặt lịch từng thị trường một, nên các ngày giờ dễ lệch nhau.
- Soi trang chính thức (28/11/2026) cho thấy:
  - Bản cân bằng giữa mùa ra cùng ngày ở VN, TH, TW, ID, cập nhật không gián đoạn, bài chỉ ghi ngày (ví dụ 26/11/2026).
  - Bản lớn đầu mùa không cùng lúc: mùa S4 2026 có TW 23/09 08:00 giờ Đài Loan, VN và TH 29/09 03:30 (cùng một thời
    điểm), bài ID ghi 18/09. TW thường sớm khoảng một tuần ở mọi mùa.
  - Có bài chỉ một số nơi đăng (TW và TH có bản sửa lỗi 04/11/2026 mà VN không có); trang TH trước 07/2026 chỉ có bài của
    bản lớn.
- Link nguồn chung của patch (ADR-016, bổ sung 27/11) có nhãn và ngôn ngữ nhưng không biết thuộc thị trường nào, tối đa
  10 link, không đủ cho bốn thị trường mỗi nơi một hoặc hai bài.
- Kênh YouTube Trải Nghiệm Game (VN) có nhiều video quanh mỗi bản cập nhật: xem trước ở máy chủ thử nghiệm, tổng hợp bản
  chính thức, trải nghiệm sau cập nhật, từng tướng sau cập nhật. ADR-019 chỉ cho gắn video vào tướng, trang phục và mục
  kho.

## Quyết định

### Lịch phát hành của cả patch

- Vẫn lưu mỗi thị trường một dòng `patch.patch_release`, vì có ngoại lệ thật (TW sớm hơn, ID ghi ngày khác).
- `PUT /admin/patch-variants/{id}/releases` (`patch:publish`) nhận cả kế hoạch: mỗi thị trường một thời điểm chính xác
  hoặc một ngày, kèm link nguồn tùy chọn. Thị trường không có trong kế hoạch mất lịch. Dòng không đổi giữ nguyên id và
  xác nhận; dòng đổi giờ bắt đầu lại (thời điểm chính xác áp dụng từ lúc đó, ngày chờ xác nhận lại). Mọi thị trường bị
  khóa trước, theo thứ tự id, rồi mới tới ruleset và variant, để hai kế hoạch không khóa chéo.
- Thị trường đang khóa trên Wiki vẫn ghi được thời điểm chính xác qua kế hoạch, vì đó là thông tin phát hành chứ không
  phải dữ liệu thị trường. Thời điểm chính xác vẫn cần ruleset của thị trường tại lúc đó và không được đảo thứ tự patch.
- Admin soạn kế hoạch theo một thời điểm chung, hiện theo giờ địa phương của từng thị trường; mỗi thị trường có thể
  "theo giờ chung", "giờ riêng" hoặc "chưa có thông tin".
- Patch công khai trả thêm `markets`: mỗi thị trường có lịch gồm mã, múi giờ, `effectiveAt` khi biết giờ hoặc
  `effectiveOn` khi chỉ biết ngày. Ngày đã xác nhận vẫn trả ngày, không trả mốc xác nhận nội bộ.

### Nguồn theo khu vực và ngôn ngữ

- `patch.variant_source.region_code` (V090) ghi thị trường của bài, tùy chọn, phải là mã thị trường có thật. Mỗi patch
  tối đa 20 link.
- Wiki nhóm nguồn theo thị trường, mỗi link ghi ngôn ngữ; link không có thị trường xếp cuối.

### Video của patch (chỉ VN lúc này)

- Thêm loại đối tượng `PATCH`: `subject_id` là id variant, và `patch_variant_id` luôn bằng nó (ràng buộc trong V091).
  Ghi cần `patch:write`, công khai cần thêm `patch:publish`.
- Ba mục đích mới chỉ dành cho video của patch: `PATCH_PREVIEW` (xem trước, máy chủ thử nghiệm), `PATCH_OVERVIEW`
  (tổng hợp bản chính thức), `PATCH_REVIEW` (trải nghiệm sau cập nhật). Video của patch cũng nhận `OTHER`.
- Video về một tướng sau cập nhật là video của tướng, `purpose = PATCH_CHANGE`, `patch_variant_id` là patch đó.
- Video thêm `published_at` (thời điểm đăng) và `locale` (ngôn ngữ của video). Trước hay sau phát hành được tính từ
  thời điểm đăng và lịch của thị trường, không lưu.
- `GET /videos?subjectKind=PATCH&subjectId={variantId}` trả video của patch và video `PATCH_CHANGE` có cùng patch, cũ
  trước. Admin lọc `patchVariantId` để thấy cùng tập đó.
- Nhập video từ kênh dùng API kênh của community-service (ADR-034), phân loại theo tiêu đề rồi để biên tập viên duyệt;
  không có job tự đăng.

## Đánh đổi

- Không có bảng "thời điểm chung": thời điểm chung chỉ tồn tại trong Admin, dòng của từng thị trường mới là dữ liệu.
  Đổi lại không cần di chuyển dữ liệu cũ và các truy vấn context, xác nhận ngày, thứ tự patch giữ nguyên.
- Nguồn vẫn là danh sách phẳng; nhóm theo thị trường là việc của giao diện.
- Video `PATCH` dựa vào variant, nên một patch có hai ruleset sẽ có hai danh sách video. Hiện mỗi patch có một variant.

## Kiểm chứng

- `PatchReleaseWorkflowTests` và `PatchRepositoriesIntegrationTest` kiểm tra kế hoạch giữ dòng không đổi, chuyển ngày
  đã xác nhận sang giờ chính xác, xóa thị trường bỏ ra, từ chối hai dòng cho một thị trường, ngày ngoài mùa, thị trường
  lạ và nguồn gắn thị trường lạ.
- `VideoIntegrationTest` kiểm tra quyền của video patch, thứ tự cũ trước, mục đích sai loại, patch không tồn tại và
  nhập lô.
