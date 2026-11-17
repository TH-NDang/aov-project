import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { Button } from "@aov/ui/components/button"
import { CircleHelp } from "lucide-react"
import { ItemShopGraph as View } from "@aov/ui/components/warehouse/item-shop-graph"
import type { ComponentProps } from "react"
import { AdminWarehouseView } from "./warehouse-view"

export function ItemShopGraph(props: ComponentProps<typeof View>) {
  return (
    <AdminWarehouseView>
      <View {...props} />
    </AdminWarehouseView>
  )
}

export function ItemShopHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9" aria-label="Cách dùng sơ đồ cửa hàng">
          <CircleHelp className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-1.5 text-xs leading-5">
        <p className="font-medium">Cách dùng sơ đồ cửa hàng</p>
        <p>Chọn một món để xem các đường ghép tới nguyên liệu và món nâng cấp.</p>
        <p>Nối hai chấm ở hai bên thẻ, hoặc kéo từ chấm này sang chấm kia, để thêm nguyên liệu.</p>
        <p>Kéo tay nắm bên trái thẻ để đổi ô. Món đã xuất bản sẽ hỏi tạo bản nháp trước khi đổi.</p>
        <p>Nhấn / để tìm trang bị. Esc để hủy nối hoặc bỏ chọn.</p>
      </PopoverContent>
    </Popover>
  )
}
