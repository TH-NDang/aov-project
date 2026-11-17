import { EnchantmentBranches as View } from "@aov/ui/components/warehouse/enchantment-branches"
import type { ComponentProps } from "react"
import { AdminWarehouseView } from "./warehouse-view"
import type { WarehouseEntry, WarehouseMetadata } from "./warehouse-types"
import type { EnchantmentContent } from "@aov/ui/lib/warehouse-content"

export function EnchantmentBranches(
  props: ComponentProps<typeof View<WarehouseEntry<EnchantmentContent>, WarehouseMetadata>>,
) {
  return (
    <AdminWarehouseView>
      <View {...props} />
    </AdminWarehouseView>
  )
}
