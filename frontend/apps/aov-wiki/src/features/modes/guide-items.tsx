import { useState, type CSSProperties } from "react"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { foldText } from "./auto-chess-model"
import { ModeHeading } from "./mode-ui"
import { GuideText, type GuideIndex } from "./guide-ui"

/**
 * The game sorts items by the color of their stone (yellow-green, blue, gold, red); the group name says which. The
 * stone is part of the game's artwork, so its colors live here.
 */
function stoneColor(code: string, name: string) {
  const key = foldText(`${code} ${name}`)
  // "xanh lam" contains "xanh la", so blue is checked first.
  if (key.includes("xanh lam") || key.includes("xanh duong")) return "#3fa2f0"
  if (key.includes("xanh la")) return "#a9c63b"
  if (key.includes("vang")) return "#f0b232"
  if (key.includes("do")) return "#e2474b"
  return "#9aa4b2"
}

const stoneStyle = (group: { code: string; name: string }) =>
  ({ "--stone-color": stoneColor(group.code, group.name) }) as CSSProperties

/** The stone of an item group: its picture when there is one, else a diamond in its color. */
function StoneMark({
  group,
  index,
  size = 24,
}: {
  group: { iconAssetId?: string | null }
  index: GuideIndex
  size?: number
}) {
  const src = index.image(group.iconAssetId)
  return src ? (
    <img className="item-stone-icon" src={src} alt="" width={size} height={size} />
  ) : (
    <i className="item-stone" aria-hidden="true" />
  )
}

/** Items by stone: a chip per stone filters the groups; each item reads as a row with its icon and effect. */
export function ItemsTab({ index }: { index: GuideIndex }) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const { itemGroups, items } = index.content
  const [stone, setStone] = useState<string | null>(null)
  const groups: { code: string; name: string; iconAssetId?: string | null }[] = [
    ...itemGroups,
    ...(items.some((item) => !item.groupCode) ? [{ code: "", name: text("Khác", "Other") }] : []),
  ]
  const entriesOf = (code: string) =>
    items.filter((item) => (item.groupCode ?? "") === code).sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99))
  // A chip drops the group words from the name and keeps only the stone color.
  const shortName = (name: string) => {
    const short = name.replace(/^nhóm\s+/iu, "").replace(/^đá\s+/iu, "")
    return short.charAt(0).toLocaleUpperCase("vi") + short.slice(1)
  }
  return (
    <section className="guide-tab-body" aria-label={text("Trang bị", "Equipment")}>
      <div className="guide-toolbar">
        <div className="mode-chip-row" role="group" aria-label={text("Nhóm trang bị", "Equipment groups")}>
          {groups.map((group) => (
            <button
              key={group.code}
              type="button"
              className="mode-chip stone-chip"
              style={stoneStyle(group)}
              aria-pressed={stone === group.code}
              onClick={() => setStone(stone === group.code ? null : group.code)}
            >
              <StoneMark group={group} index={index} size={20} />
              {shortName(group.name)}
              <small>{entriesOf(group.code).length}</small>
            </button>
          ))}
        </div>
      </div>
      {groups
        .filter((group) => stone === null || group.code === stone)
        .map((group) => {
          const entries = entriesOf(group.code)
          return (
            <section
              key={group.code}
              className="mode-section"
              style={stoneStyle(group)}
              aria-labelledby={`item-group-${group.code}`}
            >
              <ModeHeading
                id={`item-group-${group.code}`}
                title={group.name}
                count={entries.length}
                icon={<StoneMark group={group} index={index} />}
              />
              {entries.length ? (
                <ul className="guide-entries" data-columns="2">
                  {entries.map((item) => {
                    const icon = index.image(item.iconAssetId)
                    return (
                      <li key={item.code} className="guide-entry item-entry">
                        {icon ? <img className="guide-icon" src={icon} alt="" loading="lazy" /> : <span />}
                        <div>
                          <h3>{item.name}</h3>
                          {item.effect && (
                            <p>
                              <GuideText text={item.effect} />
                            </p>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mode-meta">
                  {text(
                    "Chưa có trang bị nào của nhóm này trong bản đã thu thập.",
                    "No items of this group in the collected edition yet.",
                  )}
                </p>
              )}
            </section>
          )
        })}
    </section>
  )
}
