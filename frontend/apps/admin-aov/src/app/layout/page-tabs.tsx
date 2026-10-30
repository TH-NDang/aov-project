import * as React from "react"
import {
  createContext,
  useEffect,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ContextType,
  type ReactNode,
} from "react"
import {
  UNSAFE_DataRouterStateContext,
  UNSAFE_LocationContext,
  UNSAFE_RouteContext,
  useLocation,
  useMatches,
  useNavigate,
  useOutlet,
  type UIMatch,
} from "react-router"
import type { RouteHandle } from "./site-header"
import { useHotkeys } from "../hotkeys"
import { createPageTabPreviewStore } from "./page-tab-preview-store"
import { PageTabPreviewContext, usePageTabCapture } from "./page-tab-preview"

interface PageSession {
  path: string
  to: string
  label: ReactNode
  outlet: ReactNode
  location: ContextType<typeof UNSAFE_LocationContext>
  routerState: ContextType<typeof UNSAFE_DataRouterStateContext>
}

interface PageTabsContextValue {
  sessions: PageSession[]
  activePath: string
  transientOutlet: ReactNode
  closeTab: (path: string) => void
  moveTab: (path: string, targetPath: string) => void
  registerCloseGuard: (path: string, guard: () => boolean) => () => void
}

const PageTabsContext = createContext<PageTabsContextValue | null>(null)

function remember(sessions: PageSession[], active: PageSession) {
  const previous = sessions.find((session) => session.path === active.path)
  if (!previous) return [...sessions, active]
  if (
    previous.to === active.to &&
    previous.label === active.label &&
    previous.outlet === active.outlet &&
    previous.location === active.location &&
    previous.routerState === active.routerState
  )
    return sessions
  return sessions.map((session) => (session.path === active.path ? active : session))
}

export function PageTabsProvider({ children }: { children: ReactNode }) {
  const { enabled } = useHotkeys()
  const location = useLocation()
  const locationContext = useContext(UNSAFE_LocationContext)
  const routerState = useContext(UNSAFE_DataRouterStateContext)
  const rawOutlet = useOutlet()
  const matchedOutlet = useContext(UNSAFE_RouteContext).outlet
  // useOutlet creates a wrapper on every render; cache by the underlying route element.
  const outlet = useMemo(() => rawOutlet, [matchedOutlet])
  const matches = useMatches() as UIMatch<unknown, RouteHandle | undefined>[]
  const transient = matches.some((match) => match.handle?.pageTab === false)
  const navigate = useNavigate()
  const active = useMemo<PageSession>(() => {
    const match = [...matches].reverse().find((entry) => entry.handle?.crumb)
    return {
      path: location.pathname,
      to: location.pathname + location.search + location.hash,
      label: match?.handle?.crumb?.(match) ?? "AOV Admin",
      outlet,
      location: locationContext,
      routerState,
    }
  }, [location, locationContext, routerState, outlet, matches])
  const [saved, setSaved] = useState<PageSession[]>(() => (transient ? [] : [active]))
  const [previews] = useState(createPageTabPreviewStore)
  const closeGuards = useRef(new Map<string, Set<() => boolean>>())
  const registerCloseGuard = React.useCallback((path: string, guard: () => boolean) => {
    const guards = closeGuards.current.get(path) ?? new Set<() => boolean>()
    guards.add(guard)
    closeGuards.current.set(path, guards)
    return () => {
      guards.delete(guard)
      if (!guards.size) closeGuards.current.delete(path)
    }
  }, [])
  const [closingPath, setClosingPath] = useState<string | null>(null)
  const sessions = transient
    ? saved.filter((session) => session.path !== active.path)
    : closingPath === active.path
      ? saved
      : remember(saved, active)

  useLayoutEffect(() => {
    if (closingPath === active.path) return
    setSaved((current) =>
      transient ? current.filter((session) => session.path !== active.path) : remember(current, active),
    )
    if (closingPath !== null) setClosingPath(null)
  }, [active, closingPath, transient])

  useEffect(() => previews.retain(sessions.map((session) => session.path)), [previews, sessions])

  const closeTab = (path: string) => {
    if ([...(closeGuards.current.get(path) ?? [])].some((guard) => !guard())) return
    closeGuards.current.delete(path)
    const index = sessions.findIndex((session) => session.path === path)
    const remaining = sessions.filter((session) => session.path !== path)
    setSaved(remaining)
    if (path === active.path) {
      setClosingPath(path)
      void navigate(remaining[Math.max(0, index - 1)]?.to ?? "/", { replace: true })
    }
  }

  const moveTab = (path: string, targetPath: string) => {
    if (path === targetPath) return
    setSaved((current) => {
      const next = transient ? current : remember(current, active)
      const from = next.findIndex((session) => session.path === path)
      const to = next.findIndex((session) => session.path === targetPath)
      if (from < 0 || to < 0) return next
      const reordered = [...next]
      const [session] = reordered.splice(from, 1)
      reordered.splice(to, 0, session!)
      return reordered
    })
  }

  useEffect(() => {
    if (!enabled || transient) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.shiftKey) return
      const primary = (event.ctrlKey || event.metaKey) && !event.altKey
      const alternative = event.altKey && !event.ctrlKey && !event.metaKey
      if (!primary && !alternative) return
      if (document.body.style.pointerEvents === "none") return
      if (
        alternative &&
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))
      )
        return
      const digit = /^[1-9]$/.test(event.key)
        ? Number(event.key)
        : /^Digit[1-9]$/.test(event.code)
          ? Number(event.code.at(-1))
          : 0
      if (digit) {
        event.preventDefault()
        const destination = digit === 9 ? sessions.at(-1) : sessions[digit - 1]
        if (destination && destination.path !== active.path) void navigate(destination.to)
      } else if (event.key.toLowerCase() === "w") {
        event.preventDefault()
        if (sessions.length > 1 || active.path !== "/") closeTab(active.path)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled, sessions, active.path, navigate, closeTab, transient])

  return (
    <PageTabsContext.Provider
      value={{
        sessions,
        activePath: active.path,
        transientOutlet: transient ? outlet : null,
        closeTab,
        moveTab,
        registerCloseGuard,
      }}
    >
      <PageTabPreviewContext.Provider value={previews}>{children}</PageTabPreviewContext.Provider>
    </PageTabsContext.Provider>
  )
}

