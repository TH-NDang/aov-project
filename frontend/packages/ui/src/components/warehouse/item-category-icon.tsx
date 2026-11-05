import { itemCategoryFallback } from "@aov/ui/components/item-category-icons"
import { cn } from "@aov/ui/lib/utils"
import { WarehouseAsset as HeroAsset } from "./warehouse-view"
import { type WarehouseMetadata } from "@aov/ui/lib/warehouse-content"

export { itemCategoryFallback } from "@aov/ui/components/item-category-icons"

export function ItemCategoryIcon({
  category,
  className,
}: {
  category: Pick<WarehouseMetadata, "code" | "iconAssetId"> | undefined
  className?: string
}) {
  if (category?.iconAssetId)
    return (
      <HeroAsset
        id={category.iconAssetId}
        alt=""
        frameAspectRatio={1}
        className={cn("size-5 shrink-0 rounded-sm border-0 bg-transparent", className)}
      />
    )
  const Icon = itemCategoryFallback(category?.code)
  return <Icon aria-hidden className={cn("size-5 shrink-0", className)} />
}
