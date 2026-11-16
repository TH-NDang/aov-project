import { useWarehouseText } from "./warehouse-view"
import { useMemo, type ReactNode } from "react"

import { ItemCategoryIcon } from "./item-category-icon"
import { ItemPassiveList, ItemStatList } from "./item-facts"
import { ItemRecipeView, ItemSimilarList } from "./item-recipe"
import { itemProfile, itemReaderContent, similarItems } from "@aov/ui/lib/item-description"
import {
  warehouseText,
  type ItemContent,
  type WarehouseEntry,
  type WarehouseMetadata,
} from "@aov/ui/lib/warehouse-content"

export function ItemOverview<E extends WarehouseEntry<ItemContent>>({
  renderText,
  entry,
  items,
  relatedItems,
  pencil,
  onView,
  categories,
  locale,
  readerView = false,
}: {
  renderText: (value: string, locale: string) => ReactNode
  entry: E
  items: E[]
  relatedItems: E[]
  onView: (item: E) => void
  categories: WarehouseMetadata[]
  pencil?: (section: "stats" | "recipe" | "positions") => ReactNode
  locale: string
  readerView?: boolean
}) {
  const t = useWarehouseText()
  const { content } = entry
  const text = warehouseText(content.translations, locale)
  const language = text?.locale ?? locale
  const reading = itemReaderContent(content, text, locale)
  const hasEffects = reading.passives.length > 0 || reading.notes.length > 0
  const upgrades = relatedItems.filter(
    (item) =>
      item.revision.state === "PUBLISHED" &&
      item.content.recipeStatus === "VERIFIED" &&
      item.content.components.some((part) => part.itemId === entry.id),
  )
  const similar = useMemo(() => {
    if (!readerView) return []
    // Items already listed as ingredients or upgrades have a place of their own on the page.
    const listed = new Set(content.components.map((part) => part.itemId))
    for (const item of relatedItems)
      if (item.content.components.some((part) => part.itemId === entry.id)) listed.add(item.id)
    return similarItems(
      entry,
      relatedItems.filter((item) => !listed.has(item.id)),
      (item) => {
        const itemText = warehouseText(item.content.translations, locale)
        return itemProfile(itemReaderContent(item.content, itemText, locale), {
          summary: itemText?.summary,
          category: item.content.categoryCode,
        })
      },
    )
  }, [readerView, entry, content.components, relatedItems, locale])
  return (
    <>
      {text?.summary && <div className="type-body text-muted-foreground">{renderText(text.summary, language)}</div>}
      {(reading.stats.length > 0 || pencil) && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="type-section-title">{t("Chỉ số", "Stats")}</h3>
            {pencil?.("stats")}
          </div>
          {!reading.stats.length && <p className="type-meta">{t("Chưa có chỉ số.", "No stats yet.")}</p>}
          <ItemStatList stats={reading.stats} locale={locale} />
          {pencil && !content.stats.length && reading.stats.length > 0 && (
            <p className="type-meta">
              {t(
                "Đang đọc từ mô tả, chưa lưu thành chỉ số có cấu trúc.",
                "Read from the description; not saved as structured stats yet.",
              )}
            </p>
          )}
        </section>
      )}
      {hasEffects && (
        <section className="space-y-2">
          <h3 className="type-section-title">{t("Hiệu ứng", "Effects")}</h3>
          <ItemPassiveList content={reading} renderText={renderText} language={language} />
        </section>
      )}
      <ItemRecipeView
        content={content}
        items={items}
        upgrades={upgrades}
        locale={locale}
        onView={onView}
        showStatus={!readerView}
        action={pencil?.("recipe")}
      />
      <ItemSimilarList title={t("Món cùng kiểu", "Similar items")} entries={similar} locale={locale} onView={onView} />
      {!readerView && (content.shopPositions.length > 0 || pencil) && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="type-section-title">{t("Vị trí trong cửa hàng", "Shop positions")}</h3>
            {pencil?.("positions")}
          </div>
          {!content.shopPositions.length && (
            <p className="type-meta">{t("Chưa xếp vị trí.", "No shop position yet.")}</p>
          )}
          <ul className="flex flex-wrap gap-2">
            {content.shopPositions.map((position, i) => {
              const category = categories.find((group) => group.code === position.categoryCode)
              const groupName = category && warehouseText(category.translations, locale)?.name
              return (
                <li key={i} className="flex flex-wrap items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-sm">
                  <ItemCategoryIcon category={category} />
                  <span>{groupName || position.categoryCode || t("Chưa xếp nhóm", "No category yet")}</span>
                  <span className="text-muted-foreground">
                    {[
                      position.column === null
                        ? t("Chưa xếp cột", "No column yet")
                        : `${t("Cột", "Column")} ${position.column + 1}`,
                      position.row === null
                        ? t("Chưa xếp hàng", "No row yet")
                        : `${t("Hàng", "Row")} ${position.row + 1}`,
                      position.variant && (text?.variantLabels?.[position.variant] || position.variant),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}
