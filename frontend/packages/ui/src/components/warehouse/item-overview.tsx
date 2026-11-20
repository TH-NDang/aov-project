import { useWarehouseText } from "./warehouse-view"
import type { ReactNode } from "react"

import { ItemCategoryIcon } from "./item-category-icon"
import { ItemPassiveList, ItemStatList } from "./item-facts"
import { ItemRecipeView } from "./item-recipe"
import { itemReaderContent } from "@aov/ui/lib/item-description"
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
  // A reader sees the summary as the item's tags; the editor keeps it as the line it edits.
  const tags = readerView ? (text?.summary ?? "").split(/s*[,;]s*/).filter(Boolean) : []
  const description = text?.description?.trim()
  return (
    <>
      {readerView && tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("Đặc điểm", "Traits")}>
          {tags.map((tag) => (
            <li
              key={tag}
              className="type-meta rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-foreground"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
      {!readerView && text?.summary && (
        <div className="type-body text-muted-foreground">{renderText(text.summary, language)}</div>
      )}
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
          <h3 className="type-section-title">
            {reading.passives.every((passive) => passive.active)
              ? t("Kích hoạt", "Active effects")
              : reading.passives.some((passive) => passive.active)
                ? t("Nội tại và kích hoạt", "Passives and actives")
                : t("Nội tại", "Passives")}
          </h3>
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
      {/* The game's own wording, line for line, so nothing is lost to the split into stats and effects above. */}
      {readerView && description && (
        <section className="space-y-2">
          <h3 className="type-section-title">{t("Mô tả trong game", "In-game description")}</h3>
          <div className="type-body rounded-lg border-l-2 border-primary/40 bg-muted/20 px-3 py-2 whitespace-pre-line text-muted-foreground">
            {renderText(description, language)}
          </div>
        </section>
      )}
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
