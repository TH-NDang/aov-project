import { WikiIcon } from "../../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import type { HeroSort } from "../model/hero-order"
import "./hero-sort-select.css"

const SORT_LABELS: Record<HeroSort, readonly [string, string]> = {
  name: ["Tên A–Z", "Name A–Z"],
  difficulty: ["Độ khó", "Difficulty"],
  tier: ["Bậc", "Tier"],
  winRate: ["Tỉ lệ thắng", "Win rate"],
}

/**
 * The order of the library, as the phone's own picker where there is one. Only the orders the data can fill are
 * offered, and the control is left out while the name is the only one.
 */
export function HeroSortSelect({
  sorts,
  sort,
  onChange,
}: {
  sorts: readonly HeroSort[]
  sort: HeroSort
  onChange: (sort: HeroSort) => void
}) {
  const { locale } = useWikiContext()
  if (sorts.length < 2) return null
  return (
    <label className="wiki-hero-sort">
      <span>{wikiText(locale, "Xếp theo", "Sort by")}</span>
      <select value={sort} onChange={(event) => onChange(event.target.value as HeroSort)}>
        {sorts.map((value) => (
          <option key={value} value={value}>
            {wikiText(locale, ...SORT_LABELS[value])}
          </option>
        ))}
      </select>
      <WikiIcon name="chevron" size={16} />
    </label>
  )
}
