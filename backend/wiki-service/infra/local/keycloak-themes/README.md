# Trang đăng nhập AOV

Theme `aov-public` dành cho hai public client `aov-wiki` và `aov-stream`, tương thích Keycloak 26.4.0
trong Compose. Mỗi client dùng mascot và bảng màu của ứng dụng. Template chỉ thay khung giao diện;
form đăng nhập, đăng ký, xác minh, MFA và khôi phục mật khẩu kế thừa Keycloak để giữ validation,
action URL và các bước xác thực. Các tính năng chỉ hiện khi realm đã bật/cấu hình tương ứng.

## Local

Compose mount theme ở chế độ chỉ đọc. Với realm đã tồn tại, chạy từ `backend/wiki-service`:

```powershell
docker compose --profile identity up -d --no-deps keycloak
$credential = Get-Credential -UserName admin
./scripts/sync-community-client.ps1 -Credential $credential
./scripts/sync-community-client.ps1 -ClientId aov-wiki -Credential $credential
```

Script đồng bộ đúng redirect URI, S256, audience, theme riêng từng client và ngôn ngữ vi/en.
Không cấp role, không bật password grant của public client và không xóa dữ liệu. Thêm
`-EnableRegistration` khi cần bật đăng ký. Realm import mới đã có cùng cấu hình.

## Triển khai

Đưa thư mục `aov-public` vào `/opt/keycloak/themes/` trong image hoặc volume của máy chủ xác thực.
Giữ ID hai public client như trên; đặt thuộc tính `login_theme=aov-public` và origin/callback/logout
chính xác theo tên miền triển khai. Dùng HTTPS. Không đặt theme này làm mặc định cho client admin.
Frontend dùng `VITE_AUTH_ISSUER`, `VITE_AUTH_CLIENT_ID` tương ứng trước khi build. Không có client
secret trong frontend. Token chỉ nằm trong bộ nhớ, giao dịch PKCE tạm trong sessionStorage.

Ảnh mascot được sao chép từ asset frontend; khi đổi logo cần cập nhật bản trong `resources/img` của theme.
Sau khi sửa theme trên môi trường bật cache, triển khai lại/restart Keycloak theo quy trình vận hành.
Khi nâng Keycloak cần kiểm tra lại template kế thừa, script password visibility, đăng ký và MFA.

## Kiểm tra

`scripts/dev/test-community-setup.ps1` kiểm tra cấu hình client; `pnpm --filter @aov/ui test:auth`
từ `frontend` kiểm tra PKCE, callback lặp, state, thời hạn, đường dẫn quay lại, refresh và logout.
Kiểm tra thêm trang login/register ở vi/en, trên desktop/điện thoại và các provider thực tế đã cấu hình.
