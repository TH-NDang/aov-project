import { useState, type CSSProperties, type ReactNode } from "react"
import { Outlet, useMatch, useSearchParams } from "react-router"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@aov/ui/components/sheet"
import { WikiHeader } from "../components/wiki-header"
import { LibraryNavigation } from "./library-navigation"
import type { WikiSectionKey } from "./wiki-sections"
import { warehouseKind } from "../features/warehouse/warehouse-types"
import "./wiki-library-layout.css"
import { useWikiContext, wikiText } from "../context/wiki-context"

function LibraryContents({
  active,
  open,
  onOpenChange,
}: {
  active: WikiSectionKey
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t, locale } = useWikiContext()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="wiki-library-sheet" showCloseButton={false}>
        <div className="wiki-library-sheet-heading">
          <SheetTitle>{t("contents")}</SheetTitle>
          <SheetDescription className="sr-only">
            {wikiText(locale, "Các danh mục của AOV WiKi", "AOV WiKi categories")}
          </SheetDescription>
          <SheetClose
            className="wiki-library-sheet-close"
            aria-label={wikiText(locale, "Đóng mục lục", "Close contents")}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </SheetClose>
        </div>
        <div className="wiki-library-sheet-scroll">
          <LibraryNavigation active={active} onNavigate={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function WikiLibraryLayout() {
  const { t } = useWikiContext()
  const [params] = useSearchParams()
  const isWarehouse = useMatch("/warehouse")
  const isSkins = useMatch("/skins")
  const isUpdates = useMatch("/updates/*")
  const searchScope = isWarehouse ? "warehouse" : isSkins ? "skins" : "heroes"
  const active = isUpdates ? "updates" : searchScope === "warehouse" ? warehouseKind(params.get("tab")) : searchScope
  const pageTitle = t(active)
  const [contentsOpen, setContentsOpen] = useState(false)

  return (
    <div className="wiki-library-shell">
      <title>{`${pageTitle} | AOV WiKi`}</title>
      <WikiHeader
        variant="library"
        pageTitle={pageTitle}
        searchScope={searchScope}
        onOpenContents={() => setContentsOpen(true)}
      />
      <div className="wiki-library-body">
        <aside className="wiki-library-sidebar" aria-label={t("contents")}>
          <h2>{t("contents")}</h2>
          <LibraryNavigation active={active} />
        </aside>
        <main id="main" className="wiki-library-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <LibraryContents active={active} open={contentsOpen} onOpenChange={setContentsOpen} />
    </div>
  )
}

export function HeroDetailLayout({
  title,
  children,
  style,
}: {
  title: string
  children: ReactNode
  style?: CSSProperties
}) {
  const [contentsOpen, setContentsOpen] = useState(false)

  return (
    <div className="wiki-hero-detail-shell" style={style}>
      <title>{`${title} | AOV WiKi`}</title>
      <WikiHeader variant="hero" onOpenContents={() => setContentsOpen(true)} />
      <main id="main" className="wiki-hero-detail-main" tabIndex={-1}>
        {children}
      </main>
      <LibraryContents active="heroes" open={contentsOpen} onOpenChange={setContentsOpen} />
    </div>
  )
}
