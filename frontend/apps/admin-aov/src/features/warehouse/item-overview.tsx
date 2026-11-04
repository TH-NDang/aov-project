import { useId, useState, type ReactNode } from "react"
import { Button } from "@aov/ui/components/button"
import { AdminRichTextPreview } from "../terminology/rich-text-field"
import { ItemCategoryIcon } from "./item-category-icon"
import { ItemRecipe, RecipeItemLabel } from "./item-recipe"
import {
  warehouseName,
  warehouseText,
  type ItemContent,
  type WarehouseEntry,
  type WarehouseMetadata,
} from "./warehouse-types"

export function ItemOverview({
  entry,
  items,
  relatedItems,
  pencil,
  onView,
  categories,
  locale,
}: {
  entry: WarehouseEntry<ItemContent>
  items: WarehouseEntry<ItemContent>[]
  relatedItems: WarehouseEntry<ItemContent>[]
  onView: (item: WarehouseEntry<ItemContent>) => void
  categories: WarehouseMetadata[]
  pencil?: (section: "stats" | "recipe" | "positions") => ReactNode
  locale: string
}) {
  const { content } = entry
  const [expanded, setExpanded] = useState(false)
  const upgradesId = useId()
  const text = warehouseText(content.translations, locale)
  const language = text?.locale ?? locale
  const upgrades = relatedItems.filter(
    (item) =>
      item.revision.state === "PUBLISHED" &&
      item.content.recipeStatus === "VERIFIED" &&
      item.content.components.some((part) => part.itemId === entry.id),
  )
  return (
    <>
      {text?.summary && (
        <div className="type-body">
          <AdminRichTextPreview text={text.summary} locale={language} />
        </div>
      )}
      {text?.description && text.description !== text.summary && (
        <div className="type-body">
          <AdminRichTextPreview text={text.description} locale={language} />
        </div>
      )}
      {(content.stats.length > 0 || pencil) && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="type-section-title">Chỉ số</h3>
            {pencil?.("stats")}
          </div>
          {!content.stats.length && <p className="type-meta">Chưa có chỉ số.</p>}
          <dl className="grid gap-x-6 sm:grid-cols-2">
            {content.stats.map((stat, index) => (
              <div key={index} className="flex items-baseline justify-between gap-2 border-b py-2">
                <dt className="text-sm">{text?.statLabels?.[stat.key] || stat.key}</dt>
                <dd className="text-sm font-semibold tabular-nums">
                  {stat.value > 0 && "+"}
                  {stat.value.toLocaleString(locale)}
                  {stat.unit === "PERCENT"
                    ? "%"
                    : stat.unit === "SECONDS"
                      ? " s"
                      : stat.unit === "POINT" || stat.unit === "FLAT"
                        ? ""
                        : stat.unit}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {!!text?.effects?.length && (
        <section className="space-y-2">
          <h3 className="type-section-title">Hiệu ứng</h3>
          {text.effects.map((effect) => (
            <div key={effect.key} className="space-y-1">
              <h4 className="text-sm font-semibold">{effect.name || effect.key}</h4>
              {effect.description && (
                <div className="type-body">
                  <AdminRichTextPreview text={effect.description} locale={language} />
                </div>
              )}
            </div>
          ))}
        </section>
      )}
      <ItemRecipe
        itemId={entry.id}
        content={content}
        items={items}
        locale={locale}
        onView={onView}
        action={pencil?.("recipe")}
      />
      {upgrades.length > 0 && (
        <section className="space-y-2">
          <h3 className="type-section-title">
            Dùng để ghép <span className="type-meta">({upgrades.length})</span>
          </h3>
          <ul id={upgradesId} className="grid gap-x-4 sm:grid-cols-2">
            {(expanded ? upgrades : upgrades.slice(0, 4)).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-label={`Xem ${warehouseName(item, locale)}`}
                  className="flex w-full min-w-0 items-center gap-2 rounded-md py-1.5 px-1 text-left hover:bg-accent"
                  onClick={() => onView(item)}
                >
                  <RecipeItemLabel item={item} locale={locale} />
                </button>
              </li>
            ))}
          </ul>
          {upgrades.length > 4 && (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={expanded}
              aria-controls={upgradesId}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Thu gọn" : `Xem thêm ${upgrades.length - 4} trang bị`}
            </Button>
          )}
        </section>
      )}
      {(content.shopPositions.length > 0 || pencil) && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="type-section-title">Vị trí trong shop</h3>
            {pencil?.("positions")}
          </div>
          {!content.shopPositions.length && <p className="type-meta">Chưa xếp vị trí.</p>}
          <ul className="flex flex-wrap gap-2">
            {content.shopPositions.map((position, i) => {
              const category = categories.find((group) => group.code === position.categoryCode)
              const groupName = category && warehouseText(category.translations, locale)?.name
              return (
                <li key={i} className="flex flex-wrap items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-xs">
                  <ItemCategoryIcon category={category} />
                  <span>{groupName || position.categoryCode || "Chưa xếp nhóm"}</span>
                  <span className="text-muted-foreground">
                    {[
                      position.column === null ? "Chưa xếp cột" : `Cột ${position.column + 1}`,
                      position.row === null ? "Chưa xếp hàng" : `Hàng ${position.row + 1}`,
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
