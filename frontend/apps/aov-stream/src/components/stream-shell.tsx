import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { Link, useLocation } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useScrolled } from "@aov/ui/hooks/use-scrolled"
import { publicSiteUrl } from "@aov/ui/lib/public-site-url"
import { StreamBrand } from "./stream-brand"
import { StreamAppSwitcher } from "./stream-app-switcher"
import { StreamFooter } from "./stream-footer"
import { GameIcon, type GameIconName } from "@aov/ui/components/game-icons"
import { StreamIcon } from "./stream-icon"
import { ListSearch, StreamSearch, type PageSearch } from "./stream-search"
import { useStreamLocale } from "./stream-locale"
import { CommunitySessionButton } from "./community-session"
import { SignInDialog } from "./community-signin"

export const WIKI_URL = publicSiteUrl(import.meta.env.VITE_WIKI_URL, 5173, window.location.origin)

type Destination = {
  to: string
  label: string
  english: string
  /** Drawn with Game Icons, as the Wiki and Admin draw their sections. */
  icon: GameIconName
  active: (path: string) => boolean
}

/** The same main destinations on desktop and phones; game lookup belongs to tournaments. */
const destinations: Destination[] = [
  {
    to: "/",
    label: "Bảng tin",
    english: "Feed",
    icon: "newspaper",
    active: (path) => path === "/",
  },
  {
    to: "/competitions",
    label: "Giải đấu",
    english: "Tournaments",
    icon: "trophy-cup",
    active: (path) => path.startsWith("/competitions") || path.startsWith("/matches") || path.startsWith("/games"),
  },
  {
    to: "/explore",
    label: "Khám phá",
    english: "Explore",
    icon: "compass",
    // Profile pages are found from Explore, so they belong to it.
    active: (path) => /^\/(explore|pages|teams|players|people)/.test(path),
  },
]

/**
 * The portal frame: a top bar with the main tabs, the page content and, on wide screens, an `aside` column that
 * follows the content on narrower ones. `lead` runs across the full width above both. On phones only the tab row
 * stays pinned while scrolling, thinner than at the top of the page. A page with a list of its own passes `search`:
 * the bar's field then searches that list as the reader types, so no page needs a second search.
 */
export function StreamShell({
  children,
  aside,
  lead,
  search: pageSearch,
}: {
  children: ReactNode
  aside?: ReactNode
  lead?: ReactNode
  search?: PageSearch
}) {
  const { text } = useStreamLocale()
  const { pathname, search } = useLocation()
  const [searchOpen, setSearchOpen] = useState(
    pageSearch ? !!pageSearch.value : pathname === "/explore" && !!new URLSearchParams(search).get("q"),
  )
  const searchInput = useRef<HTMLInputElement>(null)
  const searchTrigger = useRef<HTMLButtonElement>(null)
  const compact = usePageLayout() === "compact"
  const scrolled = useScrolled() && compact
  const tabRow = useRef<HTMLElement>(null)
  // The row scrolls sideways once there are more sections than fit, and keeps the open one in view.
  useEffect(() => {
    const row = tabRow.current
    const open = row?.querySelector<HTMLElement>("[aria-current]")
    if (row && open) row.scrollLeft = open.offsetLeft - (row.clientWidth - open.offsetWidth) / 2
  }, [pathname, compact])
  // On a compact layout the search, opened from the bar's button, is a screen of its own over the page.
  const [sheetOpen, setSheetOpen] = useState(false)
  const openSearch = () => {
    flushSync(() => {
      setSearchOpen(true)
      // A page that searches its own list answers under the bar, so nothing covers it.
      setSheetOpen(!pageSearch && compact)
    })
    searchInput.current?.focus()
  }
  const closeSearch = () => {
    setSearchOpen(false)
    setSheetOpen(false)
    requestAnimationFrame(() => {
      if (searchTrigger.current?.offsetParent) searchTrigger.current.focus()
      else searchInput.current?.blur()
    })
  }
  // "/" (or Ctrl+K) puts the focus in the search from anywhere but a field, as on most sites with one search.
  const onShortcut = useEffectEvent(openSearch)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]")
      const slash = event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey
      const command = event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey)
      if ((!slash && !command) || (typing && !command) || event.defaultPrevented) return
      event.preventDefault()
      onShortcut()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  // On phones the tabs are a row of their own under the brand row, so they come last in the bar.
  const topnav = (
    <nav ref={tabRow} className="hub-topnav" aria-label={text("Điều hướng chính", "Main navigation")}>
      {destinations.map((item) => (
        <Link key={item.to} to={item.to} aria-current={item.active(pathname) ? "page" : undefined}>
          <GameIcon name={item.icon} size={18} />
          {text(item.label, item.english)}
        </Link>
      ))}
    </nav>
  )
  return (
    <div className="hub-shell" data-scrolled={scrolled || undefined}>
      <a href="#main" className="stream-skip">
        {text("Đến nội dung chính", "Skip to content")}
      </a>
      <header
        className={`hub-topbar${searchOpen ? " hub-search-open" : ""}${searchOpen && sheetOpen ? " hub-search-sheet-open" : ""}`}
      >
        <div className="hub-topbar-inner">
          <div className="hub-brand-group">
            <Link to="/" className="hub-brand-link" aria-label={text("AOV Stream — Bảng tin", "AOV Stream — Feed")}>
              <StreamBrand />
            </Link>
            <StreamAppSwitcher wikiUrl={WIKI_URL} />
          </div>
          {!compact && topnav}
          {pageSearch ? (
            <ListSearch search={pageSearch} inputRef={searchInput} onDismiss={closeSearch} />
          ) : (
            <StreamSearch
              key={`${pathname}:${search}`}
              inputRef={searchInput}
              sheet={compact}
              sheetOpen={searchOpen && sheetOpen}
              onSheetOpen={(open) => {
                setSearchOpen(true)
                setSheetOpen(open)
              }}
              onDismiss={closeSearch}
              onDone={(opened) => (opened === "page" ? closeSearch() : setSheetOpen(false))}
            />
          )}
          <button
            type="button"
            className="hub-search-close"
            onClick={closeSearch}
            aria-label={text("Đóng tìm kiếm", "Close search")}
          >
            {text("Đóng", "Close")}
          </button>
          <div className="hub-topbar-actions">
            <button
              ref={searchTrigger}
              type="button"
              className="hub-icon-button hub-search-link"
              aria-label={text("Mở tìm kiếm", "Open search")}
              aria-expanded={searchOpen}
              aria-controls="stream-global-search"
              onClick={openSearch}
            >
              <StreamIcon name="search" size={18} />
            </button>
            <CommunitySessionButton />
          </div>
          {compact && topnav}
        </div>
      </header>
      <main id="main" className="hub-body" tabIndex={-1}>
        {lead}
        <div className={aside ? "hub-content hub-content-split" : "hub-content"}>
          <div className="hub-main">{children}</div>
          {aside && (
            <aside className="hub-aside" aria-label={text("Gợi ý và tài khoản", "Suggestions and account")}>
              {aside}
            </aside>
          )}
        </div>
      </main>
      <StreamFooter />
      <SignInDialog />
    </div>
  )
}
