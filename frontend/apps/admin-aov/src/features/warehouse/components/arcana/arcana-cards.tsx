import { useArcanaStatColors } from "./arcana-stat-colors"
import { ArcanaCollection as View } from "@aov/ui/components/warehouse/arcana-cards"
import type { ComponentProps } from "react"
import { AdminWarehouseView } from "../catalog/warehouse-view"
import type { WarehouseEntry } from "../../model/warehouse-types"
import type { ArcanaContent } from "@aov/ui/lib/warehouse-content"

export function ArcanaCollection(props: Omit<ComponentProps<typeof View<WarehouseEntry<ArcanaContent>>>, "statColor">) {
  const statColor = useArcanaStatColors()
  return (
    <AdminWarehouseView>
      <View {...props} statColor={statColor} />
    </AdminWarehouseView>
  )
}
