import { useArcanaStatColors } from "./arcana-stat-colors"
import { ArcanaCollection as View } from "@aov/ui/components/warehouse/arcana-cards"
import type { ComponentProps } from "react"
import { AdminWarehouseView } from "./warehouse-view"
import type { WarehouseEntry, ArcanaContent } from "./warehouse-types"

export function ArcanaCollection(props: Omit<ComponentProps<typeof View<WarehouseEntry<ArcanaContent>>>, "statColor">) {
  const statColor = useArcanaStatColors()
  return (
    <AdminWarehouseView>
      <View {...props} statColor={statColor} />
    </AdminWarehouseView>
  )
}
