import { useId, useState, type ReactNode } from "react"
import { useWarehouseText, WarehouseAsset } from "./warehouse-view"
import { warehouseName, type ItemContent, type WarehouseEntry } from "@aov/ui/lib/warehouse-content"
import { cn } from "@aov/ui/lib/utils"

type Item = WarehouseEntry<ItemContent>
export const recipeStatusNames = { UNKNOWN: "Chưa xác nhận", NONE: "Không cần ghép", VERIFIED: "Đã xác nhận" }

const MAX_DEPTH = 3
const UPGRADES_SHOWN = 6

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

function ItemNode<E extends Item>({
  item,
  quantity = 1,
  locale,
  onView,
}: {
  item?: E
  quantity?: number
  locale: string
  onView?: (item: E) => void
}) {
  const t = useWarehouseText()
  const body = (
    <>
      <RecipeItemLabel item={item} locale={locale} />
      {quantity > 1 && <span className="text-sm tabular-nums">×{quantity}</span>}
    </>
  )
  const frame = "flex w-full min-w-0 items-center gap-2 rounded-md px-1 py-0.5"
  return item && onView ? (
    <button
      type="button"
      aria-label={`${t("Xem", "View")} ${warehouseName(item, locale)}`}
      className={cn(frame, "cursor-pointer text-left hover:bg-accent")}
      onClick={() => onView(item)}
    >
      {body}
    </button>
  ) : (
    <div className={frame}>{body}</div>
  )
}

/** Ingredients as a tree, so the whole path from the cheapest parts up is readable at once. */
function RecipeTree<E extends Item>({
  content,
  byId,
  locale,
  onView,
  depth = 0,
}: {
  content: ItemContent
  byId: ReadonlyMap<string, E>
  locale: string
  onView?: (item: E) => void
  depth?: number
}) {
  return (
    <ul className={cn("space-y-0.5", depth > 0 && "ml-5 border-l pl-2")}>
      {content.components.map(({ itemId, quantity }) => {
        const item = byId.get(itemId)
        return (
          <li key={itemId}>
            <ItemNode item={item} quantity={quantity} locale={locale} onView={onView} />
            {item && !!item.content.components.length && depth + 1 < MAX_DEPTH && (
              <RecipeTree content={item.content} byId={byId} locale={locale} onView={onView} depth={depth + 1} />
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** What the item is built from and what it can become, with the gold still to pay once the parts are owned. */
export function ItemRecipeView<E extends Item>({
  content,
  items,
  upgrades = [],
  locale,
  onView,
  action,
  showStatus = false,
}: {
  content: ItemContent
  items: E[]
  upgrades?: E[]
  locale: string
  onView?: (item: E) => void
  action?: ReactNode
  /** Editors track whether the recipe has been checked; readers only need to hear about it when it has not. */
  showStatus?: boolean
}) {
  const t = useWarehouseText()
  const [expanded, setExpanded] = useState(false)
  const upgradesId = useId()
  const byId = new Map(items.map((item) => [item.id, item]))
  const total = content.components.reduce<number | null>((sum, part) => {
    const price = byId.get(part.itemId)?.content.price
    return sum === null || price == null ? null : sum + price * part.quantity
  }, 0)
  const fee = content.price != null && total !== null && total <= content.price ? content.price - total : null
  const hasParts = content.components.length > 0
  const unconfirmed = content.recipeStatus === "UNKNOWN"
  const gold = (amount: number) => `${amount.toLocaleString(locale)} ${t("vàng", "gold")}`
  const shown = expanded ? upgrades : upgrades.slice(0, UPGRADES_SHOWN)
  return (
    <>
      {(hasParts || showStatus || action || unconfirmed) && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="type-section-title">{t("Ghép từ", "Builds from")}</h3>
            {(showStatus || action) && (
              <div className="flex items-center gap-2">
                {showStatus && (
                  <span className="type-meta">
                    {t(
                      recipeStatusNames[content.recipeStatus],
                      { UNKNOWN: "Unconfirmed", NONE: "No recipe", VERIFIED: "Verified" }[content.recipeStatus],
                    )}
                  </span>
                )}
                {action}
              </div>
            )}
          </div>
          {hasParts ? (
            <>
              <RecipeTree content={content} byId={byId} locale={locale} onView={onView} />
              {total === null ? (
                <p className="type-meta">
                  {t("Chưa đủ giá nguyên liệu để tính tổng.", "Ingredient prices are incomplete.")}
                </p>
              ) : (
                <p className="type-meta">
                  {t("Nguyên liệu", "Ingredients")} {gold(total)}
                  {fee !== null && (
                    <>
                      {" · "}
                      {t("Phí ghép", "Build fee")} {gold(fee)}
                    </>
                  )}
                </p>
              )}
            </>
          ) : (
            unconfirmed && (
              <p className="type-meta">{t("Chưa xác nhận công thức ghép.", "The recipe is unconfirmed.")}</p>
            )
          )}
        </section>
      )}
      {upgrades.length > 0 && (
        <section className="space-y-2">
          <h3 className="type-section-title">
            {t("Nâng cấp thành", "Builds into")} <span className="type-meta">({upgrades.length})</span>
          </h3>
          <ul id={upgradesId} className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-x-3 gap-y-0.5">
            {shown.map((item) => (
              <li key={item.id}>
                <ItemNode item={item} locale={locale} onView={onView} />
              </li>
            ))}
          </ul>
          {upgrades.length > UPGRADES_SHOWN && (
            <button
              type="button"
              className="type-meta cursor-pointer underline underline-offset-2"
              aria-expanded={expanded}
              aria-controls={upgradesId}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded
                ? t("Thu gọn", "Collapse")
                : t(
                    `Xem thêm ${upgrades.length - UPGRADES_SHOWN} trang bị`,
                    `Show ${upgrades.length - UPGRADES_SHOWN} more`,
                  )}
            </button>
          )}
        </section>
      )}
    </>
  )
}

/** A short list of other items worth comparing against the one on screen. */
export function ItemSimilarList<E extends Item>({
  title,
  items,
  locale,
  onView,
}: {
  title: string
  items: E[]
  locale: string
  onView?: (item: E) => void
}) {
  if (!items.length) return null
  return (
    <section className="space-y-2">
      <h3 className="type-section-title">{title}</h3>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-x-3 gap-y-0.5">
        {items.map((item) => (
          <li key={item.id}>
            <ItemNode item={item} locale={locale} onView={onView} />
          </li>
        ))}
      </ul>
    </section>
  )
}
