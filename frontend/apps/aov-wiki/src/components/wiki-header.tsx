import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { cn } from "@aov/ui/lib/utils"
import { publicSiteUrl } from "@aov/ui/lib/public-site-url"
import { PublicAppOptionBody, PublicAppWordmark } from "@aov/ui/components/public-app-brand"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/public-overlay"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/public-overlay"
import { DrawerClose } from "@aov/ui/components/drawer"
import { PublicPreferencesDrawer } from "@aov/ui/components/public-preferences-drawer"
import "./wiki-header.css"
import { useWikiContext, wikiText } from "../context/wiki-context"
import { WikiPreferenceControls } from "../context/wiki-preferences"
import { wikiSections } from "../layout/wiki-sections"
import { WikiIcon } from "./wiki-icon"
import { WikiSearchSuggestions } from "./wiki-search-suggestions"
import { WikiAccountMenu } from "../features/auth/wiki-account"

type IconName =
  "search" | "globe" | "user" | "chevron" | "check" | "home" | "more" | "close" | "chevronRight" | "contents"

function Icon({ name, className }: { name: IconName; className?: string }) {
  return <WikiIcon name={name} className={cn("size-5 shrink-0", className)} />
}

/**
 * Translucent dark surface shared by the header dropdown and popovers, like HoYoWiki.
 * Radii are written in px: rounded-md/lg/xl follow the shadcn --radius token, not Tailwind's defaults.
 */
const PANEL_SURFACE =
  "rounded-[12px] border border-white/10 bg-[#0b0d11e6] text-header-text shadow-[0_12px_40px_#0006] backdrop-blur-xl"

/** Compact round icon button on the right of the header. */
const UTILITY_BUTTON =
  "wiki-header-utility grid size-9 place-items-center rounded-full text-header-muted transition-colors hover:bg-white/7 hover:text-gold data-[state=open]:bg-white/7 data-[state=open]:text-gold"

/** Phone layout (≤640px): 28px outlined circle, like the HoYoWiki mobile header. */
const MOBILE_ROUND =
  "max-[640px]:size-7 max-[640px]:border max-[640px]:border-white/25 max-[640px]:bg-transparent max-[640px]:text-white"

const WIKI_LOGO_URL = "/images/mole-logo-v4.png"
const STREAM_URL = publicSiteUrl(import.meta.env.VITE_STREAM_URL, 5174, window.location.origin)

type Section = {
  id: "wiki" | "stream"
  product: "Wiki" | "Stream"
  label: string
  description: string
  image: string
  href: string
}

