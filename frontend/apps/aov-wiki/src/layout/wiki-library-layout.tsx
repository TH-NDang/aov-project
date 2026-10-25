import { useState, type CSSProperties, type ReactNode } from "react"
import { Outlet } from "react-router"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@aov/ui/components/sheet"
import { WikiHeader } from "../components/wiki-header"
import { LibraryNavigation } from "./library-navigation"
import { FeedbackDialog } from "./feedback-dialog"
import "./wiki-library-layout.css"

function LibraryContents({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="wiki-library-sheet" showCloseButton={false}>
        <div className="wiki-library-sheet-heading">
          <SheetTitle>Mục lục</SheetTitle>
          <SheetDescription className="sr-only">Các danh mục của AOV WiKi</SheetDescription>
          <SheetClose className="wiki-library-sheet-close" aria-label="Đóng mục lục">
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
  title = "Thư viện Tướng",
  searchScope = "heroes",
}: {
  children?: ReactNode
  title?: string
  searchScope?: "heroes" | "skins"
}) {
  const [contentsOpen, setContentsOpen] = useState(false)

  return (
    <div className="wiki-library-shell">
      <title>{`${title} | AOV WiKi`}</title>
      <WikiHeader
        variant="library"
        pageTitle={title}
        searchScope={searchScope}
        onOpenContents={() => setContentsOpen(true)}
        feedback={<FeedbackDialog />}
      />
      <div className="wiki-library-body">
        <aside className="wiki-library-sidebar" aria-label="Mục lục">
          <h2>Mục lục</h2>
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
