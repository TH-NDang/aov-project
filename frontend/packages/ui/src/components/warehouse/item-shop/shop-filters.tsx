import { ImageOff } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { warehouseText, type WarehouseMetadata } from "@aov/ui/lib/warehouse-content"
import { Button } from "@aov/ui/components/button"
import { FilterTab, FilterTabs } from "@aov/ui/components/filter-tabs"
import { useWarehouseText } from "../warehouse-view"
import { ItemCategoryIcon } from "../item-category-icon"
import type { Entry } from "./shop-geometry"

/** The row above the board: the item categories with their counts, the items still without an icon and the branch. */
export function ShopFilters({
  items,
  categories,
  locale,
  category,
  matches,
  editable,
  missingIcons,
  variants,
  variant,
  onCategory,
  onVariant,
  onSelect,
}: {
  items: Entry[]
  categories: WarehouseMetadata[]
  locale: string
  category: string
  matches: ReadonlySet<string> | null
  editable: boolean
  missingIcons: Entry[]
  variants: string[]
  variant: string
  onCategory: (code: string) => void
  onVariant: (variant: string) => void
  onSelect: (id: string) => void
}) {
  const t = useWarehouseText()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterTabs label={t("Nhóm trang bị", "Item categories")}>
        {categories.map((group) => {
          const count = items.filter(
            (item) =>
              (!matches || matches.has(item.id)) &&
              item.content.shopPositions.some((position) => position.categoryCode === group.code),
          ).length
          const active = category === group.code
          return (
            <FilterTab
              key={group.code}
              active={active}
              count={count}
              title={
                matches
                  ? t(
                      `${count} món khớp tìm kiếm`,
                      `${count} ${count === 1 ? "item matches" : "items match"} the search`,
                    )
                  : undefined
              }
              className={cn("[&_svg]:size-5", matches && !count && !active && "opacity-50")}
              onClick={() => onCategory(group.code)}
            >
              <ItemCategoryIcon category={group} />
              {warehouseText(group.translations, locale)?.name || group.code}
            </FilterTab>
          )
        })}
      </FilterTabs>
      <span className="flex-1" />
      {editable && missingIcons.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-amber-700 dark:text-amber-300"
          title={t("Mở món đầu tiên chưa có biểu tượng", "Open the first item without an icon")}
          onClick={() => onSelect(missingIcons[0].id)}
        >
          <ImageOff className="size-4" />
          {missingIcons.length}{" "}
          {t("món thiếu biểu tượng", missingIcons.length === 1 ? "item without an icon" : "items without an icon")}
        </Button>
      )}
      {!!variants.length && (
        <select
          aria-label={t("Nhánh trang bị", "Item branch")}
          className="w-auto rounded-md border bg-background px-3 py-2 text-sm"
          value={variant}
          onChange={(event) => onVariant(event.target.value)}
        >
          <option value="">{t("Mọi nhánh", "All branches")}</option>
          {variants.map((v) => (
            <option key={v} value={v}>
              {items
                .map((item) => warehouseText(item.content.translations, locale)?.variantLabels?.[v])
                .find(Boolean) || v}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
