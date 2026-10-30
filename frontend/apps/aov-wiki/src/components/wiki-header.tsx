import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { cn } from "@aov/ui/lib/utils"
import { aovMarkUrl } from "@aov/ui/lib/brand"
import { AovMark, AovWordmark } from "@aov/ui/components/aov-brand"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@aov/ui/components/drawer"
import "./wiki-header.css"
import { useWikiContext, wikiText } from "../context/wiki-context"
import { WikiPreferenceControls } from "../context/wiki-preferences"
import { WikiIcon } from "./wiki-icon"

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

/** Row of the area list, shared by the desktop dropdown and the phone "more" sheet. */
const SECTION_ROW =
  "flex min-h-15 cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm text-white/85 no-underline data-[disabled]:cursor-default data-[disabled]:opacity-60 data-[selected]:bg-gold/7"

/** Phone layout (≤640px): 28px outlined circle, like the HoYoWiki mobile header. */
const MOBILE_ROUND =
  "max-[640px]:size-7 max-[640px]:border max-[640px]:border-white/25 max-[640px]:bg-transparent max-[640px]:text-white"

function Wordmark({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <AovWordmark
      className={cn("text-[#f5eee0]", size === "lg" ? "text-[22px] max-[640px]:text-[18px]" : "text-[16px]")}
    />
  )
}

type Section = {
  id: string
  /** Display name; may be a node, e.g. the AOVWiKi wordmark. */
  name: ReactNode
  label: string
  description: string
  /** Icon image path under `public/`. Leave empty to show a placeholder slot. */
  image?: string
  href?: string
  soon?: boolean
}

/** Areas of the AOV site, like the game selector on HoYoWiki. */
const SECTIONS: Section[] = [
  {
    id: "wiki",
    name: <Wordmark size="sm" />,
    label: "AOV WiKi",
    description: "Tra cứu tướng, trang bị, phù hiệu",
    image: aovMarkUrl,
    href: "/",
  },
  {
    id: "stream",
    name: "Stream",
    label: "Stream",
    description: "Xem trực tiếp các trận đấu",
    // image: "/images/stream-icon.png", // TODO: add the Stream icon
    soon: true,
  },
]
const CURRENT_SECTION = "wiki"

function SectionIcon({ section }: { section: Section }) {
  if (section.image) {
    return (
      <img
        className="size-9 shrink-0 rounded-[9px] border border-[#c9a86a33] bg-[#18181b] object-contain p-1.5"
        src={section.image}
        alt=""
        width="36"
        height="36"
      />
    )
  }
  return (
    <span
      className="size-9 shrink-0 rounded-[9px] border border-dashed border-white/25 bg-white/4"
      aria-hidden="true"
    />
  )
}

/** One area row: icon, name (+ coming-soon badge), description and a check when current. */
function SectionItemBody({ section }: { section: Section }) {
  const { locale, t } = useWikiContext()
  return (
    <>
      <SectionIcon section={section} />
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="flex items-center gap-2 leading-tight font-bold">
          {section.name}
          {section.soon && (
            <span className="rounded-full border border-white/15 px-[7px] py-px text-[10px] font-medium text-header-muted">
              {t("comingSoon")}
            </span>
          )}
        </span>
        <span className="text-xs leading-[1.35] text-white/50">
          {wikiText(
            locale,
            section.description,
            section.id === "wiki" ? "Explore the Arena of Valor wiki" : "Watch live matches",
          )}
        </span>
      </span>
      {section.id === CURRENT_SECTION && <Icon name="check" className="size-4 text-gold" />}
    </>
  )
}

