import { useState } from "react"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@aov/ui/components/sheet"
import { WikiIcon } from "./wiki-icon"
import { useWikiContext, wikiText } from "../context/wiki-context"
import { LibraryNavigation } from "./library-navigation"
import type { WikiSectionKey } from "../lib/wiki-sections"
import { SITE_NAME } from "../lib/seo/page-meta"
import "./library-contents.css"

/** How a compact layout reaches every section: a button in the header and the full list in a side sheet. */
export function LibraryContents({ active }: { active?: WikiSectionKey }) {
  const { t, locale } = useWikiContext()
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" className="wiki-compact-button" aria-label={t("openContents")}>
          <WikiIcon name="contents" className="size-[18px]" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="wiki-library-sheet" showCloseButton={false}>
        <div className="wiki-library-sheet-heading">
          <SheetTitle>{t("contents")}</SheetTitle>
          <SheetDescription className="sr-only">
            {wikiText(locale, `Các danh mục của ${SITE_NAME}`, `${SITE_NAME} categories`)}
          </SheetDescription>
          <SheetClose
            className="wiki-library-sheet-close"
            aria-label={wikiText(locale, "Đóng mục lục", "Close contents")}
          >
            <WikiIcon name="close" size={20} />
          </SheetClose>
        </div>
        <div className="wiki-library-sheet-scroll">
          <LibraryNavigation active={active} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
