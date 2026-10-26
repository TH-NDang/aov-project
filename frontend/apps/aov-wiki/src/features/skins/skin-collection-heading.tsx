import { Link } from "react-router"
import { SkinIcon } from "./skin-icon"
import { useWikiContext, wikiText } from "../../context/wiki-context"

export function SkinCollectionHeading({ count, updating = false }: { count?: number; updating?: boolean }) {
  const { locale, t, href } = useWikiContext()
  return (
    <>
      <nav className="wiki-skin-breadcrumb" aria-label={wikiText(locale, "Đường dẫn", "Breadcrumb")}>
        <Link to={href("/")}>{t("home")}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{t("skins")}</span>
      </nav>
      <header className="wiki-skin-collection-heading">
        <div className="wiki-skin-collection-identity">
          <span className="wiki-skin-collection-mark" aria-hidden="true">
            <SkinIcon name="collection" size={24} />
          </span>
          <h1 className="wiki-skin-title">{t("skins")}</h1>
        </div>
        <span className="wiki-skin-collection-count" role="status" aria-live="polite" aria-atomic="true">
          <SkinIcon name="collection" size={16} />
          {updating ? (
            <span>{wikiText(locale, "Đang lọc…", "Filtering…")}</span>
          ) : count === undefined ? (
            <>
              <span className="wiki-skin-collection-count-skeleton wiki-skeleton" aria-hidden="true" />
              <span className="sr-only">{wikiText(locale, "Đang tải trang phục…", "Loading skins…")}</span>
            </>
          ) : (
            <>
              <strong>{count.toLocaleString(locale)}</strong>
              <span>{wikiText(locale, "trang phục", "skins")}</span>
            </>
          )}
        </span>
        <span className="wiki-skin-collection-decoration" aria-hidden="true">
          <SkinIcon name="collection" size={144} />
        </span>
      </header>
    </>
  )
}
