import { ItemOverview as View } from "@aov/ui/components/warehouse/item-overview"
import { AdminWarehouseView } from "./warehouse-view"
import type { ComponentProps } from "react"
import type { WarehouseEntry, ItemContent } from "./warehouse-types"
import { AdminRichTextPreview } from "../terminology/rich-text-field"
export function ItemOverview(props: Omit<ComponentProps<typeof View<WarehouseEntry<ItemContent>>>, "renderText">) {
  return (
    <AdminWarehouseView>
      <View {...props} renderText={(text, locale) => <AdminRichTextPreview text={text} locale={locale} />} />
    </AdminWarehouseView>
  )
}
