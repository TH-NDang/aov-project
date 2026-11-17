import { useLocation } from "react-router"
import { WikiHeader } from "../../components/wiki-header"
import { WikiSearch } from "../../components/wiki-search"
import { WikiSectionTiles } from "../../components/wiki-section-tiles"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
import { notFoundMeta } from "../../lib/seo/page-meta"
import { usePageHead } from "../../lib/seo/use-page-head"
import { SITE_NAME } from "../../lib/seo/page-meta"
import "./not-found.css"

/** An address the Wiki does not have: say so, then offer the search and every section, so the reader can go on. */
export function NotFoundPage() {
  const { locale } = useWikiContext()
  const { pathname } = useLocation()
  usePageHead(notFoundMeta(locale, pathname))
  const text = useWikiText()
  return (
    <>
      <WikiHeader />
      <main id="main" tabIndex={-1} className="wiki-not-found">
        <div className="wiki-not-found-head wiki-mascot-state">
          <h1>{text("Không tìm thấy trang", "Page not found")}</h1>
          <p>
            {text(
              `Địa chỉ này không có trên ${SITE_NAME}: trang có thể đã đổi tên hoặc đã được gỡ. Tìm theo tên, hoặc mở một mục bên dưới.`,
              `This address is not on ${SITE_NAME}: the page may have been renamed or removed. Search by name, or open a section below.`,
            )}
          </p>
          <div className="wiki-not-found-search">
            <WikiSearch size="hero" />
          </div>
        </div>
        <section className="wiki-not-found-sections" aria-labelledby="wiki-not-found-sections">
          <h2 id="wiki-not-found-sections">{text("Các mục của Wiki", "Wiki sections")}</h2>
          <WikiSectionTiles label={text("Các mục của Wiki", "Wiki sections")} />
        </section>
      </main>
    </>
  )
}
