import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react"
import { Link, useLocation, type UIMatch } from "react-router"
import { PanelRight, Search } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { AovMark, AovWordmark } from "@aov/ui/components/aov-brand"
import { useSidebar } from "@aov/ui/components/sidebar"
import { cn } from "@aov/ui/lib/utils"
import { breadcrumbTrail } from "./admin-breadcrumb"
import { useCommandSearch } from "./command-search"

export interface RouteHandle {
  crumb?: (match: UIMatch) => ReactNode
  /** Redirect-only routes stay out of the breadcrumb. */
  pageTab?: boolean
  /** The page draws its own trail (the tournament workspace, a match), so the shell adds none above it. */
  ownTrail?: boolean
}

/**
 * Whether the page's own title (its first h1) has scrolled up under the bar. A page without one counts as scrolled, so
 * the bar names it from the start.
 */
function useTitleScrolledAway(content: RefObject<HTMLElement | null>, active: boolean) {
  const { pathname } = useLocation()
  const [away, setAway] = useState(false)
  useEffect(() => {
    const element = content.current
    if (!element || !active) return
    const check = () => {
      const title = element.querySelector("h1")
      const top = element.getBoundingClientRect().top
      setAway(!title || title.getBoundingClientRect().bottom <= top + 4)
    }
    // The title may arrive with the page's data, so look again shortly after a page opens.
    check()
    const timers = [150, 600, 1500].map((delay) => window.setTimeout(check, delay))
    element.addEventListener("scroll", check, { passive: true })
    return () => {
      timers.forEach(window.clearTimeout)
      element.removeEventListener("scroll", check)
    }
  }, [content, pathname, active])
  return away
}

/**
 * Phones only: the sidebar is hidden there, so a slim bar holds the menu and search. It shows the brand while the page's
 * own title is on screen and takes the page's name once that title scrolls away, so the name is never shown twice.
 * Wide screens have no bar at all; the sidebar carries search and each page its own title.
 */
export function SiteHeader({ content }: { content: RefObject<HTMLElement | null> }) {
  const { toggleSidebar, isMobile, setOpenMobile } = useSidebar()
  const { open } = useCommandSearch()
  const { pathname } = useLocation()
  const name = useMemo(() => breadcrumbTrail(pathname).at(-1)?.label ?? "AOV Admin", [pathname])
  const away = useTitleScrolledAway(content, isMobile)
  if (!isMobile) return null
  return (
    <div className="sticky top-0 z-30 flex h-12 min-w-0 shrink-0 items-center gap-1 border-b bg-background px-1.5">
      <Button variant="ghost" size="icon" className="size-10" onClick={toggleSidebar} aria-label="Mở menu">
        <PanelRight className="size-5" />
      </Button>
      <div className="relative h-full min-w-0 flex-1">
        <Link
          to="/"
          onClick={() => setOpenMobile(false)}
          aria-hidden={away}
          tabIndex={away ? -1 : undefined}
          className={cn(
            "absolute inset-0 flex items-center gap-2 transition-all duration-200 motion-reduce:transition-none",
            away && "pointer-events-none -translate-y-2 opacity-0",
          )}
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-(--aov-wiki-night)">
            <AovMark className="size-5" />
          </span>
          <AovWordmark product="Admin" className="text-base" />
        </Link>
        <p
          aria-hidden={!away}
          className={cn(
            "absolute inset-0 flex min-w-0 items-center text-sm font-semibold transition-all duration-200 motion-reduce:transition-none",
            !away && "pointer-events-none translate-y-2 opacity-0",
          )}
        >
          <span className="truncate">{name}</span>
        </p>
      </div>
      <Button variant="ghost" size="icon" className="size-10" onClick={open} aria-label="Tìm kiếm">
        <Search className="size-5" />
      </Button>
    </div>
  )
}
