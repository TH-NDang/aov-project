import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { useLocation, useNavigationType, type Location } from "react-router"
import { entryKey, landsAtTop, opensPart, placeMemory, searchesAnew, wayOf, type Step, type Way } from "../lib/travel"
import { EntryContext, keepChoices, type Entry } from "../lib/use-entry-state"
import "./travel.css"

const STORED = "stream-places"
/** How long a page that is still loading may take to grow back to where the reader was. */
const PATIENCE = 2500
/** How long a page back in its place is still held, while bars pinned over it settle into their size. */
const SETTLE = 300
/** What a page or a tile is recognised by: the picture that travels with the reader. */
const MARKS = ".pm, .tn-logo, .tn-shield, .jersey, .stream-image, .pl-mark"
/** The boxes a link may stand in, so the one the reader comes back to can be shown. */
const BOXES = "li, .ps-author, .tn-card, .pg-card, .lv-card, .tn-match"
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

const historyIndex = () => (window.history.state as { idx?: number } | null)?.idx ?? 0

/** The places of this tab; a browser that keeps nothing starts each visit without them. */
function storedPlaces() {
  try {
    return sessionStorage.getItem(STORED)
  } catch {
    return null
  }
}

const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * Holds the page at `top` while it grows back to that height, until it has stood there for a moment or the reader
 * moves. `find` looks for what the reader comes back to after each step, as rows drawn late are not there at first; the
 * hold also waits for it.
 */
function holdPlace(top: number, find?: () => boolean) {
  const started = performance.now()
  let found = !find
  let settling = 0
  const watch = new ResizeObserver(() => stand())
  const inputs = ["wheel", "touchstart", "keydown", "pointerdown"] as const
  const stop = () => {
    window.clearTimeout(settling)
    watch.disconnect()
    for (const input of inputs) window.removeEventListener(input, stop)
  }
  const stand = () => {
    window.scrollTo(0, top)
    found ||= !find || find()
    // A page that passed its top on the way, while it was short, has bars that shrink back as it gets there; their
    // change of size would otherwise leave it a few pixels off.
    if (found && Math.abs(window.scrollY - top) < 2) settling ||= window.setTimeout(stop, SETTLE)
    else if (performance.now() - started > PATIENCE) stop()
  }
  for (const input of inputs) window.addEventListener(input, stop, { passive: true })
  watch.observe(document.body)
  stand()
  return stop
}

const seen = (element: Element) => {
  const { top, bottom, width } = element.getBoundingClientRect()
  return width > 0 && bottom > 0 && top < window.innerHeight
}

/** The link on screen that opens `pathname`, at `search` where that is told. */
const linkTo = (pathname: string, search?: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>("main a[href]")].find(
    (link) => link.pathname === BASE + pathname && (search === undefined || link.search === search) && seen(link),
  )

/** The picture of what a link opens: inside it, or close around it. */
function markOf(link: Element | null | undefined): HTMLElement | null {
  let box: Element | null | undefined = link
  for (let up = 0; box && up < 4; up++, box = box.parentElement) {
    const mark = box.querySelector<HTMLElement>(MARKS)
    if (mark) return seen(mark) ? mark : null
    if (box.matches(BOXES)) return null
  }
  return null
}

/** The picture in the head of the page. */
const headMark = () => {
  const mark = document.querySelector<HTMLElement>("[data-place-mark]")
  return mark && seen(mark) ? mark : null
}

/** Where the parts of a page begin: under its head, or at the top of a page without one. */
function partsTop() {
  const head = document.querySelector<HTMLElement>("[data-place-head]")
  if (!head?.offsetHeight) return 0
  const bars = Number.parseFloat(getComputedStyle(head).getPropertyValue("--hub-stuck")) || 0
  return Math.max(0, window.scrollY + head.getBoundingClientRect().bottom - bars)
}

/** Marks the row the reader comes back to for a moment, so the eye finds it again. Gives back what ends it early. */
function markReturned(box: HTMLElement) {
  const lit = { outlineColor: "var(--hub-accent)", backgroundColor: "var(--hub-accent-soft)" }
  box.dataset.returned = ""
  const marked = box.animate(
    [
      { ...lit, offset: 0 },
      { ...lit, offset: 0.4 },
    ],
    { duration: 1800, easing: "ease-out" },
  )
  const end = () => delete box.dataset.returned
  marked.onfinish = end
  return () => {
    marked.cancel()
    end()
  }
}

type Arrival = {
  location: Location
  from: string
  /** What the address of the page left said when it was opened. */
  fromSearch: string
  way: Way
  top: boolean
  part: boolean
  place: number | undefined
  /** Where the reader stood on the page left, before the new one could change it. */
  stood: number
  /** The reader went back or forward to it; `back` if it was back. */
  returning: boolean
  back: boolean
}

/**
 * Takes the reader from page to page. A page that is opened starts at its top and takes the focus; one that is gone
 * back to is as it was left, with the row that was opened marked for a moment. The picture of what is opened grows into
 * the head of its page and returns to its row. `children` draw the page of the address they are given.
 */
