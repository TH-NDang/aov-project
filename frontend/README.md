# AOV frontend

Monorepo React + TypeScript + Vite, pnpm workspace và Turborepo. Mỗi app chỉ hiển thị Hello. Các component shadcn/ui khả dụng cho style new-york đã được cài trong packages/ui; mỗi app vẫn chỉ hiển thị Hello.

## Cấu trúc

```text
apps/
  aov-wiki/       # localhost:5173
  aov-stream/     # localhost:5174
  admin-aov/      # localhost:5175
packages/
  ui/            # Cấu hình shadcn/ui dùng chung
  typescript-config/
docs/
```

## Chạy

Node.js >=22.12, pnpm 11.28.4. Chạy trong thư mục frontend:

```sh
pnpm install
pnpm dev
# Chạy riêng:
pnpm dev:wiki
pnpm dev:stream
pnpm dev:admin
# Kiểm tra:
pnpm typecheck
pnpm build
```

Khi cần thêm UI:

```sh
pnpm dlx shadcn@latest add button --cwd packages/ui
```

## Dùng UI chung

```tsx
import { Button } from "@aov/ui/components/button"
import { useIsMobile } from "@aov/ui/hooks/use-mobile"
```

Component nằm ở `packages/ui/src/components`, hook ở `packages/ui/src/hooks`. Registry new-york-v4 hiện không cung cấp `questionnaire` và `toast`; sử dụng `sonner` cho thông báo.

Khi dùng tooltip hoặc sidebar, bọc vùng giao diện bằng `TooltipProvider` từ `@aov/ui/components/tooltip`.
