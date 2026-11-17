import { type CSSProperties } from "react"
import { useLocation, useSearchParams } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { PatchChangesRow } from "../../../components/patch-changes-row"
import { WikiIcon } from "../../../components/wiki-icon"
import { WikiVersionPicker } from "../../../components/wiki-version-picker"
import { useWikiContext, wikiText } from "../../../context/wiki-context"
import { CatalogHeading } from "../../../layout/catalog-heading"
import { HeroDetailLayout } from "../../../layout/wiki-library-layout"
import { heroAppearance } from "../model/hero-appearance"
import { HERO_POSITIONS, HERO_ROLES, localizedHeroOptions } from "../../../lib/hero-classifications"
import { HeroFilterChips } from "./hero-filter-chips"
import "./hero-card.css"
import "../pages/hero-directory.css"
import "../pages/hero-detail.css"
import "./hero-loading.css"

/** Enough cards to fill the first screens at every column count, in the grid and the card shape of the loaded list. */
const SKELETON_CARDS = 30

/** One card of a loading list, in the box and the lines of a loaded card. */
export function HeroCardSkeleton() {
  return (
    <div className="wiki-hero-card-cell" aria-hidden="true">
      <div className="wiki-hero-card wiki-hero-card-skeleton">
        <span className="wiki-hero-card-portrait wiki-skeleton" />
        <span className="wiki-hero-card-body">
          <span className="wiki-hero-card-name" />
          <span className="wiki-hero-card-roles" />
        </span>
      </div>
    </div>
  )
}

export function HeroGridSkeleton() {
  const { locale } = useWikiContext()
  return (
    <div
      className="wiki-hero-grid"
      aria-busy="true"
      role="status"
      aria-label={wikiText(locale, "Đang tải tướng", "Loading heroes")}
    >
      <span className="sr-only">{wikiText(locale, "Đang tải danh sách tướng…", "Loading the hero list…")}</span>
      {Array.from({ length: SKELETON_CARDS }, (_, index) => (
        <HeroCardSkeleton key={index} />
      ))}
    </div>
  )
}

/** The library while its code loads: the same head, controls and grid, so nothing moves when the list arrives. */
export function HeroDirectoryLoading() {
  const { locale } = useWikiContext()
  const [searchParams] = useSearchParams()
  const compact = usePageLayout() === "compact"
  const filtered = ["q", "role", "position"].some((key) => searchParams.has(key))
  const picker = <WikiVersionPicker />
  const searchBox = (
    <span className="wiki-hero-search">
      <WikiIcon name="search" size={18} />
    </span>
  )
  return (
    <div className="wiki-hero-directory">
      <CatalogHeading title={wikiText(locale, "Thư viện Tướng", "Hero library")} action={picker} />
      {compact ? (
        <>
          <div className="wiki-hero-toolbar-compact" aria-hidden="true">
            {searchBox}
            <span className="wiki-hero-filter-skeleton wiki-skeleton" />
          </div>
          <div className="wiki-hero-version">{picker}</div>
        </>
      ) : (
        <div className="wiki-hero-controls" aria-hidden="true" inert>
          {searchBox}
          <div className="wiki-hero-filter-groups">
            <HeroFilterChips
              label={wikiText(locale, "Vị trí", "Lane")}
              options={localizedHeroOptions(HERO_POSITIONS, locale)}
              selected={[]}
              onToggle={() => undefined}
            />
            <HeroFilterChips
              label={wikiText(locale, "Vai trò", "Role")}
              options={localizedHeroOptions(HERO_ROLES, locale)}
              selected={[]}
              onToggle={() => undefined}
            />
          </div>
        </div>
      )}
      <PatchChangesRow entries={[]} pending />
      <section>
        <header className="wiki-hero-list-heading">
          <h2>{filtered ? wikiText(locale, "Kết quả", "Results") : wikiText(locale, "Tất cả tướng", "All heroes")}</h2>
        </header>
        <HeroGridSkeleton />
      </section>
    </div>
  )
}

/**
 * A hero's page while it loads: the box of its opening, with shapes where the way back, the name and the first chips
 * will stand. Its styles are its own, because the page's stylesheets arrive with the page.
 */
export function HeroDetailLoading({ heroCode }: { heroCode?: string }) {
  const { locale } = useWikiContext()
  // The same way back the loaded page offers, so the header does not change when the hero arrives.
  const previous = (useLocation().state as { from?: unknown } | null)?.from
  const returnTo = typeof previous === "string" && /^\/hero(?:\?|$)/u.test(previous) ? previous : "/hero"
  const appearance = heroAppearance(heroCode || "")
  const style = {
    "--hero-accent": appearance.accent,
  } as CSSProperties

  return (
    <HeroDetailLayout meta={null} backTo={returnTo} style={style}>
      <section className="wiki-hero-loading" aria-busy="true" role="status">
        <span className="sr-only">{wikiText(locale, "Đang tải tướng…", "Loading hero…")}</span>
        <div className="wiki-hero-loading-art wiki-hero-art-skeleton wiki-skeleton" aria-hidden="true" />
        <div className="wiki-hero-loading-info" aria-hidden="true">
          <span className="wiki-hero-loading-back wiki-skeleton" />
          <div className="wiki-hero-loading-identity">
            <span className="wiki-hero-loading-head wiki-skeleton" />
            <span className="wiki-hero-title-skeleton wiki-skeleton" />
          </div>
          <span className="wiki-hero-loading-line wiki-skeleton" />
          <div className="wiki-hero-loading-chips">
            <span className="wiki-skeleton" />
            <span className="wiki-skeleton" />
            <span className="wiki-skeleton" />
          </div>
          <div className="wiki-hero-loading-chips" data-compact="">
            <span className="wiki-skeleton" />
            <span className="wiki-skeleton" />
          </div>
        </div>
      </section>
    </HeroDetailLayout>
  )
}
