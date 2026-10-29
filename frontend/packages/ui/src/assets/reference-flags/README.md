# Biểu tượng quốc gia và khu vực

Các biểu tượng được đóng gói trong frontend; trình duyệt không tải cờ từ dịch vụ bên ngoài khi hiển thị tham chiếu.

- `vn`, `th`, `tw`, `id`, `us`, `gb`, `cn`, `jp`, `kr`: dùng lại các SVG sẵn có tại `apps/admin-aov/public/images/flags/`.
- `hk`, `mo`, `sg`, `my`, `ph`: lấy nguyên bản định dạng 4:3 từ bộ [flag-icons](https://github.com/lipis/flag-icons), phiên bản **7.3.2**, ngày 27/10/2026.

Nguồn tải cho năm biểu tượng bổ sung:

| Mã | Nguồn |
|---|---|
| HK | https://cdn.jsdelivr.net/npm/flag-icons@7.3.2/flags/4x3/hk.svg |
| MO | https://cdn.jsdelivr.net/npm/flag-icons@7.3.2/flags/4x3/mo.svg |
| SG | https://cdn.jsdelivr.net/npm/flag-icons@7.3.2/flags/4x3/sg.svg |
| MY | https://cdn.jsdelivr.net/npm/flag-icons@7.3.2/flags/4x3/my.svg |
| PH | https://cdn.jsdelivr.net/npm/flag-icons@7.3.2/flags/4x3/ph.svg |

Bộ flag-icons do Panayiotis Lipiridis phát hành theo giấy phép MIT. Giữ nguyên thông báo trong [LICENSE.flag-icons](LICENSE.flag-icons).

Chỉ các mã khai báo trực tiếp trong `country-references.ts` được dùng làm cờ. Cơ chế này không mở quyền hiển thị SVG từ URL tùy ý trong dữ liệu nhập vào.
