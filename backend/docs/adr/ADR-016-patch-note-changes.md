# ADR-016 — Ghi thay đổi tướng từ ghi chú cập nhật và suy ra dữ liệu patch cũ

**Trạng thái:** Chấp nhận  
**Ngày:** 2026-10-29

## Bối cảnh

Dữ liệu tướng chủ yếu được thu thập ở mùa/patch hiện tại. Change set hiện bắt buộc một revision
GAME_PATCH đã xuất bản làm đích, còn import PATCH_UPDATE cần snapshot trước đó; thiếu dữ liệu của
patch cũ thì báo INSUFFICIENT_DATA. Vì vậy không thể ghi thay đổi của các patch đã qua trong mùa dù
ghi chú cập nhật chính thức đã nêu rõ từng thay đổi, và trang mùa/patch không hiển thị được các thay
đổi đó.

Các dòng thay đổi đã có khóa chỉ số/kỹ năng cùng giá trị cũ và mới, đủ để mô tả thay đổi mà không
cần snapshot đầy đủ của tướng ở patch đó.

## Quyết định

- Change set của tướng có nguồn `sourceKind`:
  - `SNAPSHOT`: như hiện tại, đích là revision GAME_PATCH đã xuất bản đúng variant; giá trị chỉ
    số/vai trò/ảnh được đối chiếu với snapshot nguồn và đích.
  - `PATCH_NOTES`: ghi từ ghi chú cập nhật chính thức. Không bắt buộc revision nguồn hoặc đích; bắt
    buộc `sourceUrl` HTTP(S). Dòng STAT và SKILL phải có cả giá trị cũ và mới. Khóa chỉ số và kỹ năng
    phải thuộc snapshot đã xuất bản mới nhất của tướng trong cùng ruleset khi tướng đã có snapshot.
    Không nhận dòng VISUAL vì thay đổi ảnh cần asset thật.
- Mỗi tướng/variant vẫn tối đa một change set; change set vẫn bất biến sau khi ghi.
- Danh mục theo mùa/patch đếm cả change set từ ghi chú. Tên tướng lấy từ revision đích khi có; không
  có thì lấy snapshot chưa hủy mới nhất của tướng trong ruleset.
- Không suy luận BUFF/NERF từ dấu của giá trị; người biên tập chọn tính chất từng dòng.
- Dữ liệu tướng tại một patch được suy ra khi đọc, không lưu thành snapshot:
  - có revision đã xuất bản đúng patch: dùng revision đó (quan sát);
  - có revision đã xuất bản trước patch: áp xuôi giá trị mới của các change set trong khoảng
    `(mốc trước, patch]`;
  - chỉ có revision sau patch: áp ngược giá trị cũ của các change set trong khoảng `(patch, mốc sau]`
    theo thứ tự giảm dần.
  Giá trị bị chạm được đánh dấu suy ra, kèm change set; phần còn lại giữ như bản neo và đánh dấu chưa
  xác minh. Kỹ năng chỉ trả giá trị theo trường đã ghi vì nội dung kỹ năng là mô tả tự do.

### Bổ sung ngày 2026-11-03: chọn mốc quan sát

Có thể chọn rõ `anchorRevisionId` để dùng baseline mới suy ngược dù tướng đã có mốc cũ. Mốc được chọn
phải đã xuất bản, thuộc đúng tướng/ruleset và có patch xác định; mốc nháp, đã hủy, khác phạm vi hoặc
không rõ patch bị từ chối. Khi bỏ tham số, API giữ thuật toán tự động nêu trên. Admin mặc định chọn
DATA_BASELINE đã xuất bản ở patch mới nhất, cho phép chọn bản khác hoặc quay về tự động; lựa chọn
mốc độc lập với patch đang xem. Không xóa snapshot cũ và không coi dữ liệu OCR chưa duyệt là mốc.

### Bổ sung ngày 2026-11-11: xem tướng ở mốc cũ trên wiki công khai

Phần lớn tướng chỉ được thu thập đầy đủ ở patch mới nhất, nên khi người đọc chọn một patch cũ hơn, API công khai
không tìm thấy revision ở hoặc trước mốc đó và wiki báo không tìm thấy tướng. Người đọc mất luôn thay đổi của tướng ở
patch đó dù ghi chú cập nhật đã được ghi.

- Khi chọn mốc lịch sử (`seasonId` hoặc `patchVariantId`), `/heroes`, `/heroes/{id}`, `/heroes/{id}/manifest` và
  `/skins` dùng revision đã xuất bản ở hoặc trước mốc như trước. Nếu tướng chưa có revision như vậy, dùng revision đã
  xuất bản có patch sớm nhất sau mốc (quan sát sau). Quan sát sau phải cùng ruleset, đã đến thời điểm công bố và
  không vượt patch đang có hiệu lực của thị trường; quan sát chưa xác định patch không được dùng làm quan sát sau.
