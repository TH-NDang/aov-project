import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react"
import { flushSync } from "react-dom"
import { Link, useLocation, useNavigate } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useScrolled } from "@aov/ui/hooks/use-scrolled"
import { publicSiteUrl } from "@aov/ui/lib/public-site-url"
import { StreamBrand } from "./stream-brand"
import { StreamAppSwitcher } from "./stream-app-switcher"
import { StreamFooter } from "./stream-footer"
import { GameIcon, type GameIconName } from "@aov/ui/components/game-icons"
import { StreamIcon } from "./stream-icon"
import { useStreamLocale } from "./stream-locale"
import { CommunitySessionButton } from "./community-session"
import { SignInDialog } from "./community-signin"

export const WIKI_URL = publicSiteUrl(import.meta.env.VITE_WIKI_URL, 5173, window.location.origin)

/** The search of a page's own list, typed into the bar's field. */
export type PageSearch = { value: string; onChange: (value: string) => void; placeholder: string; label: string }

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
  // Opened from the bar's button, the search covers the page with a screen of shortcuts until a search is made.
  const [shortcuts, setShortcuts] = useState(false)
  const openSearch = () => {
    flushSync(() => {
      setSearchOpen(true)
      // A page that searches its own list answers under the bar, so nothing covers it.
      setShortcuts(!pageSearch)
    })
    searchInput.current?.focus()
  }
  const closeSearch = () => {
    setSearchOpen(false)
    setShortcuts(false)
    requestAnimationFrame(() => {
      if (searchTrigger.current?.offsetParent) searchTrigger.current.focus()
      else searchInput.current?.blur()
    })
  }
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
        className={`hub-topbar${searchOpen ? " hub-search-open" : ""}${searchOpen && shortcuts ? " hub-search-shortcuts" : ""}`}
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
            <HeaderSearch inputRef={searchInput} onDismiss={closeSearch} onSearched={() => setShortcuts(false)} />
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
        {searchOpen && shortcuts && (
          <div className="hub-search-sheet">
            <p className="hub-search-sheet-title">{text("Đi nhanh tới", "Jump to")}</p>
            <nav aria-label={text("Điều hướng chính", "Main navigation")}>
              {destinations.map((item) => (
                <Link key={item.to} to={item.to} onClick={closeSearch}>
                  <GameIcon name={item.icon} size={22} />
                  {text(item.label, item.english)}
                </Link>
              ))}
            </nav>
            <p className="hub-search-sheet-hint">
              {text(
                "Gõ tên trang, đội, giải đấu hoặc nội dung bài viết rồi nhấn Tìm.",
                "Type the name of a page, team or tournament, or words from a post, then search.",
              )}
            </p>
          </div>
        )}
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

/** The bar's field while a page searches its own list with it: every key narrows the list, Escape clears it. */
function ListSearch({
  search,
  inputRef,
  onDismiss,
}: {
  search: PageSearch
  inputRef: RefObject<HTMLInputElement | null>
  onDismiss: () => void
}) {
  const { text } = useStreamLocale()
  return (
    <form
      id="stream-global-search"
      className="hub-search"
      role="search"
      aria-label={search.label}
      onSubmit={(event) => {
        event.preventDefault()
        inputRef.current?.blur()
      }}
    >
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        maxLength={100}
        aria-label={search.label}
        placeholder={search.placeholder}
        value={search.value}
        onChange={(event) => search.onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return
          if (search.value) search.onChange("")
          else onDismiss()
        }}
      />
      <button
        type="button"
        aria-label={search.value ? text("Xóa từ khóa", "Clear the search") : text("Tìm kiếm", "Search")}
        onClick={() => {
          if (search.value) search.onChange("")
          inputRef.current?.focus()
        }}
      >
        <StreamIcon name={search.value ? "close" : "search"} size={16} />
      </button>
    </form>
  )
}

/** The search of the bar; on Explore it starts from the words already searched for. */
function HeaderSearch({
  inputRef,
  onDismiss,
  onSearched,
}: {
  inputRef: RefObject<HTMLInputElement | null>
  onDismiss: () => void
  onSearched: () => void
}) {
  const { pathname, search } = useLocation()
  const query = pathname === "/explore" ? new URLSearchParams(search).get("q") || "" : ""
  return (
    <SearchForm
      key={`${pathname}:${search}`}
      initialValue={query}
      inputRef={inputRef}
      onDismiss={onDismiss}
      onSearched={onSearched}
    />
  )
}

function SearchForm({
  initialValue,
  inputRef,
  onDismiss,
  onSearched,
}: {
  initialValue: string
  inputRef: RefObject<HTMLInputElement | null>
  onDismiss: () => void
  onSearched: () => void
}) {
  const { text } = useStreamLocale()
  const navigate = useNavigate()
  const [value, setValue] = useState(initialValue)
  function submit(event: FormEvent) {
    event.preventDefault()
    const q = value.trim()
    void navigate(q ? `/explore?${new URLSearchParams({ q })}` : "/explore")
    inputRef.current?.blur()
    onSearched()
  }
  return (
    <form
      id="stream-global-search"
      className="hub-search"
      role="search"
      aria-label={text("Tìm kiếm chung", "Global search")}
      onSubmit={submit}
    >
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        maxLength={100}
        aria-label={text("Tìm kiếm trên AOV Stream", "Search AOV Stream")}
        placeholder={text("Tìm trang, bài viết, giải đấu…", "Search pages, posts, tournaments…")}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onDismiss()
        }}
      />
      <button type="submit" aria-label={text("Tìm kiếm", "Search")}>
        <StreamIcon name="search" size={16} />
      </button>
    </form>
  )
}
