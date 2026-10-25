import { useEffect, useRef, type ReactNode, type RefObject } from "react"
import { cn } from "@aov/ui/lib/utils"
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

type IconName = "search" | "globe" | "user" | "chevron" | "check" | "home" | "more" | "close" | "chevronRight"

const ICON_PATHS: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
    </>
  ),
  chevron: <path d="m8 10 4 4 4-4" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  home: (
    <>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="18" cy="12" r="1" fill="currentColor" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  chevronRight: <path d="m10 8 4 4-4 4" />,
}

function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={cn("size-5 shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  )
}

/**
 * Translucent dark surface shared by the header dropdown and popovers, like HoYoWiki.
 * Radii are written in px: rounded-md/lg/xl follow the shadcn --radius token, not Tailwind's defaults.
 */
const PANEL_SURFACE =
  "rounded-[12px] border border-white/10 bg-[#0b0d11e6] text-header-text shadow-[0_12px_40px_#0006] backdrop-blur-xl"

/** Compact round icon button on the right of the header. */
const UTILITY_BUTTON =
  "grid size-7 place-items-center rounded-full text-header-muted transition-colors hover:bg-white/7 hover:text-gold data-[state=open]:bg-white/7 data-[state=open]:text-gold"

/** Row of the area list, shared by the desktop dropdown and the phone "more" sheet. */
const SECTION_ROW =
  "flex min-h-15 cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm text-white/85 no-underline data-[disabled]:cursor-default data-[disabled]:opacity-60 data-[selected]:bg-gold/7"

/** Phone layout (≤640px): 28px outlined circle, like the HoYoWiki mobile header. */
const MOBILE_ROUND =
  "max-[640px]:size-7 max-[640px]:border max-[640px]:border-white/25 max-[640px]:bg-transparent max-[640px]:text-white"

/** AOVWiKi logotype. Plain strings, not cn(): tailwind-merge would treat the font family and weight as conflicting. */
function Wordmark({ size = "lg" }: { size?: "lg" | "sm" }) {
  const lg = size === "lg"
  const box = lg
    ? "gap-0.5 text-[20px] tracking-[-1.2px] max-[640px]:text-[18px]"
    : "gap-px text-[15px] tracking-[-0.6px]"
  const underline = lg
    ? "relative after:absolute after:-bottom-[5px] after:inset-x-0 after:h-[3px] after:-skew-x-[25deg] after:bg-amber-accent after:content-['']"
    : undefined
  return (
    <span className={`inline-flex items-baseline font-wordmark leading-none font-black text-[#f5eee0] italic ${box}`}>
      <span className={underline}>AOV</span>
      <span className="font-['Segoe_UI',sans-serif] font-[650] tracking-[-1px] text-gold">WiKi</span>
    </span>
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
    image: "/images/mole-logo-v4.png",
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
        className="size-9 shrink-0 rounded-[9px] border border-[#efc78466] bg-[#bd843f] object-cover"
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
  return (
    <>
      <SectionIcon section={section} />
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="flex items-center gap-2 leading-tight font-bold">
          {section.name}
          {section.soon && (
            <span className="rounded-full border border-white/15 px-[7px] py-px text-[10px] font-medium text-header-muted">
              Sắp ra mắt
            </span>
          )}
        </span>
        <span className="text-xs leading-[1.35] text-white/50">{section.description}</span>
      </span>
      {section.id === CURRENT_SECTION && <Icon name="check" className="size-4 text-gold" />}
    </>
  )
}

/** Desktop area switcher: chevron next to the wordmark. On phones the list lives in the "more" sheet. */
function SectionSelector() {
  const current = SECTIONS.find((s) => s.id === CURRENT_SECTION)!
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className="group grid h-8 w-6 place-items-center rounded-[6px] text-header-muted transition-colors hover:bg-white/7 hover:text-gold data-[state=open]:bg-white/7 data-[state=open]:text-gold max-[640px]:hidden"
        aria-label={`Chọn khu vực — đang ở ${current.label}`}
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
                <a href={s.href} aria-current={selected ? "page" : undefined}>
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
    const update = () => el.style.setProperty("--header-solid", String(Math.min(1, window.scrollY / distance)))
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [ref, distance])
}

/** Phone-only "more" sheet: area switcher, account and language, like the HoYoWiki mobile menu. */
function MoreMenu() {
  return (
    <Drawer>
      <DrawerTrigger className={cn(UTILITY_BUTTON, "hidden max-[640px]:grid", MOBILE_ROUND)} aria-label="Thêm">
        <Icon name="more" className="size-4" />
      </DrawerTrigger>
      <DrawerContent className="border-white/10 bg-[#202329] pb-[max(20px,env(safe-area-inset-bottom))] text-header-text data-[vaul-drawer-direction=bottom]:rounded-t-[16px]">
        <div className="relative px-4 pt-3 pb-4">
          <DrawerTitle className="text-center font-heading text-base font-bold text-header-text">Thêm</DrawerTitle>
          <DrawerDescription className="sr-only">Khu vực, tài khoản và ngôn ngữ</DrawerDescription>
          <DrawerClose
            className="absolute top-2 right-3 grid size-8 place-items-center rounded-full text-header-muted hover:text-white"
            aria-label="Đóng"
          >
            <Icon name="close" className="size-[18px]" />
          </DrawerClose>
        </div>
        <div className="flex flex-col gap-3 px-4">
          <nav aria-label="Khu vực" className="flex flex-col gap-1">
            {SECTIONS.map((s) => {
              const selected = s.id === CURRENT_SECTION
              return s.href ? (
                <a
                  key={s.id}
                  href={s.href}
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
            <span className="min-w-0 flex-1 text-[13px] leading-snug text-[#b2b4bc]">
              Đăng nhập để lưu nội dung yêu thích
            </span>
            <span className="rounded-full border border-white/25 px-3 py-1.5 text-xs text-header-muted">
              Sắp ra mắt
            </span>
          </div>
          <div className="flex h-12 items-center gap-3 border-b border-white/8 px-1 text-sm">
            <Icon name="globe" className="size-[18px] text-header-muted" />
            <span className="flex-1">Ngôn ngữ</span>
            <span className="text-xs text-header-muted">Tiếng Việt</span>
            <Icon name="chevronRight" className="size-4 text-header-muted" />
          </div>
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

export function WikiHeader() {
  // Phone header starts transparent over the page background and turns solid over the first 100px of scroll.
  const headerRef = useRef<HTMLElement>(null)
  useScrollProgressVar(headerRef, 100)
  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 h-12 border-b border-header-line bg-header backdrop-blur-[20px] backdrop-saturate-[1.4] max-[640px]:h-11 max-[640px]:border-transparent max-[640px]:bg-transparent max-[640px]:backdrop-blur-none max-[640px]:backdrop-saturate-100"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden border-b border-header-line bg-[#202329] opacity-[var(--header-solid,0)] max-[640px]:block"
      />
      {/* Three-column grid: equal 1fr side columns keep the search box centered;
          max-content stops it from overlapping the brand or the utilities.
          Below 860px the search collapses to a button and the grid becomes a flex row.
          Below 640px the brand is centered absolutely between the round buttons. */}
      <div className="relative grid h-full grid-cols-[minmax(max-content,1fr)_minmax(0,540px)_minmax(max-content,1fr)] items-center gap-9 px-6 max-[1100px]:gap-6 max-[1100px]:px-5 max-[860px]:flex max-[860px]:justify-between max-[640px]:px-[15px]">
        <a
          href="/"
          aria-label="Trang chủ"
          className="hidden size-7 place-items-center rounded-full border border-white/25 text-white transition-colors hover:border-gold/60 hover:text-gold max-[640px]:grid"
        >
          <Icon name="home" className="size-4" />
        </a>
        <div className="flex min-w-0 shrink-0 items-center gap-2.5 max-[640px]:absolute max-[640px]:left-1/2 max-[640px]:-translate-x-1/2 max-[640px]:gap-2">
          <a className="group shrink-0 rounded-[9px]" href="/" aria-label="AOV Wiki — Trang chủ">
            <img
              className="block size-7 rounded-[8px] border border-[#efc78480] bg-[#bd843f] object-cover transition-transform duration-200 group-hover:-translate-y-px group-hover:-rotate-4 max-[640px]:size-6 max-[640px]:rounded-[7px]"
              src="/images/mole-logo-v4.png"
              alt=""
              width="28"
              height="28"
              fetchPriority="high"
            />
          </a>
          <div className="flex items-center gap-0.5">
            <a
              className="inline-flex shrink-0 pt-0.5 pr-1 pb-1.5 no-underline"
              href="/"
              tabIndex={-1}
              aria-hidden="true"
            >
              <Wordmark />
            </a>
            <SectionSelector />
          </div>
        </div>

        <div
          className="col-start-2 flex h-7 w-full items-center gap-2 rounded-[23px] border border-header-line bg-black/25 pr-3 pl-2.5 text-white/45 transition-colors hover:border-white/15 max-[860px]:hidden"
          role="search"
        >
          <Icon name="search" className="size-4" />
          <input
            type="search"
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-white/85 outline-none placeholder:text-white/45 disabled:cursor-not-allowed"
            aria-label="Tìm kiếm wiki — sắp ra mắt"
            placeholder="Tìm kiếm"
            disabled
          />
          <span className="text-[10px] whitespace-nowrap text-white/35 max-[1100px]:hidden">Sắp ra mắt</span>
        </div>

        <nav
          className="col-start-3 flex items-center gap-6 justify-self-end max-[1100px]:gap-4 max-[640px]:gap-3"
          aria-label="Tiện ích"
        >
          <HeaderPanel
            label="Tìm kiếm"
            className={cn(UTILITY_BUTTON, "hidden max-[860px]:grid", MOBILE_ROUND)}
            trigger={<Icon name="search" className="max-[640px]:size-4" />}
          >
            <PanelTitle>Tìm kiếm wiki</PanelTitle>
            <PanelText>Tìm kiếm tướng, trang phục và trang bị sẽ sớm có mặt.</PanelText>
          </HeaderPanel>
          <HeaderPanel
            label="Ngôn ngữ: Tiếng Việt"
            className="flex h-7 items-center gap-1.5 rounded-[8px] border border-white/25 pr-1 pl-1.5 text-xs text-header-muted transition-colors hover:border-white/40 hover:text-header-text data-[state=open]:border-white/40 data-[state=open]:text-header-text max-[640px]:hidden"
            trigger={
              <>
                <Icon name="globe" className="size-[18px]" />
                <span className="min-w-[15px]">VI</span>
                <Icon name="chevron" className="size-[18px]" />
              </>
            }
          >
            <PanelTitle>Ngôn ngữ</PanelTitle>
            <p className="flex items-center justify-between rounded-[6px] bg-primary/8 p-2.5 text-[13px]">
              Tiếng Việt <Icon name="check" className="size-4 text-primary" />
            </p>
          </HeaderPanel>
          <HeaderPanel
            label="Tài khoản"
            className={cn(UTILITY_BUTTON, "border border-white/10 bg-[#2a2e37] max-[640px]:hidden")}
            trigger={<Icon name="user" className="size-[18px]" />}
          >
            <p className="mb-2 text-[9px] tracking-[1px] text-primary">CHÀO NHÀ THÁM HIỂM</p>
            <PanelTitle>Góc của bạn</PanelTitle>
            <PanelText>Đăng nhập và lưu nội dung yêu thích sẽ sớm có mặt.</PanelText>
          </HeaderPanel>
          <MoreMenu />
        </nav>
      </div>
    </header>
  )
}
