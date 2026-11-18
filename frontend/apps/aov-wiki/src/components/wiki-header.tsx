import { useEffect, useRef, useState, type RefObject } from "react"
import { Link } from "react-router"
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
import { wikiSections, type WikiSectionKey, SECTION_NAMES } from "../lib/wiki-sections"
import { LibraryContents } from "./library-contents"
import { WikiIcon } from "./wiki-icon"
import { WikiSearch } from "./wiki-search"
import { WikiAccountMenu } from "./wiki-account"
import { useWikiAccountPreferences } from "../lib/wiki-auth"

type IconName =
  "search" | "globe" | "user" | "chevron" | "check" | "home" | "more" | "close" | "chevronRight" | "contents"

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
    description: "Tra cứu tướng, trang bị, phù hiệu",
    image: WIKI_LOGO_URL,
    href: "/",
  },
  {
    id: "stream",
    product: "Stream",
    label: "AOV Stream",
    description: "Khám phá giải đấu, ván đấu và cộng đồng",
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
        section.id === "wiki" ? "Explore the Arena of Valor wiki" : "Explore tournaments, games and the community",
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
        <PublicAppWordmark product="Wiki" />
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
          <Icon name="more" />
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

const WAREHOUSE_KEYS = ["items", "enchantments", "arcana", "spells"] as const
const sectionOf = (key: WikiSectionKey) => wikiSections.find((section) => section.key === key)!

/** The main sections, always in the top bar on wide screens; the four parts of the armory share one menu. */
function TopNavigation({ active }: { active?: WikiSectionKey }) {
  const { href, locale } = useWikiContext()
  const t = useWikiText()
  const inWarehouse = WAREHOUSE_KEYS.some((key) => key === active)
  const link = (key: WikiSectionKey, label = t(...SECTION_NAMES[key])) => (
    <Link key={key} to={href(sectionOf(key).path)} aria-current={active === key ? "page" : undefined}>
      {label}
    </Link>
  )
  return (
    <nav className="wiki-topnav" aria-label={wikiText(locale, "Các mục của Wiki", "Wiki sections")}>
      {link("heroes")}
      {link("skins")}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className="wiki-topnav-menu" data-current={inWarehouse || undefined}>
          {t("Kho trang bị", "Armory")}
          <Icon name="chevron" className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="wiki-topnav-panel"
          drawerTitle={t("Kho trang bị", "Armory")}
        >
          {WAREHOUSE_KEYS.map((key) => (
            <DropdownMenuItem key={key} asChild>
              <Link to={href(sectionOf(key).path)} aria-current={active === key ? "page" : undefined}>
                <WikiIcon name={sectionOf(key).icon} size={28} className="size-7" />
                {t(...SECTION_NAMES[key])}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {link("modes")}
      {link("updates", t("Cập nhật", "Updates"))}
      {link("terms")}
    </nav>
  )
}

interface WikiHeaderProps {
  variant?: "home" | "library" | "hero"
  pageTitle?: string
  /** The compact title names the page (its h1) unless the page below it is one item of the section with its own h1. */
  pageTitleIsHeading?: boolean
  /** Where the compact layout's back button leads, for a page below the main sections. */
  backTo?: string
  /** The section to mark in the navigation. */
  section?: WikiSectionKey
  /** Fills the compact bar from the first pixel, for a page with no artwork under it. */
  solid?: boolean
}

/** One row: the way back, where you are, then search, the contents and the sheet with everything else. */
function WikiHeaderCompact({
  variant = "home",
  pageTitle,
  pageTitleIsHeading = true,
  backTo,
  section,
  solid = false,
}: WikiHeaderProps) {
  const { href, locale } = useWikiContext()
  const t = useWikiText()
  const [searching, setSearching] = useState(false)
  const Title = pageTitleIsHeading ? "h1" : "p"
  // Over artwork the row starts clear and darkens during the first 100px of scroll.
  const headerRef = useRef<HTMLElement>(null)
  useScrollProgressVar(headerRef, 100)
  const searchButton = useRef<HTMLButtonElement>(null)
  useFocusAfterClose(searching, searchButton)
  if (searching)
    return (
      <header ref={headerRef} className="wiki-compact-header" data-variant="library" data-searching>
        <button
          type="button"
          className="wiki-compact-button"
          aria-label={wikiText(locale, "Đóng tìm kiếm", "Close search")}
          onClick={() => setSearching(false)}
        >
          <WikiIcon name="chevronLeft" size={22} />
        </button>
        <WikiSearch size="sheet" autoFocus onDone={() => setSearching(false)} />
      </header>
    )
  return (
    <header ref={headerRef} className="wiki-compact-header" data-variant={variant} data-solid={solid || undefined}>
      {backTo ? (
        <Link className="wiki-compact-button" to={href(backTo)} aria-label={wikiText(locale, "Quay lại", "Back")}>
          <WikiIcon name="chevronLeft" size={22} />
        </Link>
      ) : pageTitle ? (
        <a className="wiki-compact-button" href={href("/")} aria-label={t("Trang chủ", "Home")}>
          <Icon name="home" />
        </a>
      ) : (
        <a className="wiki-compact-brand" href={href("/")} aria-label={`${SITE_NAME} — ${t("Trang chủ", "Home")}`}>
          <img src={WIKI_LOGO_URL} alt="" width={28} height={28} fetchPriority="high" />
          <PublicAppWordmark product="Wiki" className="wiki-mobile-wordmark" />
        </a>
      )}
      {pageTitle ? (
        <Title className="wiki-compact-title">{pageTitle.replace(/^Thư viện\s+/u, "")}</Title>
      ) : (
        <span className="flex-1" />
      )}
      <nav className="wiki-compact-utilities" aria-label={t("Tiện ích", "Utilities")}>
        <button
          ref={searchButton}
          type="button"
          className="wiki-compact-button"
          aria-label={t("Tìm kiếm", "Search")}
          onClick={() => setSearching(true)}
        >
          <Icon name="search" />
        </button>
        <LibraryContents active={section} />
        <MoreMenu />
      </nav>
    </header>
  )
}

function WikiHeaderWide({ variant = "home", section }: WikiHeaderProps) {
  const { href, locale } = useWikiContext()
  const t = useWikiText()
  // Hero headers darken over the first 100px of scroll, as they start on top of the artwork.
  const headerRef = useRef<HTMLElement>(null)
  useScrollProgressVar(headerRef, 100)
  // A narrow bar shows the search as a button; pressing it swaps the sections for the field.
  const [searching, setSearching] = useState(false)
  const searchButton = useRef<HTMLButtonElement>(null)
  useFocusAfterClose(searching, searchButton)
  return (
    <header ref={headerRef} data-variant={variant} className="wiki-header">
      <div className="wiki-header-inner" data-searching={searching || undefined}>
        <div className="public-app-theme wiki-header-brand" data-appearance="wiki">
          <a className="wiki-header-logo" href={href("/")} aria-label={`${SITE_NAME} — ${t("Trang chủ", "Home")}`}>
            <img src={WIKI_LOGO_URL} alt="" width={32} height={32} fetchPriority="high" />
          </a>
          <SectionSelector />
        </div>
        <TopNavigation active={section} />
        {/* A new field for each opening, so it takes focus as it mounts. */}
        {searching ? <WikiSearch key="open" autoFocus onDone={() => setSearching(false)} /> : <WikiSearch key="bar" />}
        <button
          ref={searchButton}
          type="button"
          className="wiki-header-search-toggle"
          aria-label={searching ? wikiText(locale, "Đóng tìm kiếm", "Close search") : t("Tìm kiếm", "Search")}
          aria-expanded={searching}
          onClick={() => setSearching((value) => !value)}
        >
          <Icon name={searching ? "close" : "search"} />
        </button>
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
