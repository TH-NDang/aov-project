import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type RefObject,
} from "react"
import { TableOfContents } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { cn } from "@aov/ui/lib/utils"

type Icon = ComponentType<{ className?: string }>

export interface ContentsEntry {
  /** Id of the `ContentsSection` the entry leads to. */
  id: string
  label: string
  icon?: Icon
  count?: number | null
}

/**
 * How wide the contents box must be before the list moves into a column on the right: a whole page keeps the room its
 * sections need, a side panel has less to give.
 */
export type ContentsLayout = "page" | "panel"

/** How far below the sticky bars a section counts as the one being read. */
const READING_GAP = 24
/** Room left between the sticky bars and a section's heading after a jump. */
const LANDING_GAP = 12
/** Lazy sections start loading this far before they scroll into view. */
const REVEAL_MARGIN = "600px 0px"

const COPY = { title: "Trên trang này", open: "Mở mục lục" }

export function scrollRoot(element: HTMLElement): HTMLElement | null {
  const view = element.ownerDocument.defaultView
  if (!view) return null
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (/^(auto|scroll|overlay)$/.test(view.getComputedStyle(parent).overflowY)) return parent
  }
  return null
}

/** The height of the bars that stay stuck above the sections, set as `--contents-offset` (px) on the contents box. */
function stickyOffset(wrapper: HTMLElement) {
  const value = wrapper.ownerDocument.defaultView?.getComputedStyle(wrapper).getPropertyValue("--contents-offset")
  return Number.parseFloat(value ?? "") || 0
}

/**
 * Looks inside this contents box only: pages kept open in other workspace tabs carry the same section ids, and a
 * document-wide lookup would find theirs first.
 */
function findSection(wrapper: HTMLElement, id: string) {
  return wrapper.querySelector<HTMLElement>(`[id="${id.replace(/["\\]/g, "\\$&")}"]`)
}

const FOLLOWING = 4 // Node.DOCUMENT_POSITION_FOLLOWING

/** Ids of the lazy sections still waiting up to and including `id`, in page order. */
function waitingThrough(wrapper: HTMLElement, id: string) {
  const target = findSection(wrapper, id)
  if (!target) return []
  return [...wrapper.querySelectorAll<HTMLElement>("[data-contents-pending]")]
    .filter((section) => section === target || section.compareDocumentPosition(target) & FOLLOWING)
    .map((section) => section.id)
}

/** The scrolling box's top edge on screen, so positions can be compared to it. */
function viewportTop(wrapper: HTMLElement) {
  const root = scrollRoot(wrapper)
  return root ? root.getBoundingClientRect().top : 0
}

/**
 * The section being read: the last one, going down, whose start has passed `line`. `atEnd` covers a final section too
 * short to ever reach the line.
 */
export function activeSection(positions: { id: string; top: number }[], line: number, atEnd: boolean) {
  if (atEnd) return positions.at(-1)?.id
  return positions.filter((section) => section.top <= line).at(-1)?.id ?? positions[0]?.id
}

/** True when the reader is already inside the section, so a request for it should leave the page where it is. */
function reading(wrapper: HTMLElement, id: string) {
  const section = findSection(wrapper, id)
  if (!section) return false
  if (section.contains(section.ownerDocument.activeElement)) return true
  const line = viewportTop(wrapper) + stickyOffset(wrapper) + READING_GAP
  const box = section.getBoundingClientRect()
  return box.height > 0 && box.top <= line && box.bottom > line
}

/** How long a section that was jumped to is held in place while the sections above it finish loading. */
const SETTLE_MS = 2500
const READER_INPUT = ["wheel", "touchstart", "pointerdown", "keydown"] as const

/**
 * Instant on purpose: an animated scroll stops short when images load in the sections it passes. Lazy sections and
 * images above the target keep growing after the jump, so the target is held under the sticky bars until the reader
 * scrolls, something else moves the page, or the content settles. Returns a function that lets go early.
 */
