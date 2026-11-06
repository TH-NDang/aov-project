import { Link } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiContext, wikiText } from "../context/wiki-context"

/** The compact layout names the page in its header instead. */
export function CatalogHeading({ title, section }: { title: string; section: string }) {
  const { t, href, locale } = useWikiContext()
  if (usePageLayout() === "compact") return null
  return (
    <header className="wiki-catalog-heading">
      <nav aria-label={wikiText(locale, "Đường dẫn", "Breadcrumb")}>
        <Link to={href("/")}>{t("home")}</Link>
        <span aria-hidden="true">/</span>
        <span>{section}</span>
      </nav>
      <h1>{title}</h1>
    </header>
  )
}
