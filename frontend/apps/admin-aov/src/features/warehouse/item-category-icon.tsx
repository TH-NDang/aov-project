import { Footprints, HeartHandshake, Package, Shield, Sword, Trees, WandSparkles, type LucideIcon } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"
import { HeroAsset } from "../publishing/hero-asset"
import { warehouseText, type WarehouseMetadata } from "./warehouse-types"

/** Shown until an icon is uploaded for the shop group in the group editor. */
const fallbackIcons: Record<string, LucideIcon> = {
  cong: Sword,
  phep: WandSparkles,
  thu: Shield,
  "toc-chay": Footprints,
  "di-rung": Trees,
  "phu-tro": HeartHandshake,
}

export function ItemCategorySelect({
  label,
  categories,
  locale,
  value,
  onChange,
  allowEmpty = false,
}: {
  label: string
  categories: WarehouseMetadata[]
  locale: string
  value: string | null
  onChange: (code: string) => void
  allowEmpty?: boolean
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <span className="type-label">{label}</span>
      <Select
        value={value || (allowEmpty ? "__none__" : "")}
        onValueChange={(code) => onChange(code === "__none__" ? "" : code)}
      >
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue placeholder="Chọn nhóm" />
        </SelectTrigger>
        <SelectContent position="popper">
          {allowEmpty && <SelectItem value="__none__">Chưa chọn nhóm</SelectItem>}
          {value && !categories.some((category) => category.code === value) && (
            <SelectItem value={value}>{value}</SelectItem>
          )}
          {categories.map((category) => (
            <SelectItem key={category.code} value={category.code}>
              <span className="flex items-center gap-2">
                <ItemCategoryIcon category={category} />
                {warehouseText(category.translations, locale)?.name || category.code}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
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
