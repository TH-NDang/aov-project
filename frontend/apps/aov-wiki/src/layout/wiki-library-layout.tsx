import { type CSSProperties, type ReactNode } from "react"
import { Outlet, useLocation, useMatch } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { LibraryNavigation } from "../components/library-navigation"
import { WikiHeader } from "../components/wiki-header"
import { warehouseKind } from "../lib/warehouse-types"
import { SECTION_NAMES } from "../lib/wiki-sections"
import "./wiki-library-layout.css"
import { useWikiContext, useWikiText } from "../context/wiki-context"
import { libraryPageMeta, type PageMeta } from "../lib/seo/page-meta"
import { usePageHead } from "../lib/seo/use-page-head"

/**
 * The frame of every list and reference page: the header, then on wide screens a sidebar with every section beside the
 * page. The compact layout reaches the sections from the contents button in its header.
 */
export function WikiLibraryLayout() {
  const { locale } = useWikiContext()
  const t = useWikiText()
  const layout = usePageLayout()
  const { pathname } = useLocation()
  const isWarehouse = useMatch("/warehouse/*")
  const isSkins = useMatch("/skins")
  const isUpdates = useMatch("/updates/*")
  const isTerms = useMatch("/terms/*")
  const isModes = useMatch("/modes/*")
  const isModeDetail = useMatch("/modes/:code/*")
  const isPatchDetail = useMatch("/updates/:patchCode")
  const active = isModes
    ? "modes"
    : isTerms
      ? "terms"
      : isUpdates
        ? "updates"
        : isWarehouse
          ? warehouseKind(pathname.split("/")[2] ?? null)
          : isSkins
            ? "skins"
            : "heroes"
  const pageTitle = t(...SECTION_NAMES[active])
  usePageHead(libraryPageMeta(pathname, locale))

  return (
    <div className="wiki-library-shell">
      {/* On phones the bar starts clear on every page of the library, over a catalog's scene or the page itself, and
          frosts as the page scrolls. */}
      {/* On phones a mode's page keeps the buttons drawn for artwork, on a bar that is solid from the first pixel. */}
      {/* One mode or one update names itself in its own h1; the header then only says which section it belongs to. */}
      <WikiHeader
        variant={layout === "compact" && isModeDetail ? "hero" : "library"}
        solid={Boolean(isModeDetail)}
        clear={layout === "compact" && !isModeDetail}
        pageTitle={pageTitle}
        pageTitleIsHeading={!isModeDetail && !isPatchDetail}
        section={active}
      />
      {layout === "compact" ? (
        <main id="main" className="wiki-library-main-compact" data-cover={isModeDetail ? "" : undefined} tabIndex={-1}>
          <Outlet />
        </main>
      ) : (
        <div className="wiki-library-body">
          <aside className="wiki-library-sidebar">
            <LibraryNavigation layout="sidebar" active={active} />
          </aside>
          <main id="main" className="wiki-library-main" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      )}
    </div>
  )
}

export function HeroDetailLayout({
  meta,
  backTo,
  children,
  style,
  headerCentre,
}: {
  meta: PageMeta | null
  backTo?: string
  children: ReactNode
  style?: CSSProperties
  /** The phone header's middle, such as the hero once its name has scrolled away. */
  headerCentre?: ReactNode
}) {
  usePageHead(meta)
  const layout = usePageLayout()
  const main = (
    <main id="main" className="wiki-hero-detail-main" tabIndex={-1}>
      {children}
    </main>
  )
  // Wide screens keep the sections beside the hero, as on the list pages; the artwork then fills the page column.
  return (
    <div className="wiki-hero-detail-shell" style={style}>
      <WikiHeader variant="hero" backTo={backTo} section="heroes" centre={headerCentre} />
      {layout === "compact" ? (
        main
      ) : (
        <div className="wiki-library-body" data-page="hero">
          <aside className="wiki-library-sidebar">
            <LibraryNavigation layout="sidebar" active="heroes" />
          </aside>
          {main}
        </div>
      )}
    </div>
  )
}
