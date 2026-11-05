import { useWarehouseText } from "./warehouse-view"
import type { ReactNode } from "react"
import { WarehouseAsset } from "./warehouse-view"
import { warehouseName, type ItemContent, type WarehouseEntry } from "@aov/ui/lib/warehouse-content"
type Item = WarehouseEntry<ItemContent>
export const recipeStatusNames = { UNKNOWN: "Chưa xác nhận", NONE: "Không cần ghép", VERIFIED: "Đã xác nhận công thức" }
export function RecipeItemLabel({ item, locale }: { item?: Item; locale: string }) {
  const t = useWarehouseText()
  return (
    <>
      <WarehouseAsset id={item?.content.iconAssetId} className="size-9 shrink-0 rounded-md" frameAspectRatio={1} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium">
          {item ? warehouseName(item, locale) : t("Nguyên liệu chưa tải được", "Ingredient unavailable")}
        </span>
        {item?.content.price != null && (
          <span className="type-meta block">
            {item.content.price.toLocaleString(locale)} {t("vàng", "gold")}
          </span>
        )}
      </span>
    </>
  )
}

export function ItemRecipeView<E extends Item>({
  content,
  items,
  locale,
  onView,
  action,
}: {
  content: ItemContent
  items: E[]
  locale: string
  onView?: (item: E) => void
  action?: ReactNode
}) {
  const t = useWarehouseText()
  const rows = content.components.map((part) => ({ ...part, item: items.find((item) => item.id === part.itemId) }))
  const total = rows.reduce<number | null>(
    (sum, row) =>
      sum === null || row.item?.content.price == null ? null : sum + row.item.content.price * row.quantity,
    0,
  )
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="type-section-title">{t("Công thức trực tiếp", "Direct recipe")}</h3>
        <div className="flex items-center gap-2">
          <span className="type-meta">
            {t(
              recipeStatusNames[content.recipeStatus],
              { UNKNOWN: "Unconfirmed", NONE: "No recipe", VERIFIED: "Verified" }[content.recipeStatus],
            )}
          </span>
          {action}
        </div>
      </div>
      {rows.map(({ itemId, item, quantity }) => (
        <div key={itemId} className="flex min-w-0 items-center gap-2 border-b py-1.5">
          {item && onView ? (
            <button
              type="button"
              aria-label={`${t("Xem", "View")} ${warehouseName(item, locale)}`}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left hover:bg-accent"
              onClick={() => onView(item)}
            >
              <RecipeItemLabel item={item} locale={locale} />
            </button>
          ) : (
            <RecipeItemLabel item={item} locale={locale} />
          )}
          <span className="text-sm tabular-nums">×{quantity}</span>
        </div>
      ))}
      {!!rows.length && (
        <p className="type-meta">
          {total === null
            ? t("Chưa đủ giá nguyên liệu để tính tổng.", "Ingredient prices are incomplete.")
            : t(
                `Tổng giá nguyên liệu · ${total.toLocaleString(locale)} vàng`,
                `Total ingredient cost · ${total.toLocaleString(locale)} gold`,
              )}
        </p>
      )}
    </section>
  )
}