export function usePageTabs() {
  const context = useContext(PageTabsContext)
  if (!context) throw new Error("Page tabs must be used within PageTabsProvider.")
  return context
}

export function usePageCloseGuard(guard: () => boolean, enabled = true) {
  const context = useContext(PageTabsContext)
  const { pathname } = useLocation()
  const latest = useRef(guard)
  useLayoutEffect(() => {
    latest.current = guard
  })
  const handler = useRef(() => latest.current())
  const register = context?.registerCloseGuard
  // Activity hides effects for inactive tabs; retain the guard until the tab is actually closed.
  useEffect(() => {
    if (enabled) register?.(pathname, handler.current)
  }, [register, pathname, enabled])
}

function SessionPanel({ session, active }: { session: PageSession; active: boolean }) {
  const panel = useRef<HTMLDivElement>(null)
  usePageTabCapture(panel, active, session.path, session.to)
  const scroll = useRef(new Map<HTMLElement, { top: number; left: number }>())
  useLayoutEffect(() => {
    if (!active || !panel.current) return
    for (const [element, position] of scroll.current) {
      if (element.isConnected) {
        element.scrollTop = position.top
        element.scrollLeft = position.left
      }
    }
  }, [active])
  return (
    <div
      ref={panel}
      hidden={!active}
      data-page-tab={session.path}
      data-active={active}
      className={`${active ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col overflow-auto`}
      onScrollCapture={(event) => {
        if (active && event.target instanceof HTMLElement) {
          scroll.current.set(event.target, { top: event.target.scrollTop, left: event.target.scrollLeft })
        }
      }}
    >
      <React.Activity mode={active ? "visible" : "hidden"}>
        {/* Inactive routes must retain their own URL, params and data-router state. */}
        <UNSAFE_LocationContext.Provider value={session.location}>
          <UNSAFE_DataRouterStateContext.Provider value={session.routerState}>
            {session.outlet}
          </UNSAFE_DataRouterStateContext.Provider>
        </UNSAFE_LocationContext.Provider>
      </React.Activity>
    </div>
  )
}

/** Keep each route mounted until its tab closes; DOM scroll regions stay with that route. */
export function PageTabPanels() {
  const { sessions, activePath, transientOutlet } = usePageTabs()
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Redirect-only outlets must still mount to execute their navigation effect. */}
      {transientOutlet}
      {sessions.map((session) => (
        <SessionPanel key={session.path} session={session} active={session.path === activePath} />
      ))}
    </div>
  )
}
