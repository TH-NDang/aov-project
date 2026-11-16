import { useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react"
import { flushSync } from "react-dom"
import { Link, useLocation, useNavigate } from "react-router"
import { publicSiteUrl } from "@aov/ui/lib/public-site-url"
import { StreamBrand } from "./stream-brand"
import { StreamAppSwitcher } from "./stream-app-switcher"
import { StreamIcon, type StreamIconName } from "./stream-icon"
import { useStreamLocale } from "./stream-locale"
import { CommunitySessionButton } from "../features/community/community-session"
import { SignInDialog } from "../features/community/community-signin"

export const WIKI_URL = publicSiteUrl(import.meta.env.VITE_WIKI_URL, 5173, window.location.origin)
export const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || "http://localhost:5175"

type Destination = {
  to: string
  label: string
  english: string
  icon: StreamIconName
  active: (path: string) => boolean
}

/** The same main destinations on desktop and phones; game lookup belongs to tournaments. */
const destinations: Destination[] = [
  {
    to: "/",
    label: "Bảng tin",
    english: "Feed",
    icon: "feed",
    active: (path) => path === "/",
  },
  {
    to: "/competitions",
    label: "Giải đấu",
    english: "Tournaments",
    icon: "trophy",
    active: (path) => path.startsWith("/competitions") || path.startsWith("/matches") || path.startsWith("/games"),
  },
  {
    to: "/explore",
    label: "Khám phá",
    english: "Explore",
    icon: "compass",
    // Profile pages are found from Explore, so they belong to it.
    active: (path) => path.startsWith("/explore") || path.startsWith("/pages"),
  },
]

/**
 * The portal frame: a top bar with the main tabs, the page content and, on wide screens, an `aside` column that
 * follows the content on narrower ones. `lead` runs across the full width above both. On phones only the tab row
 * stays pinned while scrolling.
 */
export function StreamShell({ children, aside, lead }: { children: ReactNode; aside?: ReactNode; lead?: ReactNode }) {
  const { text } = useStreamLocale()
  const { pathname, search } = useLocation()
  const [searchOpen, setSearchOpen] = useState(pathname === "/explore" && !!new URLSearchParams(search).get("q"))
  const searchInput = useRef<HTMLInputElement>(null)
  const searchTrigger = useRef<HTMLButtonElement>(null)
  const openSearch = () => {
    flushSync(() => setSearchOpen(true))
    searchInput.current?.focus()
  }
  const closeSearch = () => {
    setSearchOpen(false)
    requestAnimationFrame(() => {
      if (searchTrigger.current?.offsetParent) searchTrigger.current.focus()
      else searchInput.current?.blur()
    })
  }
  return (
    <div className="hub-shell">
      <a href="#main" className="stream-skip">
        {text("Đến nội dung chính", "Skip to content")}
      </a>
      <header className={`hub-topbar${searchOpen ? " hub-search-open" : ""}`}>
        <div className="hub-topbar-inner">
          <div className="hub-brand-group">
            <Link to="/" className="hub-brand-link" aria-label={text("AOV Stream — Bảng tin", "AOV Stream — Feed")}>
              <StreamBrand />
            </Link>
            <StreamAppSwitcher wikiUrl={WIKI_URL} />
          </div>
          <nav className="hub-topnav" aria-label={text("Điều hướng chính", "Main navigation")}>
            {destinations.map((item) => (
              <Link key={item.to} to={item.to} aria-current={item.active(pathname) ? "page" : undefined}>
                <StreamIcon name={item.icon} size={16} />
                {text(item.label, item.english)}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            className="hub-icon-button hub-search-back"
            onClick={closeSearch}
            aria-label={text("Đóng tìm kiếm", "Close search")}
          >
            <StreamIcon name="back" size={20} />
          </button>
          <HeaderSearch inputRef={searchInput} onDismiss={closeSearch} />
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
      <footer className="hub-footer">
        <StreamBrand />
        <p>
          <strong>AOV Stream</strong>{" "}
          {text(
            "· Quan sát trận đấu, khám phá cách chơi. Dữ liệu được biên tập từ nguồn đối chiếu.",
            "· Watch matches, explore how the game is played. Data is compiled from reference sources.",
          )}
        </p>
        <nav aria-label={text("Liên kết cuối trang", "Footer links")}>
          <a href={WIKI_URL}>AOV WiKi</a>
          <a href={`${ADMIN_URL}/tournaments`}>{text("Đóng góp dữ liệu", "Contribute data")}</a>
        </nav>
      </footer>
      <SignInDialog />
    </div>
  )
}

/** The search of the bar; on Explore it starts from the words already searched for. */
function HeaderSearch({
  inputRef,
  onDismiss,
}: {
  inputRef: RefObject<HTMLInputElement | null>
  onDismiss: () => void
}) {
  const { pathname, search } = useLocation()
  const query = pathname === "/explore" ? new URLSearchParams(search).get("q") || "" : ""
  return <SearchForm key={`${pathname}:${search}`} initialValue={query} inputRef={inputRef} onDismiss={onDismiss} />
}

function SearchForm({
  initialValue,
  inputRef,
  onDismiss,
}: {
  initialValue: string
  inputRef: RefObject<HTMLInputElement | null>
  onDismiss: () => void
}) {
  const { text } = useStreamLocale()
  const navigate = useNavigate()
  const [value, setValue] = useState(initialValue)
  function submit(event: FormEvent) {
    event.preventDefault()
    const q = value.trim()
    navigate(q ? `/explore?${new URLSearchParams({ q })}` : "/explore")
    inputRef.current?.blur()
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
