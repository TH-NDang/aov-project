import { useSyncExternalStore, type ReactNode } from "react"
import { Link } from "react-router"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { WikiIcon, type WikiIconName } from "./wiki-icon"
import { useWikiContext, useWikiText } from "../context/wiki-context"
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
 * Every section of the Wiki in its group. `sheet` is the contents sheet of the compact header; `sidebar` is the column
 * beside every section page of the wide layout, which starts with the home page and narrows to its icons on smaller
 * screens, where each icon names itself in a tooltip on hover and on keyboard focus.
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
  const { href } = useWikiContext()
  const t = useWikiText()
  const iconsOnly = useIconsOnly() && layout === "sidebar"
  const iconSize = layout === "sidebar" ? 24 : 26

  const entry = (key: string, to: string, icon: WikiIconName, name: string, current = false) => (
    <NamedLink key={key} name={name} tooltip={iconsOnly}>
      <Link to={to} onClick={onNavigate} className="wiki-library-nav-link" aria-current={current ? "page" : undefined}>
        <WikiIcon name={icon} size={iconSize} />
        <span className="wiki-library-nav-name">{name}</span>
      </Link>
    </NamedLink>
  )

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
