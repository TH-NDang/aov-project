# resources/

Từ 16/11/2026 thư mục này không còn nằm trong git ([ADR-030](../backend/docs/adr/ADR-030-tep-nguon-va-dung-luong-r2.md)).
Git chỉ giữ tệp này. Mọi thứ khác ở đây là bản sao trên máy mà git bỏ qua; giữ hay xóa là việc của chủ máy.

## Dữ liệu nằm ở đâu

- **Ảnh công khai** (tướng, trang phục, kỹ năng, trang bị, phù hiệu, ngọc, phụ trợ, icon và ảnh sảnh chế độ chơi) là
  Media. Bản gốc trong `Lien-Quan-v3/assets` còn trong lịch sử git, không có bản trong bộ tệp nguồn.
- **Ảnh đối chứng và dữ liệu nhập** nằm trong bucket riêng `aov-source-private`, chia theo bộ tệp nguồn. Xem trong
  Admin › Quản lý tệp › Tệp nguồn.

| Thư mục cũ | Bộ tệp nguồn | `--to` khi kéo về |
|---|---|---|
| `Lien-Quan-v3/data`, `Lien-Quan-v3/note`, 10 ảnh trong `Lien-Quan-v3/assets` chưa là Media | `lien-quan-v3-data` | `../../../resources/Lien-Quan-v3` |
| `Lien-Quan-v3/che-do-choi`: `che-do.json`, `README.md`, `sanh-che-do/` | `sanh-che-do` | `../../../resources/Lien-Quan-v3/che-do-choi` |
| `Lien-Quan-v3/che-do-choi/co-lien-quan/bach-khoa-2026-11-08-1503` | `co-lien-quan-2026-11-08-1503` | như trên |
| `Lien-Quan-v3/che-do-choi/co-lien-quan/bach-khoa-2026-11-08` | `co-lien-quan-2026-11-08` | như trên |
| `Lien-Quan-v3/che-do-choi/co-lien-quan/chup-tay-2026-10-16` | `co-lien-quan-chup-tay-2026-10-16` | như trên |
| `Lien-Quan-v3/che-do-choi/co-lien-quan/thong-tin-2026-11-08` | `co-lien-quan-thong-tin-2026-11-08` | như trên |
| `esports/2026-post-apl` | `esports-2026-post-apl` | `../../../resources/esports/2026-post-apl` |
| `raw/*.zip`, `extracted/2026-s4/2026-10-30` | `hero-capture-2026-10-30` | `../../../resources` |
| `raw/shop/2026-09-16`, `extracted/shop/2026-09-16` | `shop-2026-09-16` | `../../../resources` |
| `raw/builds/2026-11-11`, `extracted/builds/2026-11-11` | `builds-2026-11-11` | `../../../resources` |
| `raw/ranking/2026-11-11`, `extracted/ranking/2026-11-11` | `ranking-2026-11-11` | `../../../resources` |

## Kéo bản sao về máy

Chạy trong `frontend/apps/admin-aov`, khi backend dev đang chạy với R2. Bỏ `--apply` để xem trước số tệp sẽ tải:

```sh
pnpm sources:sync pull --collection lien-quan-v3-data --to ../../../resources/Lien-Quan-v3 --apply
```

- Lệnh ghi đè tệp trên máy khác bản trên R2, nên xem trước nếu bạn đang sửa tệp review.
- Ảnh trong ZIP của `hero-capture-2026-10-30` về thành thư mục mang tên ZIP (`raw/<ZIP>/<ZIP con>/<tệp>`); bộ không giữ
  tệp ZIP nguyên khối.
- Mỗi bộ ảnh chụp có `capture-manifest.json` ở gốc. Đó là tệp dẫn xuất, `publish-captures` dựng lại được.

Bỏ hẳn, không chuyển đi: `Lien-Quan-v3/program`, `preview`, `temp`, `assets/vai-tro` (bản giống hệt nằm trong
`frontend/apps/admin-aov/public/images/hero/vai-tro/`) và ảnh xem trước do công cụ review sinh ra.
