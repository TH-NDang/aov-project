import { type CSSProperties, type ReactNode } from "react"
import { Outlet, useMatch, useSearchParams } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiHeader } from "../components/wiki-header"
import { LibraryNavigation } from "./library-navigation"
import { warehouseKind } from "../features/warehouse/warehouse-types"
import "./wiki-library-layout.css"
import { useWikiContext } from "../context/wiki-context"

export function WikiLibraryLayout() {
  const { t } = useWikiContext()
  const layout = usePageLayout()
  const [params] = useSearchParams()
  const isWarehouse = useMatch("/warehouse")
  const isSkins = useMatch("/skins")
  const isUpdates = useMatch("/updates/*")
  const isTerms = useMatch("/terms/*")
  const isHeroList = useMatch("/hero")
  const searchScope = isWarehouse ? "warehouse" : isSkins ? "skins" : "heroes"
  const active = isTerms
    ? "terms"
    : isUpdates
      ? "updates"
      : searchScope === "warehouse"
        ? warehouseKind(params.get("tab"))
        : searchScope
  const pageTitle = t(active)

  return (
    <div className="wiki-library-shell">
      <title>{`${pageTitle} | AOV WiKi`}</title>
      {/* On the compact layout the armory's parts are tabs below the header, which names the whole armory. */}
      <WikiHeader
        variant="library"
        pageTitle={layout === "compact" && isWarehouse ? t("warehouse") : pageTitle}
        section={active}
        searchScope={searchScope}
        ownSearch={!!(isHeroList || isSkins || isWarehouse)}
      />
      {layout === "compact" ? (
        <main id="main" className="wiki-library-main-compact" tabIndex={-1}>
          <Outlet />
        </main>
      ) : (
        <div className="wiki-library-body">
          <aside className="wiki-library-sidebar" aria-label={t("contents")}>
            <h2>{t("contents")}</h2>
            <LibraryNavigation active={active} />
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
  title,
  backTo,
  children,
  style,
}: {
  title: string
  backTo?: string
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div className="wiki-hero-detail-shell" style={style}>
      <title>{`${title} | AOV WiKi`}</title>
      <WikiHeader variant="hero" backTo={backTo} section="heroes" />
      <main id="main" className="wiki-hero-detail-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
