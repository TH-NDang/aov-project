import { useEffect, useRef, type ReactNode, type RefObject } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { cn } from "@aov/ui/lib/utils"
import { publicSiteUrl } from "@aov/ui/lib/public-site-url"
import { PublicAppOptionBody, PublicAppWordmark } from "@aov/ui/components/public-app-brand"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTitle,
  DropdownMenuTrigger,
} from "@aov/ui/components/public-overlay"
import { PublicPreferencesDrawer } from "@aov/ui/components/public-preferences-drawer"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { SITE_NAME } from "../lib/seo/page-meta"
import "./wiki-header.css"
import { useWikiContext, wikiText, useWikiText } from "../context/wiki-context"
import { WikiPreferenceControls } from "../context/wiki-preferences"
import type { WikiSectionKey } from "../lib/wiki-sections"
import { LibraryContents } from "./library-contents"
import { WikiIcon } from "./wiki-icon"
import { WikiSearch } from "./wiki-search"
import { WikiAccountMenu } from "./wiki-account"
import { useWikiAccountPreferences } from "../lib/wiki-auth"

type IconName = "chevron" | "check" | "chevronRight"

function Icon({ name, className }: { name: IconName; className?: string }) {
  return <WikiIcon name={name} className={cn("size-5 shrink-0", className)} />
}

const WIKI_LOGO_URL = "/images/mole-logo-v4-160.png"
const STREAM_URL = publicSiteUrl(import.meta.env.VITE_STREAM_URL, 5174, window.location.origin)

type Section = {
  id: "wiki" | "stream"
  product: "Wiki" | "Stream"
  label: string
  description: string
  image: string
  href: string
}

/** The two public apps; the switcher beside the wordmark moves between them. */
const SECTIONS: Section[] = [
  {
    id: "wiki",
    product: "Wiki",
    label: SITE_NAME,
    description: "Tra cứu thông tin game",
    image: WIKI_LOGO_URL,
    href: "/",
  },
  {
    id: "stream",
    product: "Stream",
    label: "AOV Stream",
    description: "Giải đấu, cộng đồng người chơi",
    image: "/icons/stream-owl.svg",
    href: STREAM_URL,
  },
]
const CURRENT_SECTION = "wiki"

function SectionItemBody({ section }: { section: Section }) {
  const { locale } = useWikiContext()
  return (
    <PublicAppOptionBody
      product={section.product}
      image={section.image}
      description={wikiText(
        locale,
        section.description,
        section.id === "wiki" ? "Look up game information" : "Tournaments and the player community",
      )}
      current={section.id === CURRENT_SECTION}
      currentLabel={wikiText(locale, "Đang xem", "Current")}
    />
  )
}