/** Areas of the AOV site, like the game selector on HoYoWiki. */
const SECTIONS: Section[] = [
  {
    id: "wiki",
    product: "Wiki",
    label: "AOV Wiki",
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

/** Desktop area switcher: chevron next to the wordmark. On phones the list lives in the "more" sheet. */
function SectionSelector() {
  const { t, href } = useWikiContext()
  const current = SECTIONS.find((s) => s.id === CURRENT_SECTION)!
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className="public-app-trigger wiki-app-switcher"
        data-product="wiki"
        aria-label={`${t("application")} — ${current.label}`}
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
        drawerTitle={t("application")}
        data-appearance="wiki"
      >
        <div className="public-app-menu-title">{t("application")}</div>
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

/** Phone-only sheet for navigation, account preferences and optional table of contents. */
function MoreMenu({ onOpenContents }: { onOpenContents?: () => void }) {
  const { t, href, locale } = useWikiContext()
  const openContentsAfterClose = useRef(false)

  return (
    <PublicPreferencesDrawer
      product="wiki"
      locale={locale}
      trigger={
        <button
          type="button"
          className={cn(UTILITY_BUTTON, "wiki-header-mobile-control hidden max-[640px]:grid", MOBILE_ROUND)}
          aria-label={t("more")}
        >
          <Icon name="more" className="size-4" />
        </button>
      }
      onCloseAutoFocus={(event) => {
        if (!openContentsAfterClose.current) return
        event.preventDefault()
        openContentsAfterClose.current = false
        onOpenContents?.()
      }}
    >
      <WikiAccountMenu inline />
      {onOpenContents && (
        <DrawerClose asChild>
          <button
            type="button"
            className="flex min-h-12 items-center gap-3 rounded-[8px] px-3 text-left text-sm text-gold hover:bg-white/8"
            onClick={() => {
              openContentsAfterClose.current = true
            }}
          >
            <Icon name="contents" className="size-[18px]" />
            <span className="flex-1">{t("contents")}</span>
            <Icon name="chevronRight" className="size-4" />
          </button>
        </DrawerClose>
      )}
      <div className="public-preferences-label">{t("application")}</div>
      <nav aria-label={t("application")} className="public-preferences-apps" data-appearance="wiki">
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

function PanelTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2.5 type-section-title">{children}</h2>
}

const SEARCH_SCOPES = {
  heroes: { path: "/hero", titleKey: "searchHeroes" },
  skins: { path: "/skins", titleKey: "searchSkins" },
  warehouse: { path: "/warehouse", titleKey: "searchWarehouse" },
} as const

function LibrarySearch({
  mobile = false,
  chooseSection = false,
  scope,
}: {
  mobile?: boolean
  chooseSection?: boolean
  scope: keyof typeof SEARCH_SCOPES
}) {
  const navigate = useNavigate()
  const { t, href, locale } = useWikiContext()
  const [params] = useSearchParams()
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [sectionKey, setSectionKey] = useState<string>("heroes")
  const section = wikiSections.find((entry) => entry.key === sectionKey) ?? wikiSections[0]
  const target = SEARCH_SCOPES[scope]
  const title = chooseSection ? t(section.key) : t(target.titleKey)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const destination = new URL(chooseSection ? section.path : target.path, window.location.origin)
    if (!chooseSection && scope === "warehouse" && params.get("tab"))
      destination.searchParams.set("tab", params.get("tab")!)
    if (search.trim()) destination.searchParams.set("q", search.trim())
    navigate(href(destination.pathname + destination.search))
    setOpen(false)
  }

  const form = (
    <form
      role="search"
      onSubmit={submit}
      className={cn(
        "relative flex h-8 min-w-0 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 text-header-muted focus-within:border-gold/50",
        !mobile && "col-start-2 w-full max-[860px]:hidden",
      )}
    >
      <Icon name="search" className="size-4" />
      {chooseSection && (
        <select
          className="wiki-search-domain"
          aria-label={wikiText(locale, "Danh mục tìm kiếm", "Search category")}
          value={sectionKey}
          onChange={(event) => setSectionKey(event.target.value)}
        >
          {wikiSections
            .filter((entry) => entry.key !== "updates")
            .map((entry) => (
              <option key={entry.key} value={entry.key}>
                {t(entry.key)}
              </option>
            ))}
        </select>
      )}
      <input
        type="search"
        enterKeyHint="search"
        aria-label={chooseSection ? `${t("search")} · ${title}` : title}
        placeholder={`${chooseSection ? t("search") : title}…`}
        maxLength={120}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-sm text-white/85 outline-none placeholder:text-white/45",
          mobile && "text-base",
        )}
      />
      {focused && (
        <WikiSearchSuggestions
          search={search}
          onPick={() => {
            setSearch("")
            setOpen(false)
          }}
        />
      )}
    </form>
  )

  if (!mobile) return form

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(UTILITY_BUTTON, "wiki-header-mobile-control hidden max-[860px]:grid", MOBILE_ROUND)}
        aria-label={t("search")}
      >
        <Icon name="search" className="max-[640px]:size-4" />
      </PopoverTrigger>
      <PopoverContent
        drawerTitle={chooseSection ? t("search") : title}
        align="end"
        sideOffset={12}
        className={cn(PANEL_SURFACE, "w-[min(320px,calc(100vw-24px))] p-4")}
      >
        <PanelTitle>{chooseSection ? t("search") : title}</PanelTitle>
        {form}
      </PopoverContent>
    </Popover>
  )
}

interface WikiHeaderProps {
  variant?: "home" | "library" | "hero"
  pageTitle?: string
  onOpenContents?: () => void
  searchScope?: keyof typeof SEARCH_SCOPES
}

