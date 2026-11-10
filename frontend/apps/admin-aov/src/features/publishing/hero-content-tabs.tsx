import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react"
import { Clapperboard, ImageIcon, LayoutDashboard, Shirt, Swords } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import type { HeroContentTab } from "./hero-location"
import { HeroAvatar, scrollParent } from "./hero-scroll-identity"
import { visibleSkins } from "./hero-skins"
import type { Content } from "./types"

type Icon = ComponentType<{ className?: string }>

/** The element id of a content tab's panel; links and the `?tab=` address land on it. */
export const heroContentSectionId = (tab: HeroContentTab) => `hero-content-${tab}`
export const heroContentTabId = (tab: HeroContentTab) => `hero-content-tab-${tab}`

export const HERO_CONTENT_TABS: readonly { key: HeroContentTab; icon: Icon; label: string }[] = [
  { key: "overview", icon: LayoutDashboard, label: "Tổng quan" },
  { key: "skills", icon: Swords, label: "Kỹ năng" },
  { key: "skins", icon: Shirt, label: "Trang phục" },
  { key: "media", icon: ImageIcon, label: "Ảnh" },
  { key: "videos", icon: Clapperboard, label: "Video" },
]

/** The tabs a hero shows: videos belong to a saved hero, so a new one has none yet. */
export const heroContentTabs = (videos: boolean) => HERO_CONTENT_TABS.filter((tab) => videos || tab.key !== "videos")

/**
 * The bars over the hero content. The top row (the workspace tabs) slides away while reading down and comes back on
 * the way up; the row under it (the content tabs) stays. Each `memoryKey` keeps its own scroll position, so coming
 * back to a tab, or picking the open one again, shows the place it was left at. A tab seen for the first time opens at
 * its start, unless the page header is still in view.
 */
export function HeroStickyBars({
  top,
  children,
  memoryKey,
  startKey,
  positions: shared,
}: {
  top: ReactNode
  /** The row that stays; `stuck` says the bars have reached the top of the page. */
  children: (stuck: boolean) => ReactNode
  memoryKey: string
  /** A new value brings the start of the content under the bars when it is above them, as when an editor opens. */
  startKey?: string | null
  /** Positions kept by the page, so they outlast the bars while another workspace tab is open. */
  positions?: Map<string, number>
}) {
  const marker = useRef<HTMLDivElement>(null)
  const topRow = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  const [tucked, setTucked] = useState(false)
  const [topHeight, setTopHeight] = useState(0)
  const own = useRef(new Map<string, number>())
  const positions = shared ?? own.current
  const current = useRef(memoryKey)
  const lastStart = useRef(startKey)
  // A position the page could not reach yet because the tab was still loading; it is taken once the page grows.
  const pending = useRef<{ target: number; until: number } | null>(null)
  const scrollTo = (root: HTMLElement, target: number) => {
    root.scrollTop = target
    pending.current = root.scrollTop < target - 1 ? { target, until: performance.now() + 2000 } : null
  }

  useLayoutEffect(() => {
    const row = topRow.current
    if (!row) return
    const measure = () => setTopHeight(row.offsetHeight)
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const mark = marker.current
    const root = mark && scrollParent(mark)
    if (!mark || !root) return
    let last = root.scrollTop
    const read = () => {
      const now = root.scrollTop
      // Recorded on every scroll, so the position is already known when a tab is left.
      positions.set(current.current, now)
      const reached = now > startOf(mark, root) + 0.5
      setStuck(reached)
      if (!reached) setTucked(false)
      else if (now > last + 2) setTucked(true)
      else if (now < last - 2) setTucked(false)
      last = now
    }
    // Reading, or any key or wheel turn, wins over a position still waiting for the page to grow.
    const cancel = () => (pending.current = null)
    const grown = () => {
      const wanted = pending.current
      if (!wanted) return
      if (performance.now() > wanted.until) return cancel()
      root.scrollTop = wanted.target
      if (root.scrollTop >= wanted.target - 1) cancel()
    }
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(grown)
    if (root.firstElementChild) observer?.observe(root.firstElementChild)
    read()
    root.addEventListener("scroll", read, { passive: true })
    root.addEventListener("wheel", cancel, { passive: true })
    root.addEventListener("touchstart", cancel, { passive: true })
    root.addEventListener("keydown", cancel)
    return () => {
      observer?.disconnect()
      root.removeEventListener("scroll", read)
      root.removeEventListener("wheel", cancel)
      root.removeEventListener("touchstart", cancel)
      root.removeEventListener("keydown", cancel)
    }
  }, [])

  // Runs after the new tab is on the page and before it is painted, so the switch never shows the old position.
  const mounted = useRef(false)
  useLayoutEffect(() => {
    const mark = marker.current
    const root = mark && scrollParent(mark)
    const previous = mounted.current ? current.current : null
    const startChanged = startKey !== lastStart.current
    mounted.current = true
    current.current = memoryKey
    lastStart.current = startKey
    if (!mark || !root) return
    if (startChanged && startKey) return scrollTo(root, Math.min(root.scrollTop, startOf(mark, root)))
    if (previous === memoryKey) return
    const saved = positions.get(memoryKey)
    // Opening the content again from another workspace tab returns to the place it was left at, when there is one.
    if (previous === null) {
      if (saved !== undefined) scrollTo(root, saved)
      return
    }
    scrollTo(root, saved ?? Math.min(root.scrollTop, startOf(mark, root)))
  }, [memoryKey, startKey])

  return (
    <>
      {/* Marks where the bars sit before they stick; the negative margin gives back the page's flex gap. */}
      <div ref={marker} aria-hidden="true" className="-mb-4 h-0 shrink-0" />
      <div
        data-slot="hero-sticky-bars"
        data-stuck={stuck}
        data-tucked={tucked}
        // Sticky bars are left out of scroll anchoring, so content loading above the screen does not push the page.
        className="sticky top-0 z-20 shrink-0 transition-transform duration-200 ease-out [overflow-anchor:none] motion-reduce:transition-none"
        style={tucked && topHeight ? { transform: `translateY(-${topHeight}px)` } : undefined}
      >
        {/* Reaching a workspace tab with the keyboard brings its row back. */}
        <div ref={topRow} onFocusCapture={() => setTucked(false)}>
          {top}
        </div>
        {children(stuck)}
      </div>
    </>
  )
}

