import { ItemCategoryIcon as View } from "@aov/ui/components/warehouse/item-category-icon"
import type { ComponentProps } from "react"
import { AdminWarehouseView } from "../catalog/warehouse-view"

export function ItemCategoryIcon(props: ComponentProps<typeof View>) {
  return (
    <AdminWarehouseView>
      <View {...props} />
    </AdminWarehouseView>
  )
}
