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
    active: (path) => path === "/" || path.startsWith("/pages"),
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
    active: (path) => path.startsWith("/explore"),
  },
]

/**
 * The portal frame: a top bar with the main tabs, the page content and, on wide screens, an `aside` column that
 * follows the content on narrower ones. On phones only the tab row stays pinned while scrolling.
 */
export function StreamShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
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
        Đến nội dung chính
      </a>
      <header className={`hub-topbar${searchOpen ? " hub-search-open" : ""}`}>
        <div className="hub-topbar-inner">
          <div className="hub-brand-group">
            <Link to="/" className="hub-brand-link" aria-label="AOV Stream — Bảng tin">
              <StreamBrand compact />
            </Link>
            <StreamAppSwitcher wikiUrl={WIKI_URL} />
          </div>
          <nav className="hub-topnav" aria-label="Điều hướng chính">
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
            aria-label="Đóng tìm kiếm"
          >
            <StreamIcon name="back" size={20} />
          </button>
          <HeaderSearch inputRef={searchInput} onDismiss={closeSearch} />
          <div className="hub-topbar-actions">
            <button
              ref={searchTrigger}
              type="button"
              className="hub-icon-button hub-search-link"
              aria-label="Mở tìm kiếm"
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
      <div className="hub-body">
        <div className={aside ? "hub-content hub-content-split" : "hub-content"}>
          <main id="main" className="hub-main">
            {children}
          </main>
          {aside && (
            <aside className="hub-aside" aria-label="Gợi ý và tài khoản">
              {aside}
            </aside>
          )}
        </div>
      </div>
      <footer className="hub-footer">
        <StreamBrand compact />
        <p>
          <strong>AOV Stream</strong> · Quan sát trận đấu, khám phá cách chơi. Dữ liệu được biên tập từ nguồn đối chiếu.
        </p>
        <nav aria-label="Liên kết cuối trang">
          <a href={WIKI_URL}>AOV WiKi</a>
          <a href={`${ADMIN_URL}/tournaments`}>Đóng góp dữ liệu</a>
        </nav>
      </footer>
      <SignInDialog />
    </div>
  )
}

/** The bell only exists for signed-in viewers; the dot shows unread notifications. */
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
  const navigate = useNavigate()
  const [value, setValue] = useState(initialValue)
  function submit(event: FormEvent) {
    event.preventDefault()
    const q = value.trim()
    navigate(q ? `/explore?${new URLSearchParams({ q })}` : "/explore")
    inputRef.current?.blur()
  }
  return (
    <form id="stream-global-search" className="hub-search" role="search" aria-label="Tìm kiếm chung" onSubmit={submit}>
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        maxLength={100}
        aria-label="Tìm kiếm trên AOV Stream"
        placeholder="Tìm trang, bài viết, giải đấu…"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onDismiss()
        }}
      />
      <button type="submit" aria-label="Tìm kiếm">
        <StreamIcon name="search" size={16} />
      </button>
    </form>
  )
}
