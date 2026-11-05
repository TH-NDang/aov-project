import { Link } from "react-router"
import { useWikiContext, wikiText } from "../context/wiki-context"

export function CatalogHeading({ title, section }: { title: string; section: string }) {
  const { t, href, locale } = useWikiContext()
  return (
    <header className="wiki-catalog-heading max-[640px]:hidden">
      <nav aria-label={wikiText(locale, "Đường dẫn", "Breadcrumb")}>
        <Link to={href("/")}>{t("home")}</Link>
        <span aria-hidden="true">/</span>
        <span>{section}</span>
      </nav>
      <h1>{title}</h1>
    </header>
  )
}
