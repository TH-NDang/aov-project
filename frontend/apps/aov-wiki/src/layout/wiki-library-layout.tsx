import { useState, type CSSProperties, type ReactNode } from "react"
import { Outlet } from "react-router"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@aov/ui/components/sheet"
import { WikiHeader } from "../components/wiki-header"
import { LibraryNavigation } from "./library-navigation"
import { FeedbackDialog } from "./feedback-dialog"
import "./wiki-library-layout.css"
import { useWikiContext, wikiText } from "../context/wiki-context"

function LibraryContents({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
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
          <LibraryNavigation onNavigate={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function WikiLibraryLayout({
  children,
  title,
  searchScope = "heroes",
}: {
  children?: ReactNode
  title?: string
  searchScope?: "heroes" | "skins" | "warehouse"
}) {
  const { t } = useWikiContext()
  const pageTitle = title ?? t("heroes")
  const [contentsOpen, setContentsOpen] = useState(false)

  return (
    <div className="wiki-library-shell">
      <title>{`${pageTitle} | AOV WiKi`}</title>
      <WikiHeader
        variant="library"
        pageTitle={pageTitle}
        searchScope={searchScope}
        onOpenContents={() => setContentsOpen(true)}
        feedback={<FeedbackDialog />}
      />
      <div className="wiki-library-body">
        <aside className="wiki-library-sidebar" aria-label={t("contents")}>
          <h2>{t("contents")}</h2>
          <LibraryNavigation />
        </aside>
        <main id="main" className="wiki-library-main" tabIndex={-1}>
          {children ?? <Outlet />}
        </main>
      </div>
      <LibraryContents open={contentsOpen} onOpenChange={setContentsOpen} />
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
      <WikiHeader variant="hero" onOpenContents={() => setContentsOpen(true)} feedback={<FeedbackDialog />} />
      <main id="main" className="wiki-hero-detail-main" tabIndex={-1}>
        {children}
      </main>
      <LibraryContents open={contentsOpen} onOpenChange={setContentsOpen} />
    </div>
  )
}
