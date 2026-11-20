import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useState } from "react"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@aov/ui/components/sheet"
import { WikiIcon } from "./wiki-icon"
import { useWikiContext, wikiText, useWikiText } from "../context/wiki-context"
import { LibraryNavigation } from "./library-navigation"
import type { WikiSectionKey } from "../lib/wiki-sections"
import { SITE_NAME } from "../lib/seo/page-meta"
import "./library-contents.css"

/** How a compact layout reaches every section: a button in the header and the full list in a side sheet. */
export function LibraryContents({ active }: { active?: WikiSectionKey }) {
  const wide = usePageLayout() === "wide"
  const { locale } = useWikiContext()
  const t = useWikiText()
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" className="wiki-compact-button" aria-label={t("Mở mục lục", "Open contents")}>
          <WikiIcon name="contents" className="size-[18px]" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="wiki-library-sheet" showCloseButton={false}>
        <div className="wiki-library-sheet-heading">
          <SheetTitle>{t("Mục lục", "Contents")}</SheetTitle>
          <SheetDescription className="sr-only">
            {wikiText(locale, `Các danh mục của ${SITE_NAME}`, `${SITE_NAME} categories`)}
          </SheetDescription>
          {/* On a phone the sheet rises from the bottom and closes by a tap above it or a pull down: no X. */}
          {wide && (
            <SheetClose
              className="wiki-library-sheet-close"
              aria-label={wikiText(locale, "Đóng mục lục", "Close contents")}
            >
              <WikiIcon name="close" size={20} />
            </SheetClose>
          )}
        </div>
        <div className="wiki-library-sheet-scroll">
          <LibraryNavigation active={active} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
