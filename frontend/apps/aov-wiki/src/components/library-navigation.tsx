import { useSyncExternalStore, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { WikiIcon, type WikiIconName } from "./wiki-icon"
import { useWikiContext, useWikiText } from "../context/wiki-context"
import { heroCatalogQuery } from "../lib/hero-api"
import { sectionCountsQuery } from "../lib/section-counts"
import { wikiSections, type WikiSectionKey, SECTION_NAMES } from "../lib/wiki-sections"
import "./library-navigation.css"

/** Matches the width below which `library-navigation.css` narrows the sidebar to its icons. */
const ICONS_ONLY_QUERY = "(max-width: 1179.98px)"

function subscribeToIconsOnly(onChange: () => void) {
  const query = window.matchMedia(ICONS_ONLY_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/** Whether the sidebar shows only its icons, so each link needs a tooltip with its name. */
function useIconsOnly() {
  return useSyncExternalStore(
    subscribeToIconsOnly,
    () => window.matchMedia(ICONS_ONLY_QUERY).matches,
    () => false,
  )
}

/**
 * Every section of the Wiki in its group, as the home page draws them: the section's mark on a small tinted square, its
 * name and how many entries it has published. `sheet` is the contents sheet of the compact header; `sidebar` is the
 * column beside every section page of the wide layout, which starts with the home page and narrows to its marks on
 * smaller screens, where each mark names itself (and its count) in a tooltip on hover and on keyboard focus.
 */
export function LibraryNavigation({
  active,
  onNavigate,
  layout = "sheet",
}: {
  active?: WikiSectionKey
  onNavigate?: () => void
  layout?: "sheet" | "sidebar"
}) {
  const scope = useWikiContext()
  const { href, locale } = scope
  const t = useWikiText()
  const heroes = useQuery(heroCatalogQuery(scope))
  const counts = useQuery(sectionCountsQuery(scope))
  const countOf = (key: string) =>
    key === "heroes" ? heroes.data?.items.length : counts.data?.[key as keyof typeof counts.data]
  const iconsOnly = useIconsOnly() && layout === "sidebar"
  const entry = (key: string, to: string, icon: WikiIconName, name: string, current = false) => {
    const count = countOf(key)
    const shown = count?.toLocaleString(locale)
    return (
      <NamedLink key={key} name={shown ? `${name} · ${shown}` : name} tooltip={iconsOnly}>
        <Link
          to={to}
          onClick={onNavigate}
          className="wiki-library-nav-link"
          aria-current={current ? "page" : undefined}
        >
          <span className="wiki-library-nav-mark">
            <WikiIcon name={icon} size={18} />
          </span>
          <span className="wiki-library-nav-name">{name}</span>
          {shown && <span className="wiki-library-nav-count">{shown}</span>}
        </Link>
      </NamedLink>
    )
  }

  const navigation = (
    <nav
      className="wiki-library-navigation"
      data-layout={layout}
      aria-label={layout === "sidebar" ? t("Các mục của Wiki", "Wiki sections") : t("Mục lục", "Contents")}
    >
      {layout === "sidebar" && (
        <div className="wiki-library-nav-group">{entry("home", href("/"), "home", t("Trang chủ", "Home"))}</div>
      )}
      {(["characters", "warehouse", "play", "news"] as const).map((group) => (
        <div className="wiki-library-nav-group" key={group}>
          <h3>{t(...SECTION_NAMES[group])}</h3>
          {wikiSections
            .filter((section) => section.group === group)
            .map((section) =>
              entry(
                section.key,
                href(section.path),
                section.icon,
                t(...SECTION_NAMES[section.key]),
                active === section.key,
              ),
            )}
        </div>
      ))}
    </nav>
  )

  return layout === "sidebar" ? <TooltipProvider delayDuration={0}>{navigation}</TooltipProvider> : navigation
}

/** Wraps a link in a tooltip with its name while the sidebar shows only icons; otherwise renders the link alone. */
function NamedLink({ name, tooltip, children }: { name: string; tooltip: boolean; children: ReactNode }) {
  if (!tooltip) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="wiki-library-nav-tooltip">
        {name}
      </TooltipContent>
    </Tooltip>
  )
}
