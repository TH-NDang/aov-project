import { SpellArtwork as View } from "@aov/ui/components/warehouse/spell-artwork"
import type { ComponentProps } from "react"
import { AdminWarehouseView } from "../catalog/warehouse-view"

export function SpellArtwork(props: ComponentProps<typeof View>) {
  return (
    <AdminWarehouseView>
      <View {...props} />
    </AdminWarehouseView>
  )
}