function scrollToSection(wrapper: HTMLElement, section: HTMLElement) {
  const view = wrapper.ownerDocument.defaultView
  const root = scrollRoot(wrapper)
  const box = root ?? wrapper.ownerDocument.scrollingElement
  if (!box || !view) {
    section.focus({ preventScroll: true })
    return () => {}
  }
  // Where the target sat after the last alignment; short pages may keep it lower than the sticky bars until more loads.
  let settled = 0
  const align = () => {
    const top = section.getBoundingClientRect().top - viewportTop(wrapper) - stickyOffset(wrapper) - LANDING_GAP
    if (Math.abs(top) > 1) box.scrollTop = Math.max(0, box.scrollTop + top)
    settled = section.getBoundingClientRect().top
  }
  align()
  section.focus({ preventScroll: true })
  if (typeof ResizeObserver === "undefined") return () => {}

  const observer = new ResizeObserver(align)
  observer.observe(wrapper)
  const scroller = root ?? view
  // A scroll that moves the target without a size change comes from someone else, e.g. a warning brought to the centre.
  const onScroll = () => {
    if (Math.abs(section.getBoundingClientRect().top - settled) > 2) release()
  }
  const timer = view.setTimeout(() => release(), SETTLE_MS)
  function release() {
    observer.disconnect()
    view!.clearTimeout(timer)
    scroller.removeEventListener("scroll", onScroll)
    for (const type of READER_INPUT) view!.removeEventListener(type, release, true)
  }
  scroller.addEventListener("scroll", onScroll, { passive: true })
  for (const type of READER_INPUT) view.addEventListener(type, release, { capture: true, passive: true })
  return release
}

export interface SectionContentsController {
  wrapper: RefObject<HTMLDivElement | null>
  /** Lazy sections that have been asked for or have come near the screen; they stay mounted afterwards. */
  revealed: ReadonlySet<string>
  reveal: (id: string) => void
  /**
   * Loads a section and every lazy one above it, so nothing above grows once the page is placed. Returns true when all
   * of them are already on the page.
   */
  prepare: (id: string) => boolean
  /** Scrolls a section under the sticky bars, loading it and the sections above it first. */
  jump: (id: string) => void
  active: string | undefined
  setActive: (id: string) => void
}

/**
 * State for one contents box. `requested` is the section an address asks for, such as `?tab=skills`: the page opens on
 * it and moves to it when it changes, unless the reader is already there. `first` opens without a jump.
 */
export function useSectionContents({ requested, first }: { requested?: string; first?: string } = {}) {
  const wrapper = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set(requested ? [requested] : []))
  const [pending, setPending] = useState<string | null>(null)
  const [active, setActive] = useState(requested ?? first)
  const handled = useRef<string | undefined>(undefined)
  const settling = useRef(() => {})
  const land = useCallback((root: HTMLElement, section: HTMLElement) => {
    settling.current()
    settling.current = scrollToSection(root, section)
  }, [])
  useEffect(() => () => settling.current(), [])

  const reveal = useCallback(
    (id: string) => setRevealed((current) => (current.has(id) ? current : new Set(current).add(id))),
    [],
  )
  const revealAll = useCallback(
    (ids: readonly string[]) =>
      setRevealed((current) => (ids.every((id) => current.has(id)) ? current : new Set([...current, ...ids]))),
    [],
  )
  const prepare = useCallback(
    (id: string) => {
      const root = wrapper.current
      const waiting = root ? waitingThrough(root, id) : [id]
      if (!waiting.length) return true
      revealAll(waiting)
      return false
    },
    [revealAll],
  )
  const jump = useCallback(
    (id: string) => {
      setActive(id)
      const root = wrapper.current
      const section = root && findSection(root, id)
      // A section already on the page moves now, inside this commit, so a more precise target set afterwards wins.
      if (root && section && prepare(id)) return land(root, section)
      setPending(id)
    },
    [prepare, land],
  )

  useLayoutEffect(() => {
    if (requested === handled.current) return
    const opening = handled.current === undefined
    handled.current = requested
    if (!requested || (opening && requested === first)) return
    if (wrapper.current && reading(wrapper.current, requested)) return
    jump(requested)
  }, [requested, first, jump])

  // A jump to a section not yet on the page lands once it and everything above it have rendered.
  useLayoutEffect(() => {
    if (!pending) return
    const root = wrapper.current
    if (root && !prepare(pending)) return
    const section = root && findSection(root, pending)
    if (root && section) land(root, section)
    setPending(null)
  }, [pending, revealed, prepare, land])

  return useMemo<SectionContentsController>(
    () => ({ wrapper, revealed, reveal, prepare, jump, active, setActive }),
    [revealed, reveal, prepare, jump, active],
  )
}