export function WikiHeader({ variant = "home", pageTitle, onOpenContents, searchScope = "heroes" }: WikiHeaderProps) {
  const { t, href } = useWikiContext()
  // Hero headers on every viewport and the home phone header darken over the first 100px of scroll.
  const headerRef = useRef<HTMLElement>(null)
  useScrollProgressVar(headerRef, 100)
  return (
    <header
      ref={headerRef}
      data-variant={variant}
      className={cn(
        "wiki-header sticky top-0 z-40 h-12 border-b border-header-line bg-header backdrop-blur-[20px] backdrop-saturate-[1.4] max-[640px]:h-11 max-[640px]:border-transparent max-[640px]:bg-transparent max-[640px]:backdrop-blur-none max-[640px]:backdrop-saturate-100",
        variant === "library" && "bg-background",
      )}
    >
      {variant !== "hero" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden border-b border-header-line bg-background opacity-[var(--header-solid,0)] max-[640px]:block"
        />
      )}
      {/* Three-column grid: equal 1fr side columns keep the search box centered;
          max-content stops it from overlapping the brand or the utilities.
          Below 860px the search collapses to a button and the grid becomes a flex row.
          Below 640px the brand is centered absolutely between the round buttons. */}
      <div className="relative grid h-full grid-cols-[minmax(max-content,1fr)_minmax(0,540px)_minmax(max-content,1fr)] items-center gap-9 px-6 max-[1100px]:gap-6 max-[1100px]:px-5 max-[860px]:flex max-[860px]:justify-between max-[640px]:px-[15px]">
        <a
          href={href("/")}
          aria-label={t("home")}
          className="wiki-header-mobile-control hidden size-7 place-items-center rounded-full border border-white/25 text-white transition-colors hover:border-gold/60 hover:text-gold max-[640px]:grid"
        >
          <Icon name="home" className="size-4" />
        </a>
        <div
          className={cn(
            "public-app-theme flex min-w-0 shrink-0 items-center gap-1 max-[640px]:absolute max-[640px]:left-1/2 max-[640px]:-translate-x-1/2 max-[640px]:gap-2",
            (pageTitle || variant === "hero") && "max-[640px]:hidden",
          )}
          data-appearance="wiki"
        >
          <a className="group shrink-0 rounded-[9px]" href={href("/")} aria-label={`AOV Wiki — ${t("home")}`}>
            <img
              src={WIKI_LOGO_URL}
              alt=""
              width={32}
              height={32}
              className="block size-8 rounded-[8px] border border-[#efc78480] bg-[#bd843f] object-cover transition-opacity group-hover:opacity-80 max-[640px]:size-7 max-[640px]:rounded-[7px]"
              fetchPriority="high"
            />
          </a>
          <a className="hidden max-[640px]:inline-flex" href={href("/")} tabIndex={-1} aria-hidden="true">
            <PublicAppWordmark product="Wiki" className="wiki-mobile-wordmark" />
          </a>
          <SectionSelector />
        </div>

        {pageTitle && variant !== "hero" && (
          <h1 className="wiki-header-page-title absolute left-1/2 hidden max-w-[calc(100%-240px)] -translate-x-1/2 truncate text-gold max-[640px]:block">
            {pageTitle.replace(/^Thư viện\s+/u, "")}
          </h1>
        )}

        {searchScope !== "warehouse" && <LibrarySearch scope={searchScope} chooseSection={variant === "home"} />}

        <nav
          className="col-start-3 flex items-center gap-3 justify-self-end max-[640px]:gap-1"
          aria-label={t("utilities")}
        >
          {searchScope !== "warehouse" && (
            <LibrarySearch mobile scope={searchScope} chooseSection={variant === "home"} />
          )}
          {onOpenContents && variant !== "hero" && (
            <button
              type="button"
              className={cn(UTILITY_BUTTON, "hidden max-[640px]:grid", MOBILE_ROUND)}
              aria-label={t("openContents")}
              onClick={onOpenContents}
            >
              <Icon name="contents" className="size-4" />
            </button>
          )}
          <WikiPreferenceControls />
          <span className="inline-flex max-[640px]:hidden">
            <WikiAccountMenu />
          </span>
          <MoreMenu onOpenContents={variant === "hero" ? onOpenContents : undefined} />
        </nav>
      </div>
    </header>
  )
}
