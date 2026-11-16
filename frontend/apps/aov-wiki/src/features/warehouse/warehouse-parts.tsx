import type { ReactNode } from "react"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import type { ArcanaColor, WarehouseArcana } from "./use-item-catalog"
import { WarehouseArtwork } from "./warehouse-artwork"
import type { PublishedWarehouseRecord } from "./warehouse-types"

const ROMAN_TIERS = ["I", "II", "III"]
/** A tier as the game writes it. */
export const romanTier = (tier: number) => ROMAN_TIERS[tier - 1] ?? String(tier)

const ARCANA_COLOR_NAMES: Record<ArcanaColor, [string, string]> = {
  RED: ["Đỏ", "Red"],
  PURPLE: ["Tím", "Purple"],
  GREEN: ["Xanh", "Green"],
}

export function arcanaColorName(color: ArcanaColor, locale: string) {
  return wikiText(locale, ...ARCANA_COLOR_NAMES[color])
}

/** The game's own gem stands for its color, so the page needs no color of its own for it. */
export function ArcanaColorArt({ color, entries }: { color: ArcanaColor; entries: PublishedWarehouseRecord[] }) {
  const sample = entries
    .filter((entry): entry is WarehouseArcana => entry.kind === "arcana" && entry.content.color === color)
    .sort((a, b) => b.content.tier - a.content.tier || a.code.localeCompare(b.code))[0]
  return sample ? <WarehouseArtwork entry={sample} kind="arcana" className="wiki-warehouse-chip-art" /> : null
}

/** The heading of one group of a catalog: its name and how many entries it holds. */
export function GroupHeading({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="wiki-warehouse-heading">
      {title}
      <small>{count}</small>
    </h2>
  )
}

/** A group readers rarely need, kept to one line until they ask for it. */
export function FoldedGroup({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const { locale } = useWikiContext()
  return (
    <section className="wiki-warehouse-fold" data-open={open || undefined} aria-label={title}>
      <h2>
        <button type="button" aria-expanded={open} onClick={onToggle}>
          <WikiIcon name="chevronRight" size={18} />
          {title}
          <small>{count}</small>
          <span>{open ? wikiText(locale, "Thu gọn", "Collapse") : wikiText(locale, "Mở danh sách", "Expand")}</span>
        </button>
      </h2>
      {open && children}
    </section>
  )
}

export function EmptyGroup() {
  const { locale } = useWikiContext()
  return (
    <p className="wiki-warehouse-catalog-empty" role="status">
      {wikiText(locale, "Không có mục phù hợp với bộ lọc này.", "No entries match these filters.")}
    </p>
  )
}
