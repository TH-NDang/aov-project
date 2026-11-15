import { Link } from "react-router"
import type { PageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { useDragScroll } from "../../lib/use-drag-scroll"
import type { SkinEntry } from "./skin-api"
import { SkinIcon } from "./skin-icon"
import { HeroHead, SkinArtwork, SkinBadgeImage, skinId } from "./skin-preview"

export function SkinCard({
  skin,
  showHero = false,
  onOpen,
}: {
  skin: SkinEntry
  /** In a list that mixes heroes, each card names its own. */
  showHero?: boolean
  onOpen: (skin: SkinEntry) => void
}) {
  const { locale } = useWikiContext()
  return (
    <button
      type="button"
      className="wiki-skin-card"
      data-skin-card={skinId(skin)}
      aria-label={[`${wikiText(locale, "Xem", "View")} ${skin.name}`, skin.heroName, skin.badge?.name]
        .filter(Boolean)
        .join(" — ")}
      onClick={() => onOpen(skin)}
    >
      <SkinArtwork skin={skin} card />
      <SkinBadgeImage key={skin.badge?.icon?.currentVersion?.url} badge={skin.badge} />
      <span className="wiki-skin-card-caption">
        {showHero && <span className="wiki-skin-card-hero">{skin.heroName}</span>}
        <span className="wiki-skin-card-name">{skin.name}</span>
        {skin.unscopedBaseline && <small>{wikiText(locale, "Chưa rõ mốc", "Undated baseline")}</small>}
      </span>
    </button>
  )
}

/** One hero's skins under the hero's name. */
export function HeroSkinGroup({
  skins,
  layout,
  columns,
  whole,
  counted,
  expanded,
  onExpand,
  onCollapse,
  onOpen,
}: {
  skins: SkinEntry[]
  layout: PageLayout
  columns: number
  /** The only hero on the page shows every skin at once. */
  whole: boolean
  /** Off where the page already gives this very count. */
  counted: boolean
  expanded: boolean
  onExpand: () => void
  onCollapse: () => void
  onOpen: (skin: SkinEntry) => void
}) {
  const { locale, href } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const scroll = useDragScroll("horizontal")
  const hero = skins[0]
  const titleId = `skins-${hero.heroId}`
  const rowId = `skin-row-${hero.heroId}`
  // A phone swipes through a hero's skins; a wide row holds whole cards and folds the rest behind its last tile.
  const strip = layout === "compact" && !whole
  const foldable = !strip && !whole && skins.length > columns
  const shown = foldable && !expanded ? skins.slice(0, columns - 1) : skins
  const hidden = skins.length - shown.length

  return (
    <section className="wiki-skin-group" aria-labelledby={titleId}>
      <div className="wiki-skin-group-heading">
        <HeroHead skin={hero} />
        <h2 id={titleId}>{hero.heroName}</h2>
        {counted && (
          <span className="wiki-skin-group-count">
            {skins.length} {text("trang phục", skins.length === 1 ? "skin" : "skins")}
          </span>
        )}
        {whole ? (
          <Link
            className="wiki-skin-group-link"
            to={href(`/hero/${hero.heroCode}`)}
            aria-label={`${text("Xem tướng", "View hero")} ${hero.heroName}`}
          >
            {text("Xem tướng", "View hero")}
            {/* The heading beside it already names the hero where the row is short of room. */}
            {layout === "wide" && ` ${hero.heroName}`}
            <SkinIcon name="arrow" size={14} />
          </Link>
        ) : (
          foldable &&
          expanded && (
            <button
              type="button"
              className="wiki-skin-group-link"
              data-fold=""
              aria-expanded="true"
              aria-controls={rowId}
              onClick={onCollapse}
            >
              {text("Thu gọn", "Show less")}
              <SkinIcon name="chevron" size={16} />
            </button>
          )
        )}
      </div>
      <div
        id={rowId}
        className={strip ? "wiki-skin-strip" : "wiki-skin-grid"}
        ref={strip ? scroll.ref : undefined}
        {...(strip ? scroll.handlers : undefined)}
      >
        {shown.map((skin) => (
          <SkinCard key={skin.skinKey} skin={skin} onOpen={onOpen} />
        ))}
        {hidden > 0 && (
          <button
            type="button"
            className="wiki-skin-more"
            aria-expanded="false"
            aria-controls={rowId}
            aria-label={text(
              `Hiện thêm ${hidden} trang phục của ${hero.heroName}`,
              `Show ${hidden} more ${hidden === 1 ? "skin" : "skins"} of ${hero.heroName}`,
            )}
            onClick={onExpand}
          >
            <strong>+{hidden}</strong>
            <span>{text("trang phục khác", hidden === 1 ? "more skin" : "more skins")}</span>
            <SkinIcon name="chevron" size={18} />
          </button>
        )}
      </div>
    </section>
  )
}
