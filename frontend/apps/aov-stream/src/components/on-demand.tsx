import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useReducer,
  useState,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from "react"
import { asksForNewPage, noteRelease } from "../lib/gone-file"
import { partSheets } from "../lib/part-sheets"
import { watch } from "./watch-session"

const STORED = "stream-releases"
/** The longest a browser may put off what it does when idle, and the time one that cannot say so is given to draw. */
const LATEST = 5000
const DRAWN = 2000

/** A part of a page whose file comes when it is needed. */
export type OnDemand<P> = {
  /** The part, once its file is here. */
  here(): ComponentType<P> | null
  /** Its file: asked for once, and anew after it could not be had. */
  file(): Promise<{ default: ComponentType<P> }>
  /** Asks for the file ahead of its need. */
  ask(): void
}

/** The stand-ins a reader looks at, with whether the part was asked for again. */
const waiters = new Set<{ again: boolean }>()
/** Whether the page is about to give way to a new one. */
let leaving = false

/** Notes that the page is loaded anew, and says whether it is the first time for this release of the app. */
function firstTime() {
  try {
    const kept = noteRelease(sessionStorage.getItem(STORED), import.meta.url)
    if (kept) sessionStorage.setItem(STORED, kept)
    return kept != null
  } catch {
    // A browser that keeps nothing cannot tell.
    return false
  }
}

/** Loads the page anew for a file that could not be had, where that may bring it. */
function onLost() {
  const again = [...waiters].some((waiter) => waiter.again)
  const watched = watch.view().player !== "CLOSED"
  if (!asksForNewPage({ waited: waiters.size > 0, again, watched, online: navigator.onLine })) return
  const first = firstTime()
  if (!first && !again) return
  leaving = true
  location.reload()
}

// Vite tells of a file that could not be had, and of a sheet that came with one.
window.addEventListener("vite:preloadError", onLost)

const withSheets = partSheets(
  () => [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')],
  onLost,
)

/** Makes a part of a page that comes with a file of its own. */
export function onDemand<P>(load: () => Promise<ComponentType<P>>): OnDemand<P> {
  let here: ComponentType<P> | null = null
  let asked: Promise<{ default: ComponentType<P> }> | null = null
  const file = () =>
    (asked ??= withSheets(load).then(
      (part) => {
        here = part
        return { default: part }
      },
      (error: unknown) => {
        asked = null
        // Nobody is told in the last moment of a page that something went wrong.
        if (leaving) return new Promise<never>(() => {})
        throw error
      },
    ))
  return { here: () => here, file, ask: () => void file().catch(() => {}) }
}

/** Asks for a part as soon as the pointer or the focus comes to what opens it. */
export const asksAhead = ({ ask }: { ask(): void }) => ({ onPointerEnter: ask, onFocus: ask })

/** Asks for a part that may be opened next, once its page is drawn and the browser has nothing else to do. */
export function useAhead({ ask }: { ask(): void }, drawn: boolean) {
  useEffect(() => {
    const { connection } = navigator as { connection?: { saveData?: boolean } }
    if (!drawn || connection?.saveData) return
    if ("requestIdleCallback" in window) {
      const idle = requestIdleCallback(ask, { timeout: LATEST })
      return () => cancelIdleCallback(idle)
    }
    const timer = setTimeout(ask, DRAWN)
    return () => clearTimeout(timer)
  }, [ask, drawn])
}

/** What stands in for a part while a reader waits for it. */
function StandIn({ again, children }: { again: boolean; children: ReactNode }) {
  useLayoutEffect(() => {
    const own = { again }
    waiters.add(own)
    return () => {
      waiters.delete(own)
    }
  }, [again])
  return children
}

type PartPlace<P> = {
  part: OnDemand<P>
  /** What stands in for it while its file is on its way. */
  waiting: ReactNode
  children: (Part: ComponentType<P> | LazyExoticComponent<ComponentType<P>>) => ReactNode
}

/** One attempt at drawing a part. */
function Attempt<P>({ part, waiting, again, children }: PartPlace<P> & { again: boolean }) {
  // A part that is here is drawn at once; React.lazy would wait a turn even for a file that has come long ago.
  const [Part] = useState(() => part.here() ?? lazy(part.file))
  const [, redraw] = useReducer((times: number) => times + 1, 0)
  // React holds back what takes the place of a stand-in, but not what is drawn anew for another reason.
  useEffect(() => {
    if (!part.here()) part.file().then(redraw, () => {})
  }, [part])
  return <Suspense fallback={<StandIn again={again}>{waiting}</StandIn>}>{children(Part)}</Suspense>
}

type Failed = (again: () => void) => ReactNode

/** Keeps what goes wrong with a part to its place in the page. */
class Held extends Component<
  { failed: Failed; children: (again: boolean) => ReactNode },
  { failed: boolean; again: boolean }
> {
  state = { failed: false, again: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  again = () => {
    // The button that was pressed goes, and the focus would go with it.
    document.getElementById("main")?.focus({ preventScroll: true })
    this.setState({ failed: false, again: true })
  }
  render() {
    const { failed, again } = this.state
    return failed ? this.props.failed(this.again) : this.props.children(again)
  }
}

/**
 * The place of a part in its page: the part, what stands in for it while its file is on its way, or where that could not
 * be had what `failed` says, with the way to ask for it again.
 */
export function OnDemandPart<P>({ failed, ...place }: PartPlace<P> & { failed: Failed }): ReactNode {
  return <Held failed={failed}>{(again) => <Attempt {...place} again={again} />}</Held>
}