/** The scroll position at which the bars reach the top of the page. */
function startOf(marker: HTMLElement, root: HTMLElement) {
  return marker.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop
}

/**
 * The content tabs. Once the page header has scrolled away, the hero's picture, name and switcher open at the start of
 * the row, so the tabs always follow the hero they belong to.
 */
export function HeroContentTabs({
  tab,
  onTab,
  content,
  videos,
  editingTab,
  busy,
  stuck,
  assetId,
  name,
  switcher,
}: {
  tab: HeroContentTab
  onTab: (tab: HeroContentTab) => void
  content?: Content
  videos: boolean
  /** The tab whose editor is open, marked so it can be found again from the other tabs. */
  editingTab?: HeroContentTab | null
  busy: boolean
  stuck: boolean
  assetId?: string | null
  name: string
  switcher?: ReactNode
}) {
  const counts: Partial<Record<HeroContentTab, number>> = {
    skills: content?.SKILLS?.skills.length ?? 0,
    skins: visibleSkins(content?.SKINS?.skins ?? []).length,
  }
  return (
    <div className={cn("flex h-12 min-w-0 items-stretch border-b bg-background", stuck && "shadow-sm")}>
      <div
        data-slot="hero-content-identity"
        aria-hidden={!stuck}
        inert={!stuck}
        className={cn(
          "flex min-w-0 shrink-0 items-center gap-2 overflow-hidden transition-[max-width,opacity] duration-200 motion-reduce:transition-none",
          stuck ? "max-w-[18rem] pr-2 opacity-100 @max-2xl:max-w-24" : "max-w-0 opacity-0",
        )}
      >
        {stuck && (
          <>
            <HeroAvatar assetId={assetId} name={name} />
            <span className="min-w-0 truncate text-sm font-semibold @max-2xl:sr-only">{name}</span>
            {switcher && <div className="-ml-1 shrink-0">{switcher}</div>}
          </>
        )}
      </div>
      <div
        role="tablist"
        aria-label="Mục nội dung tướng"
        className="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] @2xl:gap-0.5"
      >
        {heroContentTabs(videos).map(({ key, icon: TabIcon, label }) => {
          const selected = tab === key
          const count = counts[key]
          const edited = editingTab === key
          return (
            <Button
              key={key}
              id={heroContentTabId(key)}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={heroContentSectionId(key)}
              disabled={busy}
              variant="ghost"
              size="sm"
              className={cn(
                "relative h-12 shrink-0 rounded-b-none border-b-2 @2xl:px-2.5",
                // Narrow: icon over label, the tabs sharing the width so none is cut.
                "@max-2xl:min-w-0 @max-2xl:flex-auto @max-2xl:flex-col @max-2xl:gap-0.5 @max-2xl:px-0.5 @max-2xl:text-xs @max-2xl:has-[>svg]:px-0.5",
                selected ? "border-primary text-primary" : "border-transparent text-muted-foreground",
              )}
              onClick={() => onTab(key)}
            >
              <TabIcon className="size-4" />
              <span className="max-w-full truncate">{label}</span>
              {count !== undefined && <span className="type-meta tabular-nums @max-2xl:hidden">{count}</span>}
              {edited && (
                <>
                  <span aria-hidden="true" className="absolute top-2 right-1 size-1.5 rounded-full bg-primary" />
                  <span className="sr-only"> · đang sửa</span>
                </>
              )}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
