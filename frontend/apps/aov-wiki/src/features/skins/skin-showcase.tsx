import { useMemo, type ReactNode } from "react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { CatalogShowcase } from "../../components/catalog-showcase"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
import { dailySpread } from "../../lib/daily-spread"
import { sizedImageSources } from "../../lib/sized-image"
import type { SkinEntry } from "../../lib/skin-api"
import { skinTierRank } from "../../lib/skin-groups"
import "./skin-showcase.css"

/** The skins beside the cover: the next ones of today's pick, as small cards. */
const BESIDE = 4

/** Today's skins come from this many top ranks, so the cover always shows the collection's finest. */
const TOP_RANKS = 2

/**
 * The head of the skin collection, laid out like a magazine cover: today's featured skin fills the banner with its
 * splash art, slowly drawing closer, and the title stands at its foot. On wide screens four more skins of the day stand
 * as small cards along the right edge, and a line at the foot names the featured skin and opens it. The pick changes
 * every day. The data version stands in the corner, as on the hero library.
 */
export function SkinShowcase({
  skins,
  count,
  version,
  onOpen,
}: {
  skins?: readonly SkinEntry[]
  count?: number
  version?: ReactNode
  onOpen?: (skin: SkinEntry) => void
}) {
  const text = useWikiText()
  const { locale } = useWikiContext()
  const wide = usePageLayout() === "wide"
  const [featured, ...beside] = useMemo(() => todaysSkins(skins ?? []), [skins])
  const art = featured?.art?.currentVersion?.url ?? featured?.portrait?.currentVersion?.url
  return (
    <CatalogShowcase
      title={text("Trang phục", "Skins")}
      count={
        count ? text(`${count.toLocaleString(locale)} trang phục`, `${count.toLocaleString(locale)} skins`) : undefined
      }
      wide={wide}
      corner={version}
      align="bottom"
      scene={
        featured &&
        art && (
          <div className="wiki-skin-cover">
            <img
              key={art}
              className="wiki-skin-cover-art"
              {...picture(art, wide ? 1100 : 480)}
              alt=""
              decoding="async"
            />
            {wide && (
              <div className="wiki-skin-cover-beside">
                {beside.map((skin, index) => (
                  <span
                    key={skin.skinKey}
                    className="wiki-skin-cover-card"
                    style={{ animationDelay: `${index * 90}ms` }}
                  >
                    <img {...picture(skin.portrait!.currentVersion!.url, 72)} alt="" loading="lazy" decoding="async" />
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      }
      note={
        featured &&
        onOpen && (
          <button type="button" className="wiki-skin-cover-note" onClick={() => onOpen(featured)}>
            <span>{text("Nổi bật hôm nay", "Today's pick")}</span>
            <strong>{featured.name}</strong>
            <span>{featured.heroName}</span>
          </button>
        )
      }
    />
  )
}

/** An image's sources at the width it is drawn; the full-size fallback stays off the element. */
function picture(url: string, width: number) {
  const { src, srcSet } = sizedImageSources(url, width)
  return { src, srcSet }
}

/** Days since the epoch in the reader's zone, so the pick changes at their midnight. */
function dayNumber() {
  const now = new Date()
  return Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000)
}

/** Today's skins: the featured one first, then the ones beside it, all of the top ranks and with a portrait. */
function todaysSkins(skins: readonly SkinEntry[]) {
  const pictured = skins.filter((skin) => skin.portrait?.currentVersion?.url)
  const ranks = [...new Set(pictured.map((skin) => skinTierRank(skin.rarityCode ?? skin.badge?.code)))]
    .filter((rank) => rank >= 0)
    .sort((a, b) => b - a)
    .slice(0, TOP_RANKS)
  const finest = pictured.filter((skin) => ranks.includes(skinTierRank(skin.rarityCode ?? skin.badge?.code)))
  const pool = finest.length > BESIDE ? finest : pictured
  return dailySpread(pool.length, dayNumber(), BESIDE + 1).map((index) => pool[index]!)
}