export function Travel({ children }: { children: (location: Location) => ReactNode }) {
  const location = useLocation()
  const action = useNavigationType()
  const [arrival, setArrival] = useState<Arrival>({
    location,
    from: location.pathname,
    fromSearch: location.search,
    way: "stay",
    top: false,
    part: false,
    place: undefined,
    stood: 0,
    returning: false,
    back: false,
  })
  const memory = useRef(placeMemory(storedPlaces()))
  const index = useRef(historyIndex())
  const pressed = useRef<HTMLAnchorElement | null>(null)
  const here = useRef(location)
  const redirected = useRef(new Map<string, string>())
  // A link leads to an entry as it was opened; a step that only replaces it later, such as another order, changes that not.
  const openedWith = useRef(new Map<number, string>([[historyIndex(), location.search]]))
  const released = useRef<(() => void) | null>(null)

  /** The link that led to a page, also when its address has since given way to another. */
  const rowOf = (pathname: string) => linkTo(pathname) ?? linkTo(redirected.current.get(pathname) ?? "")

  // Where the reader stands is written down as they read, and kept for a reload.
  useEffect(() => {
    const before = window.history.scrollRestoration
    window.history.scrollRestoration = "manual"
    const places = memory.current
    const first = places.recall(entryKey(here.current))
    if (first) released.current = holdPlace(first)
    let frame = 0
    const write = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => places.remember(entryKey(here.current), window.scrollY))
    }
    const press = (event: MouseEvent) => {
      pressed.current = event.target instanceof Element ? event.target.closest("a") : null
    }
    const keep = () => {
      places.remember(entryKey(here.current), window.scrollY)
      try {
        sessionStorage.setItem(STORED, places.save())
      } catch {
        // The next visit then starts at the top, as one without storage does.
      }
      keepChoices()
    }
    window.addEventListener("scroll", write, { passive: true })
    window.addEventListener("pagehide", keep)
    document.addEventListener("click", press, true)
    return () => {
      window.history.scrollRestoration = before
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", write)
      window.removeEventListener("pagehide", keep)
      document.removeEventListener("click", press, true)
    }
  }, [])

  useLayoutEffect(() => {
    const from = here.current
    if (location === from) return
    const at = historyIndex()
    const left = index.current
    const step: Step = { action, delta: at - left, from: from.pathname, to: location.pathname }
    index.current = at
    if (action === "PUSH") openedWith.current.set(at, location.search)
    const places = memory.current
    places.remember(entryKey(from), window.scrollY)
    released.current?.()
    if (action === "REPLACE" && step.from !== step.to) redirected.current.set(step.to, step.from)
    const way = wayOf(step)
    const next: Arrival = {
      location,
      from: from.pathname,
      fromSearch: openedWith.current.get(left) ?? from.search,
      way,
      top: landsAtTop(step) || searchesAnew(step, from.search, location.search),
      part: opensPart(step, from.search, location.search),
      place: action === "POP" && !location.hash ? places.recall(entryKey(location)) : undefined,
      stood: window.scrollY,
      returning: action === "POP",
      back: action === "POP" && step.delta < 0,
    }
    const root = document.documentElement
    const arrive = () => {
      here.current = location
      root.toggleAttribute("data-returning", action === "POP")
      setArrival(next)
    }
    if (way === "stay" || calm() || !document.startViewTransition || document.visibilityState === "hidden") {
      arrive()
      return
    }
    const opened = pressed.current?.pathname === BASE + location.pathname ? pressed.current : null
    const source = way === "in" ? markOf(opened) : headMark()
    root.dataset.way = way
    if (source) source.style.viewTransitionName = "place"
    let target: HTMLElement | null = null
    const moved = document.startViewTransition(() => {
      flushSync(arrive)
      if (source) source.style.viewTransitionName = ""
      target = source && (way === "in" ? headMark() : markOf(rowOf(from.pathname)))
      if (target) target.style.viewTransitionName = "place"
    })
    const end = () => {
      if (target) target.style.viewTransitionName = ""
      delete root.dataset.way
    }
    void moved.finished.then(end, end)
  }, [location, action])

  // Runs once the page stands in the document, so it is in its place before it is seen.
  useLayoutEffect(() => {
    const { from, fromSearch, way, top, part, place, stood, back } = arrival
    pressed.current = null
    // Within a page the focus goes back to what opened the part the reader comes from; out of one, to the row that
    // opened it, which is marked for a moment. Several steps back may leave no link to the very address left.
    const within = from === arrival.location.pathname
    const returns = within ? back : way === "out"
    let unmark: (() => void) | undefined
    const find = () => {
      const link = linkTo(from, fromSearch) ?? (within ? undefined : rowOf(from))
      if (!link) return false
      if (!top) link.focus({ preventScroll: true })
      if (!within) unmark = markReturned(link.closest<HTMLElement>(BOXES) ?? link)
      return true
    }
    if (top) {
      window.scrollTo(0, 0)
      document.getElementById("main")?.focus({ preventScroll: true })
    } else if (part) {
      // The part may stand in a page that is shorter for a moment than where the reader was, while it is on its way.
      const start = partsTop()
      if (stood > start) released.current = holdPlace(start)
    }
    if (place != null) released.current = holdPlace(place, returns ? find : undefined)
    else if (returns) find()
    return () => unmark?.()
  }, [arrival])

  const key = entryKey(arrival.location)
  const entry = useMemo((): Entry => ({ key, returning: arrival.returning }), [key, arrival.returning])
  return <EntryContext value={entry}>{children(arrival.location)}</EntryContext>
}
