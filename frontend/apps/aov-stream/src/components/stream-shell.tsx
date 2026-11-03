import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router"
import { profileKindLabels, type ProfileKind } from "@aov/community-contracts"
import { publicSiteUrl } from "@aov/ui/lib/public-site-url"
import { StreamBrand } from "./stream-brand"
import { StreamAppSwitcher } from "./stream-app-switcher"
import { StreamIcon, type StreamIconName } from "./stream-icon"
import { useStreamLocale } from "./stream-locale"
import { CommunitySessionButton } from "../features/community/community-session"
import { SignInDialog } from "../features/community/community-signin"
import { hueOf, kindIcons, useFeaturedCompetitions } from "../features/community/community-ui"

export const WIKI_URL = publicSiteUrl(import.meta.env.VITE_WIKI_URL, 5173, window.location.origin)
export const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || "http://localhost:5175"

type Destination = {
  to: string
  label: string
  english: string
  icon: StreamIconName
  active: (path: string) => boolean
}

const destinations: Destination[] = [
  {
    to: "/",
    label: "Trang chủ",
    english: "Home",
    icon: "home",
    active: (path) => path === "/" || path.startsWith("/competitions"),
  },
  { to: "/games", label: "Ván đấu", english: "Games", icon: "gamepad", active: (path) => path.startsWith("/games") },
  {
    to: "/pages",
    label: "Cộng đồng",
    english: "Community",
    icon: "users",
    active: (path) => path.startsWith("/pages"),
  },
]

/**
 * The portal frame: a top bar with a mobile preferences menu and a left rail on wide screens.
 * `aside` fills the right column on wide screens and follows the main content on narrower ones.
 */
export function StreamShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const { text } = useStreamLocale()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  // The directory tab has its own search field.
  const onDirectory =
    pathname === "/pages" && (params.has("q") || params.has("kind") || params.get("tab") === "directory")
  return (
    <div className="hub-shell">
      <a href="#main" className="stream-skip">
        Đến nội dung chính
      </a>
      <header className="hub-topbar">
        <div className="hub-topbar-inner">
          <div className="hub-brand-group">
            <Link to="/" className="hub-brand-link" aria-label="AOV Stream — Trang chủ">
              <StreamBrand compact />
            </Link>
            <StreamAppSwitcher wikiUrl={WIKI_URL} />
          </div>
          <nav className="hub-topnav" aria-label="Điều hướng chính">
            {destinations.map((item) => (
              <Link key={item.to} to={item.to} aria-current={item.active(pathname) ? "page" : undefined}>
                {text(item.label, item.english)}
              </Link>
            ))}
          </nav>
          {!onDirectory && <HeaderSearch />}
          <div className="hub-topbar-actions">
            <a
              className="hub-contribute"
              href={`${ADMIN_URL}/tournaments`}
              aria-label="Đóng góp dữ liệu giải đấu"
              title="Biên tập dữ liệu giải đấu"
            >
              <StreamIcon name="plus" size={16} />
              <span>{text("Đóng góp", "Contribute")}</span>
            </a>
            <CommunitySessionButton />
          </div>
        </div>
      </header>
      <div className="hub-body">
        <aside className="hub-rail" aria-label="Danh mục">
          <StreamRail />
        </aside>
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

export function StreamMobileNavigation() {
  const { pathname } = useLocation()
  const { text } = useStreamLocale()
  return (
    <nav className="hub-mobile-menu-nav" aria-label={text("Điều hướng chính", "Main navigation")}>
      {destinations
        .filter((item) => item.to !== "/")
        .map((item) => (
          <Link key={item.to} to={item.to} aria-current={item.active(pathname) ? "page" : undefined}>
            <StreamIcon name={item.icon} size={17} />
            <span>{text(item.label, item.english)}</span>
          </Link>
        ))}
    </nav>
  )
}

function HeaderSearch() {
  const navigate = useNavigate()
  const [value, setValue] = useState("")
  function submit(event: FormEvent) {
    event.preventDefault()
    const q = value.trim()
    navigate(q ? `/pages?${new URLSearchParams({ q })}` : "/pages")
    setValue("")
  }
  return (
    <form className="hub-search" role="search" onSubmit={submit}>
      <StreamIcon name="search" size={16} />
      <input
        aria-label="Tìm đội tuyển, tuyển thủ hoặc tổ chức"
        placeholder="Tìm đội tuyển, tuyển thủ, tổ chức…"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </form>
  )
}

const kinds = Object.keys(profileKindLabels) as ProfileKind[]

function StreamRail() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const competitions = useFeaturedCompetitions()
  const onPages = pathname === "/pages"
  const kind = params.get("kind")
  const directory = params.get("tab") === "directory" || params.has("q")
  return (
    <>
      <section className="hub-rail-section">
        <h2>Cộng đồng</h2>
        <Link to="/pages" aria-current={onPages && !kind && !directory && !params.has("tab") ? "page" : undefined}>
          <StreamIcon name="feed" size={18} />
          Bảng tin
        </Link>
        <Link to="/pages?tab=directory" aria-current={onPages && directory && !kind ? "page" : undefined}>
          <StreamIcon name="grid" size={18} />
          Danh bạ trang
        </Link>
        {kinds.map((value) => (
          <Link key={value} to={`/pages?kind=${value}`} aria-current={onPages && kind === value ? "page" : undefined}>
            <StreamIcon name={kindIcons[value]} size={18} />
            {profileKindLabels[value]}
          </Link>
        ))}
      </section>
      <section className="hub-rail-section">
        <h2>Giải đấu</h2>
        {competitions.data?.items.slice(0, 6).map((entry) => (
          <Link
            key={entry.id}
            to={`/competitions/${entry.id}`}
            aria-current={pathname === `/competitions/${entry.id}` ? "page" : undefined}
            title={entry.content.tournament.name}
          >
            <span
              className="hub-rail-logo"
              style={{ "--hub-hue": hueOf(entry.content.tournament.name) } as CSSProperties}
            >
              {entry.content.tournament.logoUrl ? (
                <img src={entry.content.tournament.logoUrl} alt="" />
              ) : (
                entry.content.tournament.name.slice(0, 1).toUpperCase()
              )}
            </span>
            <span className="hub-rail-text">{entry.content.tournament.name}</span>
          </Link>
        ))}
        {competitions.data && !competitions.data.items.length && (
          <p className="hub-rail-note">Các mùa giải sẽ xuất hiện khi được công bố.</p>
        )}
        {competitions.isError && <p className="hub-rail-note">Chưa tải được danh sách giải.</p>}
        <Link to="/games" aria-current={pathname.startsWith("/games") ? "page" : undefined}>
          <StreamIcon name="gamepad" size={18} />
          Ván đấu đã ghi nhận
        </Link>
      </section>
      <section className="hub-rail-section">
        <h2>Liên kết</h2>
        <a href={WIKI_URL}>
          <StreamIcon name="spark" size={18} />
          AOV WiKi
          <StreamIcon name="external" size={12} />
        </a>
        <a href={`${ADMIN_URL}/tournaments`}>
          <StreamIcon name="edit" size={18} />
          Đóng góp dữ liệu
          <StreamIcon name="external" size={12} />
        </a>
      </section>
    </>
  )
}
