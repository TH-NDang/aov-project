import { useMemo, type CSSProperties } from "react"
import { useWikiContext } from "../../context/wiki-context"
import { isRetiredSpell, spellRows } from "./use-item-catalog"
import { CatalogShowcase, type ShowcaseIntro } from "../../components/catalog-showcase"
import { warehouseImage, type PublishedWarehouseRecord } from "../../lib/warehouse-types"
import "./warehouse-showcase-spells.css"

/**
 * The talents' head, drawn like a skill bar: every talent as a round button in a gilded ring, set in two staggered rows
 * that zigzag across the banner. A light runs along them from left to right, each button flaring as it passes, as a
 * talent lights up when it is ready to cast.
 */
export function SpellShowcase({ intro, entries }: { intro: ShowcaseIntro; entries: PublishedWarehouseRecord[] }) {
  const { locale } = useWikiContext()
  const talents = useMemo(
    () =>
      spellRows(entries, locale)
        .filter((entry) => !isRetiredSpell(entry))
        .flatMap((entry) => {
          const url = warehouseImage(entry)
          return url ? [{ key: entry.code, url }] : []
        }),
    [entries, locale],
  )
  const last = Math.max(1, talents.length - 1)
  return (
    <CatalogShowcase
      {...intro}
      scene={
        talents.length > 0 && (
          <div className="wiki-spell-bar" style={{ "--count": talents.length } as CSSProperties}>
            {talents.map((talent, index) => (
              <span
                key={talent.key}
                className="wiki-spell-bar-button"
                data-row={index % 2 === 0 ? "top" : "bottom"}
                style={{ "--x": `${(index * 100) / last}%`, "--i": index } as CSSProperties}
              >
                <img src={talent.url} alt="" decoding="async" />
              </span>
            ))}
          </div>
        )
      }
    />
  )
}
