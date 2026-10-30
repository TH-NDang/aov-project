import { Footprints, HeartHandshake, Package, Shield, Sword, Trees, WandSparkles, type LucideIcon } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { HeroAsset } from "../publishing/hero-asset"
import type { WarehouseMetadata } from "./warehouse-types"

/** Shown until an icon is uploaded for the shop group in the group editor. */
const fallbackIcons: Record<string, LucideIcon> = {
  cong: Sword,
  phep: WandSparkles,
  thu: Shield,
  "toc-chay": Footprints,
  "di-rung": Trees,
  "phu-tro": HeartHandshake,
}

export function itemCategoryFallback(code: string | null | undefined): LucideIcon {
  return (code && fallbackIcons[code]) || Package
}

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
        className={cn("size-4 rounded-sm border-0 bg-transparent", className)}
      />
    )
  const Icon = itemCategoryFallback(category?.code)
  return <Icon aria-hidden className={cn("size-4 shrink-0", className)} />
}
