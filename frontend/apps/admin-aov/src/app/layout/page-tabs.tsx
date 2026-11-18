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
  useLocation,
  useMatches,
  useNavigate,
  useOutlet,
  type UIMatch,
} from "react-router"
import type { RouteHandle } from "./site-header"
import { useHotkeys } from "../hotkeys"
import { catalogTabTarget, useSavedCatalogScope } from "@/features/publishing/components/catalog/catalog-scope-memory"
import { createPageTabPreviewStore } from "./page-tab-preview-store"
import { PageTabPreviewContext, usePageTabCapture } from "./page-tab-preview"

/** May ask the user, so closing waits for its answer. */
type PageCloseGuard = () => boolean | Promise<boolean>

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
  /** Waits for the page's close guards, so it settles once the tab is closed or kept. */
  closeTab: (path: string) => Promise<void>
  moveTab: (path: string, targetPath: string) => void
  registerCloseGuard: (path: string, guard: PageCloseGuard) => () => void
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

/**
 * Navigation state for a redirect that takes the place of the page it came from, such as a hero that opens on one of
 * its forms: the new page takes over that page's tab instead of leaving it open beside it.
 */
export function replacingPageTab(path: string) {
  return { replacesPageTab: path }
}

function replacedPageTab(state: unknown) {
  const path = (state as { replacesPageTab?: unknown } | null)?.replacesPageTab
  return typeof path === "string" ? path : null
}

function rememberInPlace(sessions: PageSession[], active: PageSession, replaced: string | null) {
  if (!replaced || replaced === active.path || !sessions.some((session) => session.path === replaced))
    return remember(sessions, active)
  const others = sessions.filter((session) => session.path !== active.path)
  return others.map((session) => (session.path === replaced ? active : session))
}

export function PageTabsProvider({ children }: { children: ReactNode }) {
  const { enabled } = useHotkeys()
  const location = useLocation()
  const locationContext = useContext(UNSAFE_LocationContext)
  const routerState = useContext(UNSAFE_DataRouterStateContext)
  // useOutlet keeps its wrapper while the underlying route element stays the same, so a session can compare it.
  const outlet = useOutlet()
  const matches = useMatches() as UIMatch<unknown, RouteHandle | undefined>[]
  const transient = matches.some((match) => match.handle?.pageTab === false)
  const navigate = useNavigate()
  const savedScope = useSavedCatalogScope()
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
  const closeGuards = useRef(new Map<string, Set<PageCloseGuard>>())
  const registerCloseGuard = React.useCallback((path: string, guard: PageCloseGuard) => {
    const guards = closeGuards.current.get(path) ?? new Set<PageCloseGuard>()
    guards.add(guard)
    closeGuards.current.set(path, guards)
    return () => {
      guards.delete(guard)
      if (!guards.size) closeGuards.current.delete(path)
    }
  }, [])
  const [closingPath, setClosingPath] = useState<string | null>(null)
  const replaced = replacedPageTab(location.state)
  const sessions = transient
    ? saved.filter((session) => session.path !== active.path)
    : closingPath === active.path
      ? saved
      : rememberInPlace(saved, active, replaced)

  useLayoutEffect(() => {
    if (closingPath === active.path) return
    if (replaced && replaced !== active.path) closeGuards.current.delete(replaced)
    setSaved((current) =>
      transient
        ? current.filter((session) => session.path !== active.path)
        : rememberInPlace(current, active, replaced),
    )
    if (closingPath !== null) setClosingPath(null)
  }, [active, closingPath, transient, replaced])

  useEffect(() => previews.retain(sessions.map((session) => session.path)), [previews, sessions])

  const removeTab = (path: string) => {
    closeGuards.current.delete(path)
    const index = sessions.findIndex((session) => session.path === path)
    const remaining = sessions.filter((session) => session.path !== path)
    setSaved(remaining)
    if (path === active.path) {
      setClosingPath(path)
      void navigate(catalogTabTarget(remaining[Math.max(0, index - 1)]?.to ?? "/", savedScope), { replace: true })
    }
  }

  // Tabs and the active page can change while a guard waits for its answer.
  const latestRemoveTab = useRef(removeTab)
  useLayoutEffect(() => {
    latestRemoveTab.current = removeTab
  })

  const closeTab = React.useCallback(async (path: string) => {
    // One at a time, so a guard never asks after an earlier one was refused.
    for (const guard of [...(closeGuards.current.get(path) ?? [])]) {
      if (!(await guard())) return
    }

    latestRemoveTab.current(path)
  }, [])

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
        if (destination && destination.path !== active.path) void navigate(catalogTabTarget(destination.to, savedScope))
      } else if (event.key.toLowerCase() === "w") {
        event.preventDefault()
        if (sessions.length > 1 || active.path !== "/") void closeTab(active.path)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled, sessions, active.path, navigate, closeTab, transient, savedScope])

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

export function usePageCloseGuard(guard: PageCloseGuard, enabled = true) {
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