/** Area switcher beside the wordmark. The compact layout has this list in the "more" sheet. */
function SectionSelector() {
  const { href } = useWikiContext()
  const t = useWikiText()
  const current = SECTIONS.find((s) => s.id === CURRENT_SECTION)!
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className="public-app-trigger wiki-app-switcher"
        data-product="wiki"
        aria-label={`${t("Chọn ứng dụng", "Choose application")} — ${current.label}`}
      >
        <PublicAppWordmark product="Wiki" className="wiki-header-wordmark" />
        <span className="public-app-chevron">
          <Icon name="chevron" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        alignOffset={-42}
        sideOffset={10}
        className="public-app-theme public-app-menu"
        drawerTitle={t("Chọn ứng dụng", "Choose application")}
        data-appearance="wiki"
      >
        <DropdownMenuTitle className="public-app-menu-title">
          {t("Chọn ứng dụng", "Choose application")}
        </DropdownMenuTitle>
        {SECTIONS.map((s) => {
          const selected = s.id === CURRENT_SECTION
          return (
            <DropdownMenuItem
              key={s.id}
              className="public-app-option"
              data-product={s.id}
              data-current={selected || undefined}
              asChild
            >
              <a href={selected ? href(s.href) : s.href} aria-current={selected ? "true" : undefined}>
                <SectionItemBody section={s} />
              </a>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Writes scroll progress (0 at the top, 1 after `distance` px) to the `--header-solid` CSS variable
 * of the element. Set directly on the element so scrolling never re-renders React.
 */
function useScrollProgressVar(ref: RefObject<HTMLElement | null>, distance: number) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Scroll events already fire at most once per frame, and setting one CSS variable is cheap.
    const update = () =>
      el.style.setProperty("--header-solid", String(Math.max(0, Math.min(1, window.scrollY / distance))))
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [ref, distance])
}

/** The compact layout's sheet for what is not about the wiki's contents: account, the other app and settings. */
function MoreMenu() {
  const { href, locale } = useWikiContext()
  const t = useWikiText()

  return (
    <PublicPreferencesDrawer
      product="wiki"
      locale={locale}
      trigger={
        <button type="button" className="wiki-compact-button" aria-label={t("Thêm", "More")}>
          <WikiIcon name="dots" />
        </button>
      }
    >
      <WikiAccountMenu inline />
      <div className="public-preferences-label">{t("Chọn ứng dụng", "Choose application")}</div>
      <nav
        aria-label={t("Chọn ứng dụng", "Choose application")}
        className="public-preferences-apps"
        data-appearance="wiki"
      >
        {SECTIONS.map((s) => {
          const selected = s.id === CURRENT_SECTION
          return (
            <a
              key={s.id}
              href={selected ? href(s.href) : s.href}
              className="public-preferences-app"
              data-product={s.id}
              data-current={selected || undefined}
              aria-current={selected ? "true" : undefined}
            >
              <img src={s.image} alt="" width={32} height={32} />
              <span>
                <strong>AOV {s.product}</strong>
                <small>
                  {selected ? wikiText(locale, "Đang xem", "Current") : wikiText(locale, "Mở ứng dụng", "Open app")}
                </small>
              </span>
              <Icon name={selected ? "check" : "chevronRight"} className="public-preferences-app-status" />
            </a>
          )
        })}
      </nav>
      <div className="public-preferences-label">{wikiText(locale, "Cài đặt", "Settings")}</div>
      <WikiPreferenceControls mobile />
    </PublicPreferencesDrawer>
  )
}

interface WikiHeaderProps {
  variant?: "home" | "library" | "hero"
  pageTitle?: string
  /** The compact title names the page (its h1) unless the page below it is one item of the section with its own h1. */
  pageTitleIsHeading?: boolean
  /** Where the compact layout's back button leads, for a page below the main sections. */
  backTo?: string
  /** The section to mark in the compact contents sheet; the wide layout marks it in the library sidebar. */
  section?: WikiSectionKey
  /** Fills the compact bar from the first pixel, for a page with no artwork under it. */
  solid?: boolean
  /** Leaves the compact bar clear over a scene at the top of the page; it frosts over as the page scrolls. */
  clear?: boolean
  /** The home page itself: the compact bar has no way home on its left, only the wordmark in the middle. */
  home?: boolean
  /** What the compact bar shows in its middle in place of a title, such as the hero once its name scrolls away. */
  centre?: ReactNode
}

/** One row: the way back, where you are, then search, the contents and the sheet with everything else. */
function WikiHeaderCompact({
  variant = "home",
  pageTitle,
  pageTitleIsHeading = true,
  backTo,
  section,
  solid = false,
  clear = false,
  home = false,
  centre,
}: WikiHeaderProps) {
  const { href, locale } = useWikiContext()
  const t = useWikiText()
  // The open search is an entry of its own in the history, so the system back gesture closes it.
  const location = useLocation()
  const navigate = useNavigate()
  const searching = Boolean((location.state as { wikiSearch?: boolean } | null)?.wikiSearch)
  const here = location.pathname + location.search + location.hash
  const openSearch = () => void navigate(here, { state: { wikiSearch: true } })
  const closeSearch = () =>
    void (location.key === "default" ? navigate(here, { replace: true, state: null }) : navigate(-1))
  const Title = pageTitleIsHeading ? "h1" : "p"
  // Over artwork the row starts clear and darkens during the first 100px of scroll.
  const headerRef = useRef<HTMLElement>(null)
  useScrollProgressVar(headerRef, 100)
  const searchButton = useRef<HTMLButtonElement>(null)
  useFocusAfterClose(searching, searchButton)
  if (searching)
    return (
      <header ref={headerRef} className="wiki-compact-header" data-variant="library" data-searching>
        {/* A picked result replaces the search's history entry, so back from it returns to the page itself. */}
        <WikiSearch size="sheet" autoFocus replace onCancel={closeSearch} />
        <button type="button" className="wiki-compact-cancel" onClick={closeSearch}>
          {wikiText(locale, "Hủy", "Cancel")}
        </button>
      </header>
    )
  return (
    <header
      ref={headerRef}
      className="wiki-compact-header"
      data-variant={variant}
      data-solid={solid || undefined}
      data-clear={clear || undefined}
    >
      {backTo ? (
        <Link className="wiki-compact-button" to={href(backTo)} aria-label={wikiText(locale, "Quay lại", "Back")}>
          <WikiIcon name="chevronLeft" size={22} weight="bold" />
        </Link>
      ) : home ? (
        <span />
      ) : (
        <a className="wiki-compact-button" href={href("/")} aria-label={t("Trang chủ", "Home")}>
          <WikiIcon name="house" weight="bold" />
        </a>
      )}
      {pageTitle ? (
        <Title className="wiki-compact-title">{pageTitle.replace(/^Thư viện\s+/u, "")}</Title>
      ) : centre ? (
        <div className="wiki-compact-centre">{centre}</div>
      ) : variant === "hero" ? (
        // The hero's name stands large on its artwork just below, so the bar leaves the middle to the picture.
        <span />
      ) : (
        <PublicAppWordmark product="Wiki" size="small" className="wiki-compact-wordmark" />
      )}
      <nav className="wiki-compact-utilities" aria-label={t("Tiện ích", "Utilities")}>
        <button
          ref={searchButton}
          type="button"
          className="wiki-compact-button"
          aria-label={t("Tìm kiếm", "Search")}
          onClick={openSearch}
        >
          <WikiIcon name="search" weight="bold" />
        </button>
        <LibraryContents active={section} />
        <MoreMenu />
      </nav>
    </header>
  )
}

/** The brand, the search and the tools. The sections are on the home page and in the sidebar of every section page. */
function WikiHeaderWide({ variant = "home" }: WikiHeaderProps) {
  const { href } = useWikiContext()
  const t = useWikiText()
  // Hero headers darken over the first 100px of scroll, as they start on top of the artwork.
  const headerRef = useRef<HTMLElement>(null)
  useScrollProgressVar(headerRef, 100)
  return (
    <header ref={headerRef} data-variant={variant} className="wiki-header">
      <div className="wiki-header-inner">
        <div className="public-app-theme wiki-header-brand" data-appearance="wiki">
          <a className="wiki-header-logo" href={href("/")} aria-label={`${SITE_NAME} — ${t("Trang chủ", "Home")}`}>
            <img src={WIKI_LOGO_URL} alt="" width={32} height={32} fetchPriority="high" />
          </a>
          <SectionSelector />
        </div>
        <WikiSearch />
        <nav className="wiki-header-tools" aria-label={t("Tiện ích", "Utilities")}>
          <WikiPreferenceControls />
          <WikiAccountMenu />
        </nav>
      </div>
    </header>
  )
}

/** Returns keyboard focus to the button that opened a search once that search has closed. */
function useFocusAfterClose(open: boolean, button: RefObject<HTMLButtonElement | null>) {
  const wasOpen = useRef(false)
  useEffect(() => {
    if (wasOpen.current && !open) button.current?.focus()
    wasOpen.current = open
  }, [open, button])
}

export function WikiHeader(props: WikiHeaderProps) {
  useWikiAccountPreferences()
  return usePageLayout() === "compact" ? <WikiHeaderCompact {...props} /> : <WikiHeaderWide {...props} />
}
