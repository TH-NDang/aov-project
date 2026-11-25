import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { useLocation, useNavigationType, type Location } from "react-router"
import { entryKey, landsAtTop, opensPart, placeMemory, searchesAnew, wayOf, type Step, type Way } from "../lib/travel"
import "./travel.css"

const STORED = "stream-places"
/** How long a page that is still loading may take to grow back to where the reader was. */
const PATIENCE = 2500
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

/** Holds the page at `top` while it grows back to that height, until it is there or the reader moves. */
function holdPlace(top: number) {
  const started = performance.now()
  const watch = new ResizeObserver(() => stand())
  const inputs = ["wheel", "touchstart", "keydown", "pointerdown"] as const
  const stop = () => {
    watch.disconnect()
    for (const input of inputs) window.removeEventListener(input, stop)
  }
  const stand = () => {
    window.scrollTo(0, top)
    if (Math.abs(window.scrollY - top) < 2 || performance.now() - started > PATIENCE) stop()
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

/** The link on screen that opens `pathname`. */
const linkTo = (pathname: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>("main a[href]")].find(
    (link) => link.pathname === BASE + pathname && seen(link),
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
  way: Way
  top: boolean
  part: boolean
  place: number | undefined
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
    way: "stay",
    top: false,
    part: false,
    place: undefined,
  })
  const memory = useRef(placeMemory(storedPlaces()))
  const index = useRef(historyIndex())
  const pressed = useRef<HTMLAnchorElement | null>(null)
  const here = useRef(location)
  const redirected = useRef(new Map<string, string>())
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
    const step: Step = { action, delta: at - index.current, from: from.pathname, to: location.pathname }
    index.current = at
    const places = memory.current
    places.remember(entryKey(from), window.scrollY)
    released.current?.()
    if (action === "REPLACE" && step.from !== step.to) redirected.current.set(step.to, step.from)
    const way = wayOf(step)
    const next: Arrival = {
      location,
      from: from.pathname,
      way,
      top: landsAtTop(step) || searchesAnew(step, from.search, location.search),
      part: opensPart(step, from.search, location.search),
      place: action === "POP" && !location.hash ? places.recall(entryKey(location)) : undefined,
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
    const { from, way, top, part, place } = arrival
    pressed.current = null
    if (top) {
      window.scrollTo(0, 0)
      document.getElementById("main")?.focus({ preventScroll: true })
    } else if (part) {
      const start = partsTop()
      if (window.scrollY > start) window.scrollTo(0, start)
    } else if (place != null) released.current = holdPlace(place)
    if (way !== "out" || from === arrival.location.pathname) return
    const link = rowOf(from)
    if (!link) return
    if (!top) link.focus({ preventScroll: true })
    return markReturned(link.closest<HTMLElement>(BOXES) ?? link)
  }, [arrival])

  return children(arrival.location)
}