const ContentsContext = createContext<SectionContentsController | null>(null)
/** Whether the sections of this page sit in their own framed cards. */
const FramedContext = createContext(false)

/** The card a framed section sits in; pages that frame their own groups beside the sections reuse it. */
export const sectionFrame = "rounded-xl border bg-card p-4 @min-[600px]/contents:p-5"

function ContentsList({
  entries,
  active,
  roomy = false,
  onPick,
}: {
  entries: readonly ContentsEntry[]
  active: string | undefined
  roomy?: boolean
  onPick: (id: string) => void
}) {
  return (
    <ul className={cn("grid", roomy ? "gap-1" : "gap-0.5 border-l")}>
      {entries.map(({ id, label, icon: EntryIcon, count }) => {
        const current = id === active
        return (
          <li key={id} className="min-w-0">
            <button
              type="button"
              aria-controls={id}
              aria-current={current ? "location" : undefined}
              className={cn(
                "type-body flex w-full min-w-0 gap-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                // The narrow column lets a long name take a second line instead of cutting it.
                roomy
                  ? "min-h-11 items-center rounded-lg px-3"
                  : "-ml-px min-h-8 items-start border-l-2 py-1.5 pr-2 pl-3",
                current
                  ? roomy
                    ? "bg-primary/10 text-primary"
                    : "border-primary text-primary"
                  : cn("text-muted-foreground hover:text-foreground", roomy ? "hover:bg-muted" : "border-transparent"),
              )}
              onClick={() => onPick(id)}
            >
              {EntryIcon && <EntryIcon className={cn("size-4 shrink-0", !roomy && "mt-0.5")} />}
              <span className={cn("min-w-0 flex-1", roomy ? "truncate" : "line-clamp-2")}>{label}</span>
              {count !== null && count !== undefined && (
                <span className="type-meta shrink-0 tabular-nums">{count}</span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

const railVisible: Record<ContentsLayout, string> = {
  page: "@5xl/contents:block",
  panel: "@2xl/contents:block",
}
const buttonHidden: Record<ContentsLayout, string> = {
  page: "@5xl/contents:hidden",
  panel: "@2xl/contents:hidden",
}
const columns: Record<ContentsLayout, string> = {
  page: "@5xl/contents:grid-cols-[minmax(0,1fr)_12rem] @5xl/contents:gap-8",
  panel: "@2xl/contents:grid-cols-[minmax(0,1fr)_11rem] @2xl/contents:gap-6",
}

/**
 * One record's content as a single scrolling page. Wide boxes list the sections in a sticky column on the right; narrow
 * ones get a floating button that opens the same list in a bottom drawer. It is a single button, never a bottom bar.
 * Sticky bars above the sections are declared with `--contents-offset` in px on `className`.
 */
export function SectionContents({
  contents,
  entries,
  layout = "page",
  title = COPY.title,
  folded = false,
  framed = false,
  onNavigate,
  onActiveChange,
  className,
  children,
}: {
  contents: SectionContentsController
  entries: readonly ContentsEntry[]
  layout?: ContentsLayout
  title?: string
  /** Keeps the list behind the floating button at every width, e.g. while an editor needs the whole row. */
  folded?: boolean
  /** Sets each section in its own card, so a long page reads as distinct parts. */
  framed?: boolean
  /** The reader picked a section from the list. */
  onNavigate?: (id: string) => void
  /** The section being read changed while scrolling. */
  onActiveChange?: (id: string) => void
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const picked = useRef<string | null>(null)
  const { wrapper, active, setActive, jump } = contents
  const ids = entries.map((entry) => entry.id).join(" ")
  const activeLabel = entries.find((entry) => entry.id === active)?.label

  useEffect(() => {
    const element = wrapper.current
    const view = element?.ownerDocument.defaultView
    if (!element || !view) return
    const root = scrollRoot(element)
    let frame = 0
    const measure = () => {
      frame = 0
      const positions = ids.split(" ").flatMap((id) => {
        const section = findSection(element, id)
        return section ? [{ id, top: section.getBoundingClientRect().top }] : []
      })
      const box = root ?? element.ownerDocument.scrollingElement
      const atEnd =
        !!box && box.scrollHeight > box.clientHeight + 2 && box.scrollTop + box.clientHeight >= box.scrollHeight - 2
      const next = activeSection(positions, viewportTop(element) + stickyOffset(element) + READING_GAP, atEnd)
      if (next) setActive(next)
    }
    const schedule = () => {
      if (typeof view.requestAnimationFrame !== "function") return measure()
      frame ||= view.requestAnimationFrame(measure)
    }
    const target = root ?? view
    target.addEventListener("scroll", schedule, { passive: true })
    view.addEventListener("resize", schedule)
    return () => {
      if (frame) view.cancelAnimationFrame?.(frame)
      target.removeEventListener("scroll", schedule)
      view.removeEventListener("resize", schedule)
    }
  }, [wrapper, ids, setActive])

  const reported = useRef(active)
  useEffect(() => {
    if (!active || active === reported.current) return
    reported.current = active
    onActiveChange?.(active)
  }, [active, onActiveChange])

  const pick = (id: string) => {
    jump(id)
    onNavigate?.(id)
  }

  return (
    <ContentsContext.Provider value={contents}>
      <FramedContext.Provider value={framed}>
        <div ref={wrapper} className={cn("@container/contents relative min-w-0", className)}>
          <div className={cn("grid items-start gap-0", !folded && columns[layout])}>
            <div className={cn("min-w-0", framed ? "space-y-6" : "space-y-12")}>{children}</div>
            {!folded && (
              <nav
                aria-label={title}
                className={cn("sticky hidden self-start [overflow-anchor:none]", railVisible[layout])}
                style={{ top: "calc(var(--contents-offset, 0px) + 1rem)" }}
              >
                <p className="type-label mb-2 text-muted-foreground">{title}</p>
                <ContentsList entries={entries} active={active} onPick={pick} />
              </nav>
            )}
          </div>
          {/* The margin leaves room at the end of the page, so the button never covers the last line. */}
          <div
            className={cn(
              "pointer-events-none sticky bottom-4 z-30 mt-16 h-0 [overflow-anchor:none]",
              !folded && buttonHidden[layout],
            )}
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={activeLabel ? `${COPY.open} · Đang xem ${activeLabel}` : COPY.open}
              aria-haspopup="dialog"
              aria-expanded={open}
              title={COPY.open}
              className="pointer-events-auto absolute right-0 bottom-0 size-12 rounded-full bg-background shadow-lg"
              onClick={() => setOpen(true)}
            >
              <TableOfContents className="size-5" />
            </Button>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent
              side="bottom"
              className="max-h-[80dvh] gap-0 overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
              // The drawer holds the page still while open, so the jump waits until it has gone.
              onCloseAutoFocus={(event) => {
                const id = picked.current
                if (!id) return
                picked.current = null
                event.preventDefault()
                pick(id)
              }}
            >
              <SheetHeader className="pr-12">
                <SheetTitle className="type-section-title">{title}</SheetTitle>
                <SheetDescription className="sr-only">Chọn một phần để cuộn tới.</SheetDescription>
              </SheetHeader>
              <nav aria-label={title} className="px-2 pb-4">
                <ContentsList
                  entries={entries}
                  active={active}
                  roomy
                  onPick={(id) => {
                    picked.current = id
                    setOpen(false)
                  }}
                />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </FramedContext.Provider>
    </ContentsContext.Provider>
  )
}

/**
 * The heading row of a section: an icon tile, the title and its count on the left, the section's own actions on the
 * right. Panels that bring their own heading use it too, so every part of a page starts the same way.
 */
export function SectionHeading({
  id,
  title,
  icon: SectionIcon,
  count,
  status,
  description,
  actions,
}: {
  id?: string
  title: ReactNode
  icon?: Icon
  count?: number | null
  /** A short state shown next to the title, such as the part being edited. */
  status?: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
      <h2 id={id} className="type-section-title flex min-w-0 items-center gap-2.5">
        {SectionIcon && (
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <SectionIcon className="size-4" />
          </span>
        )}
        <span className="min-w-0 break-words">{title}</span>
        {count !== null && count !== undefined && (
          <span className="type-meta rounded-full bg-muted px-2 tabular-nums">{count}</span>
        )}
      </h2>
      {status}
      {actions && <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>}
      {description && <p className="type-meta basis-full">{description}</p>}
    </div>
  )
}

/**
 * A titled part of a `SectionContents` page. A `lazy` one renders a placeholder until it comes near the screen or is
 * asked for, then stays mounted, so a part that used to load with its own tab still loads on demand.
 */
export function ContentsSection({
  id,
  title,
  label,
  icon: SectionIcon,
  count,
  status,
  actions,
  lazy = false,
  placeholderHeight = 320,
  className,
  children,
}: {
  id: string
  /** A visible heading; leave it out when the content brings its own. */
  title?: ReactNode
  /** The section's accessible name when it has no `title`. */
  label?: string
  icon?: Icon
  count?: number | null
  status?: ReactNode
  actions?: ReactNode
  lazy?: boolean
  placeholderHeight?: number
  className?: string
  children: ReactNode
}) {
  const contents = useContext(ContentsContext)
  const framed = useContext(FramedContext)
  const headingId = useId()
  const ref = useRef<HTMLElement>(null)
  const shown = !lazy || !contents || contents.revealed.has(id)
  const reveal = contents?.reveal

  useEffect(() => {
    const element = ref.current
    if (shown || !element || !reveal || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) reveal(id)
      },
      { root: scrollRoot(element), rootMargin: REVEAL_MARGIN },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [shown, id, reveal])

  return (
    <section
      ref={ref}
      id={id}
      tabIndex={-1}
      aria-labelledby={title ? headingId : undefined}
      aria-label={title ? undefined : label}
      data-contents-pending={shown ? undefined : ""}
      aria-busy={shown ? undefined : true}
      // A placeholder is swapped out when it loads, so it must never be the scroll anchor: the page would jump.
      className={cn("min-w-0 outline-none", framed && sectionFrame, !shown && "[overflow-anchor:none]", className)}
    >
      {title && (
        <SectionHeading
          id={headingId}
          title={title}
          icon={SectionIcon}
          count={count}
          status={status}
          actions={actions}
        />
      )}
      {shown ? (
        children
      ) : (
        // Holds the section's place until it loads; not announced, since it fills in as the reader arrives.
        <div
          className="type-meta flex items-center justify-center rounded-lg border border-dashed"
          style={{ minHeight: placeholderHeight }}
        >
          Đang tải phần này…
        </div>
      )}
    </section>
  )
}
