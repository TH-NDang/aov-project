import { SpellCollection as View } from "@aov/ui/components/warehouse/spell-cards"
import type { ComponentProps } from "react"
import { AdminWarehouseView } from "./warehouse-view"
import type { WarehouseEntry, SpellContent } from "./warehouse-types"
export { availabilityLabels } from "@aov/ui/components/warehouse/spell-cards"
export function SpellCollection(props: ComponentProps<typeof View<WarehouseEntry<SpellContent>>>) {
  return (
    <AdminWarehouseView>
      <View {...props} />
    </AdminWarehouseView>
  )
}
