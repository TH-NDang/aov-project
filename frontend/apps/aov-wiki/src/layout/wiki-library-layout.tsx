import { type CSSProperties, type ReactNode } from "react"
import { Outlet, useLocation, useMatch } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiHeader } from "../components/wiki-header"
import { warehouseKind } from "../lib/warehouse-types"
import { SECTION_NAMES } from "../lib/wiki-sections"
import "./wiki-library-layout.css"
import { useWikiContext, useWikiText } from "../context/wiki-context"
import { libraryPageMeta, type PageMeta } from "../lib/seo/page-meta"
import { usePageHead } from "../lib/seo/use-page-head"

/** The frame of every list and reference page: the header with the sections, then the page at full width. */
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
      {/* On the compact layout the armory's parts are tabs below the header, which names the whole armory. */}
      {/* A mode's page opens on its cover, so on phones the header starts clear over it and darkens on scroll. */}
      {/* One mode or one update names itself in its own h1; the header then only says which section it belongs to. */}
      <WikiHeader
        variant={layout === "compact" && isModeDetail ? "hero" : "library"}
        pageTitle={layout === "compact" && isWarehouse ? t("Kho trang bị", "Armory") : pageTitle}
        pageTitleIsHeading={!isModeDetail && !isPatchDetail}
        section={active}
      />
      <main
        id="main"
        className={layout === "compact" ? "wiki-library-main-compact" : "wiki-library-main"}
        data-cover={layout === "compact" && isModeDetail ? "" : undefined}
        tabIndex={-1}
      >
        <Outlet />
      </main>
    </div>
  )
}

export function HeroDetailLayout({
  meta,
  backTo,
  children,
  style,
}: {
  meta: PageMeta | null
  backTo?: string
  children: ReactNode
  style?: CSSProperties
}) {
  usePageHead(meta)
  return (
    <div className="wiki-hero-detail-shell" style={style}>
      <WikiHeader variant="hero" backTo={backTo} section="heroes" />
      <main id="main" className="wiki-hero-detail-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