/** Desktop area switcher: chevron next to the wordmark. On phones the list lives in the "more" sheet. */
function SectionSelector() {
  const { t, href } = useWikiContext()
  const current = SECTIONS.find((s) => s.id === CURRENT_SECTION)!
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className="group grid h-8 w-6 place-items-center rounded-[6px] text-header-muted transition-colors hover:bg-white/7 hover:text-gold data-[state=open]:bg-white/7 data-[state=open]:text-gold max-[640px]:hidden"
        aria-label={`${t("application")} — ${current.label}`}
      >
        <Icon
          name="chevron"
          className="size-[18px] transition-transform duration-200 group-data-[state=open]:rotate-180"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        alignOffset={-102}
        sideOffset={12}
        className={cn(PANEL_SURFACE, "min-w-[280px] p-2")}
      >
        {SECTIONS.map((s) => {
          const selected = s.id === CURRENT_SECTION
          return (
            <DropdownMenuItem
              key={s.id}
              className={SECTION_ROW + " focus:bg-white/8 focus:text-white"}
              data-selected={selected || undefined}
              disabled={s.soon}
              asChild={!!s.href}
            >
              {s.href ? (
                <a href={href(s.href)} aria-current={selected ? "page" : undefined}>
                  <SectionItemBody section={s} />
                </a>
              ) : (
                <SectionItemBody section={s} />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function HeaderPanel({
  label,
  className,
  trigger,
  children,
}: {
  label: string
  className?: string
  trigger: ReactNode
  children: ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger className={className} aria-label={label}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={12} className={cn(PANEL_SURFACE, "w-[min(300px,calc(100vw-24px))] p-5")}>
        {children}
      </PopoverContent>
    </Popover>
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

/** Phone-only "more" sheet: area switcher, account and language, like the HoYoWiki mobile menu. */
function MoreMenu({ onOpenContents }: { onOpenContents?: () => void }) {
  const { t, href } = useWikiContext()
  const openContentsAfterClose = useRef(false)

  return (
    <Drawer>
      <DrawerTrigger
        className={cn(UTILITY_BUTTON, "wiki-header-mobile-control hidden max-[640px]:grid", MOBILE_ROUND)}
        aria-label={t("more")}
      >
        <Icon name="more" className="size-4" />
      </DrawerTrigger>
      <DrawerContent
        className="border-white/10 bg-[#202329] pb-[max(20px,env(safe-area-inset-bottom))] text-header-text data-[vaul-drawer-direction=bottom]:rounded-t-[16px]"
        onCloseAutoFocus={(event) => {
          if (!openContentsAfterClose.current) return

          event.preventDefault()
          openContentsAfterClose.current = false
          onOpenContents?.()
        }}
      >
        <div className="relative px-4 pt-3 pb-4">
          <DrawerTitle className="text-center font-heading text-base font-bold text-header-text">
            {t("more")}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            {t("application")}, {t("market")}, {t("language")}
          </DrawerDescription>
          <DrawerClose
            className="absolute top-2 right-3 grid size-8 place-items-center rounded-full text-header-muted hover:text-white"
            aria-label={t("close")}
          >
            <Icon name="close" className="size-[18px]" />
          </DrawerClose>
        </div>
        <div className="flex flex-col gap-3 px-4">
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
          <nav aria-label={t("application")} className="flex flex-col gap-1">
            {SECTIONS.map((s) => {
              const selected = s.id === CURRENT_SECTION
              return s.href ? (
                <a
                  key={s.id}
                  href={href(s.href)}
                  className={SECTION_ROW + " hover:bg-white/8"}
                  data-selected={selected || undefined}
                  aria-current={selected ? "page" : undefined}
                >
                  <SectionItemBody section={s} />
                </a>
              ) : (
                <div key={s.id} className={SECTION_ROW} data-disabled="" aria-disabled="true">
                  <SectionItemBody section={s} />
                </div>
              )
            })}
          </nav>
          <div className="flex items-center gap-3 rounded-[12px] bg-white/5 p-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-white/10 bg-[#2a2e37] text-header-muted">
              <Icon name="user" className="size-5" />
            </span>
            <span className="min-w-0 flex-1 text-[13px] leading-snug text-[#b2b4bc]">{t("signInNote")}</span>
            <span className="rounded-full border border-white/25 px-3 py-1.5 text-xs text-header-muted">
              {t("comingSoon")}
            </span>
          </div>
          <WikiPreferenceControls mobile />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function PanelTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2.5 font-heading text-base font-bold">{children}</h2>
}

function PanelText({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-[1.7] text-[#b2b4bc]">{children}</p>
}

const SEARCH_SCOPES = {
  heroes: { path: "/hero", titleKey: "searchHeroes" },
  skins: { path: "/skins", titleKey: "searchSkins" },
  warehouse: { path: "/warehouse", titleKey: "searchWarehouse" },
} as const

function LibrarySearch({ mobile = false, scope }: { mobile?: boolean; scope: keyof typeof SEARCH_SCOPES }) {
  const navigate = useNavigate()
  const { t, href, locale } = useWikiContext()
  const [params] = useSearchParams()
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const target = SEARCH_SCOPES[scope]

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = new URLSearchParams()
    if (scope === "warehouse" && params.get("tab")) query.set("tab", params.get("tab")!)
    if (search.trim()) query.set("q", search.trim())
    navigate(href(`${target.path}${query.size ? `?${query}` : ""}`))
    setOpen(false)
  }

  const form = (
    <form
      role="search"
      onSubmit={submit}
      className={cn(
        "flex h-8 min-w-0 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 text-header-muted focus-within:border-gold/50",
        !mobile && "col-start-2 w-full max-[860px]:hidden",
      )}
    >
      <Icon name="search" className="size-4" />
      <input
        type="search"
        enterKeyHint="search"
        aria-label={`${t(target.titleKey)} ${wikiText(locale, "trong wiki", "in the wiki")}`}
        placeholder={`${t(target.titleKey)}…`}
        maxLength={120}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-[13px] text-white/85 outline-none placeholder:text-white/45",
          mobile && "text-base",
        )}
      />
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
      <PopoverContent align="end" sideOffset={12} className={cn(PANEL_SURFACE, "w-[min(320px,calc(100vw-24px))] p-4")}>
        <PanelTitle>{t(target.titleKey)}</PanelTitle>
        {form}
      </PopoverContent>
    </Popover>
  )
}

interface WikiHeaderProps {
  variant?: "home" | "library" | "hero"
  pageTitle?: string
  onOpenContents?: () => void
  feedback?: ReactNode
  searchScope?: keyof typeof SEARCH_SCOPES
}

export function WikiHeader({
  variant = "home",
  pageTitle,
  onOpenContents,
  feedback,
  searchScope = "heroes",
}: WikiHeaderProps) {
  const { t, href, locale } = useWikiContext()
  // Hero headers on every viewport and the home phone header darken over the first 100px of scroll.
  const headerRef = useRef<HTMLElement>(null)
  useScrollProgressVar(headerRef, 100)
  return (
    <header
      ref={headerRef}
      data-variant={variant}
      className={cn(
        "wiki-header sticky top-0 z-40 h-12 border-b border-header-line bg-header backdrop-blur-[20px] backdrop-saturate-[1.4] max-[640px]:h-11 max-[640px]:border-transparent max-[640px]:bg-transparent max-[640px]:backdrop-blur-none max-[640px]:backdrop-saturate-100",
        variant === "library" && "bg-[#2b3340] max-[640px]:bg-[#2b3340]",
      )}
    >
      {variant !== "hero" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden border-b border-header-line bg-[#202329] opacity-[var(--header-solid,0)] max-[640px]:block"
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
            "flex min-w-0 shrink-0 items-center gap-2.5 max-[640px]:absolute max-[640px]:left-1/2 max-[640px]:-translate-x-1/2 max-[640px]:gap-2",
            (pageTitle || variant === "hero") && "max-[640px]:hidden",
          )}
        >
          <a className="group shrink-0 rounded-[9px]" href={href("/")} aria-label={`AOV Wiki — ${t("home")}`}>
            <AovMark
              className="block size-8 transition-opacity group-hover:opacity-80 max-[640px]:size-7"
              fetchPriority="high"
            />
          </a>
          <div className="flex items-center gap-0.5">
            <a className="inline-flex shrink-0 pr-1 no-underline" href={href("/")} tabIndex={-1} aria-hidden="true">
              <Wordmark />
            </a>
            <SectionSelector />
          </div>
        </div>

        {pageTitle && variant !== "hero" && (
          <span className="wiki-header-page-title absolute left-1/2 hidden max-w-[calc(100%-240px)] -translate-x-1/2 truncate font-[Cambria,serif] text-base font-bold text-gold max-[640px]:block">
            {pageTitle.replace(/^Thư viện\s+/u, "")}
          </span>
        )}

        {variant !== "home" ? (
          <LibrarySearch scope={searchScope} />
        ) : (
          <div
            className="col-start-2 flex h-7 w-full items-center gap-2 rounded-[23px] border border-header-line bg-black/25 pr-3 pl-2.5 text-white/45 transition-colors hover:border-white/15 max-[860px]:hidden"
            role="search"
          >
            <Icon name="search" className="size-4" />
            <input
              type="search"
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-white/85 outline-none placeholder:text-white/45 disabled:cursor-not-allowed"
              aria-label={`${t("search")} — ${t("comingSoon")}`}
              placeholder={t("search")}
              disabled
            />
            <span className="text-[10px] whitespace-nowrap text-white/35 max-[1100px]:hidden">{t("comingSoon")}</span>
          </div>
        )}

        <nav
          className="col-start-3 flex items-center gap-3 justify-self-end max-[640px]:gap-1"
          aria-label={t("utilities")}
        >
          {variant !== "home" ? (
            <LibrarySearch mobile scope={searchScope} />
          ) : (
            <HeaderPanel
              label={t("search")}
              className={cn(UTILITY_BUTTON, "hidden max-[860px]:grid", MOBILE_ROUND)}
              trigger={<Icon name="search" className="max-[640px]:size-4" />}
            >
              <PanelTitle>{t("search")}</PanelTitle>
              <PanelText>
                {wikiText(
                  locale,
                  "Tìm kiếm tướng, trang phục và trang bị sẽ sớm có mặt.",
                  "Global search is coming soon.",
                )}
              </PanelText>
            </HeaderPanel>
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
          {feedback && <span className="inline-flex max-[640px]:hidden">{feedback}</span>}
          <WikiPreferenceControls />
          <HeaderPanel
            label={t("account")}
            className={cn(UTILITY_BUTTON, "border border-white/10 bg-[#2a2e37] max-[640px]:hidden")}
            trigger={<Icon name="user" className="size-[18px]" />}
          >
            <p className="mb-2 text-[9px] tracking-[1px] text-primary">
              {wikiText(locale, "CHÀO NHÀ THÁM HIỂM", "WELCOME, EXPLORER")}
            </p>
            <PanelTitle>{wikiText(locale, "Góc của bạn", "Your corner")}</PanelTitle>
            <PanelText>
              {wikiText(
                locale,
                "Đăng nhập và lưu nội dung yêu thích sẽ sớm có mặt.",
                "Sign-in and saved favorites are coming soon.",
              )}
            </PanelText>
          </HeaderPanel>
          <MoreMenu onOpenContents={variant === "hero" ? onOpenContents : undefined} />
        </nav>
      </div>
    </header>
  )
}
