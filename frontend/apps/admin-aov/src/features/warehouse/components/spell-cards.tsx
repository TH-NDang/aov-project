import { SpellCollection as View } from "@aov/ui/components/warehouse/spell-cards"
import type { ComponentProps } from "react"
import { AdminWarehouseView } from "./warehouse-view"
import type { WarehouseEntry } from "../model/warehouse-types"
import type { SpellContent } from "@aov/ui/lib/warehouse-content"
export function SpellCollection(props: ComponentProps<typeof View<WarehouseEntry<SpellContent>>>) {
  return (
    <AdminWarehouseView>
      <View {...props} />
    </AdminWarehouseView>
  )
}