- Mục dùng quan sát sau có `laterObservation: {patchVariantId, patchCode}`. Wiki phải ghi rõ nội dung được ghi nhận
  ở patch đó, không trình bày như dữ liệu quan sát tại mốc đang xem. Thay đổi của từng patch vẫn đọc từ lịch sử
  thay đổi của tướng.
- Không áp ngược giá trị của change set vào nội dung công khai: mô tả kỹ năng là văn bản tự do. Bản suy ra theo
  trường vẫn là màn Admin `patch-view`.
- Change set có `introducesHero=true` đánh dấu patch tướng ra mắt. Ở mốc trước patch đó, tướng không xuất hiện và
  không dùng quan sát sau. Mỗi tướng có tối đa một change set ra mắt trong một ruleset; không nhận khi tướng đã có
  revision đã xuất bản có patch trước patch ra mắt. Tướng không có change set ra mắt được coi là đã có từ trước mọi
  patch đã ghi của ruleset.
- Đánh giá tổng thể có thêm `RELEASE` (Ra mắt), chỉ dành cho change set ra mắt; các dòng thay đổi giữ bộ tính chất
  cũ.
- Mọi thị trường dùng bộ quy tắc chung cho toàn bộ lịch sử, nên ghi được lịch phát hành của patch cũ hơn ngày thiết
  lập thị trường; Admin ghi lịch phát hành ngay trong patch.
- Wiki công khai chỉ trình bày thay đổi đã ghi thành change set (từ ghi chú cập nhật hoặc đối chiếu snapshot có người
  biên tập chọn tính chất). Khác biệt tự so giữa hai snapshot đã xuất bản không hiện ra công khai, kể cả đánh dấu
  cũ/mới trong mô tả kỹ năng, bảng thông số và chỉ số: khác biệt đó có thể chỉ là sửa câu chữ, chính tả hoặc cách ghi.
  Patch không có change set của tướng hiện là "ghi chú cập nhật không nhắc đến tướng". Admin vẫn so sánh snapshot
  khi biên tập.
- Chọn patch cũ trên trang tướng chỉ đổi phần kỹ năng (mô tả, bảng thông số, ảnh kỹ năng) theo revision của mốc đó.
  Hồ sơ, đánh giá, chỉ số cơ bản, vai trò, giá, trang phục và ảnh tướng giữ theo dữ liệu hiện tại: dữ liệu cũ của các
  phần này thường thiếu hoặc chỉ khác cách ghi, còn thay đổi thật đã nằm trong ghi chú cập nhật của patch. API công
  khai vẫn trả revision theo mốc như trước; wiki ghép phần kỹ năng của mốc vào dữ liệu hiện tại.

### Bổ sung ngày 2026-11-12: mô tả trước khi đổi của dòng cơ chế

Ghi chú cập nhật của một lần làm lại thường chỉ mô tả cơ chế mới, không có giá trị cũ để so, và tướng thường chưa có
revision ở patch trước đó. Nguồn khác, ví dụ một bản cũ của trang wiki bên ngoài, có thể cho biết kỹ năng làm gì trước
khi đổi, nhưng change set đã ghi thì bất biến.

- Mỗi dòng MECHANIC có thể có thêm tối đa một mô tả "trước khi đổi": văn bản người biên tập tự viết và link HTTP(S) của
  nguồn. Mô tả lưu ở bảng riêng `hero.hero_mechanic_change_previous`, chỉ thêm, không sửa hay xóa; dòng cơ chế và
  change set giữ nguyên.
- Ghi được sau khi change set đã ghi, cần quyền `patch:write`. Mô tả này không phải dữ liệu đã quan sát: không suy ra
  số liệu, không tạo snapshot và không đổi kết quả `patch-view`.
- Lịch sử thay đổi (Admin và công khai) trả `previous: {description, sourceUrl, recordedAt}` trên dòng cơ chế, `null`
  khi chưa ghi.
- Nguồn bên ngoài có giấy phép riêng (Liquipedia dùng CC BY-SA): người biên tập viết lại bằng lời của mình, không chép
  nguyên văn, và luôn ghi nguồn; giao diện hiện link nguồn cạnh mô tả.

## Hệ quả

- Ghi được thay đổi của các patch đã qua mà không cần thu thập lại toàn bộ dữ liệu tướng.
- Wiki mở được mọi tướng đã ra mắt ở mọi patch đã công bố của mùa, kèm thay đổi của patch đó, dù dữ liệu tướng
  được thu thập ở mùa hoặc patch nào.
- Kết quả suy ra chỉ đúng khi ghi chú cập nhật đầy đủ; giao diện phải hiển thị rõ nguồn suy ra và
  phần chưa xác minh, không trình bày như dữ liệu đã quan sát.
- Bảng `hero.hero_patch_change_set` thêm `source_kind`, `source_url` và cho phép revision đích null
  với nguồn `PATCH_NOTES`. Dữ liệu cũ mặc định là `SNAPSHOT`.
- Trang bị, phụ trợ, bảng ngọc và phù hiệu chưa áp dụng quyết định này; mở rộng sau theo cùng mô hình.
