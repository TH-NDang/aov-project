import { ItemPrice } from "@aov/ui/components/warehouse/item-price"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { WarehouseArtwork } from "./warehouse-artwork"
import { warehouseName, type PublishedWarehouseRecord } from "./warehouse-types"

type Item = Extract<PublishedWarehouseRecord, { kind: "items" }>

export function WarehouseRecipe({
  entry,
  items,
  upgrades,
  onSelect,
}: {
  entry: Item
  items: Item[]
  upgrades: Item[]
  onSelect: (item: Item) => void
}) {
  const { locale } = useWikiContext()
  const t = (vi: string, en: string) => wikiText(locale, vi, en)
  const parts = entry.content.recipeStatus === "VERIFIED" ? entry.content.components : []
  const byId = new Map(items.map((item) => [item.id, item]))
  const total = parts.reduce<number | null>((sum, part) => {
    const price = byId.get(part.itemId)?.content.price
    return sum == null || price == null ? null : sum + price * part.quantity
  }, 0)
  if (!parts.length && !upgrades.length)
    return entry.content.recipeStatus === "UNKNOWN" ? (
      <p className="type-meta">{t("Chưa xác nhận công thức ghép.", "The recipe is unconfirmed.")}</p>
    ) : null
  const groups = [
    {
      label: t("Ghép từ", "Builds from"),
      nodes: parts.map((part) => ({ id: part.itemId, item: byId.get(part.itemId), quantity: part.quantity })),
    },
    { label: t("Đang xem", "Selected"), nodes: [{ id: entry.id, item: entry, quantity: 1 }] },
    { label: t("Ghép thành", "Builds into"), nodes: upgrades.map((item) => ({ id: item.id, item, quantity: 1 })) },
  ]
  const tiers = [
    ...new Set([1, 2, 3, ...groups.flatMap((group) => group.nodes.map(({ item }) => item?.content.tier ?? 0))]),
  ].sort((a, b) => (a || Infinity) - (b || Infinity))
  function node(item: Item | undefined, quantity = 1) {
    if (!item)
      return (
        <span className="type-meta">
          {t("Nguyên liệu chưa tải được", "Ingredient unavailable")} ×{quantity}
        </span>
      )
    const name = warehouseName(item, locale)
    const body = (
      <>
        <span className="wiki-recipe-art">
          <WarehouseArtwork entry={item} kind="items" />
          {item.content.price != null && <ItemPrice amount={item.content.price} locale={locale} badge />}
        </span>
        <span>
          {name}
          {quantity > 1 && <b className="ml-1">×{quantity}</b>}
        </span>
      </>
    )
    return item.id === entry.id ? (
      <span className="wiki-recipe-node current">{body}</span>
    ) : (
      <button className="wiki-recipe-node" type="button" onClick={() => onSelect(item)}>
        {body}
      </button>
    )
  }
  return (
    <section className="space-y-2" aria-label={t("Công thức ghép", "Build recipe")}>
      <h3 className="type-section-title">{t("Công thức ghép", "Build recipe")}</h3>
      <div className="wiki-recipe-tree">
        {tiers.map((tier) => (
          <div key={tier} className="wiki-recipe-column">
            <h4 className="type-label">
              {tier ? `${t("Cấp", "Tier")} ${["I", "II", "III"][tier - 1] ?? tier}` : t("Chưa rõ cấp", "Tier unknown")}
            </h4>
            <div>
              {groups.map((group) => {
                const members = group.nodes.filter(({ item }) => (item?.content.tier ?? 0) === tier)
                return (
                  members.length > 0 && (
                    <div key={group.label} className="space-y-1">
                      <h5 className="type-meta">{group.label}</h5>
                      <ul className="space-y-1">
                        {members.map(({ id, item, quantity }) => (
                          <li key={id}>{node(item, quantity)}</li>
                        ))}
                      </ul>
                    </div>
                  )
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {parts.length > 0 && total != null && (
        <p className="mt-2 type-meta">
          {t("Tổng giá nguyên liệu", "Ingredient cost")} · <ItemPrice amount={total} locale={locale} />
        </p>
      )}
    </section>
  )
}
