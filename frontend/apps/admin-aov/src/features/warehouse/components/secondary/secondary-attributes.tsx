import { SecondaryAttributes as View } from "@aov/ui/components/warehouse/secondary-attributes"
import { AdminWarehouseView } from "../catalog/warehouse-view"
import type { ComponentProps } from "react"

export function SecondaryAttributes(props: ComponentProps<typeof View>) {
  return (
    <AdminWarehouseView>
      <View {...props} />
    </AdminWarehouseView>
  )
}
