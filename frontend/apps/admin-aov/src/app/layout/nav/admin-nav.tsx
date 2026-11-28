import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { useLocation } from "react-router"
import { usePageLayout, type PageLayout } from "@aov/ui/hooks/use-page-layout"
import { NAV_AREAS, activeNavArea, activeNavItem, type NavArea, type NavAreaKey } from "@/app/nav"
import { useSession } from "@/app/auth/auth-gate"
import { useHotkeys } from "@/app/hotkeys"
import { areasFor, rememberRecent } from "./nav-model"

const PANEL_COOKIE = "sidebar_state"
const PANEL_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
/** Below this width the pages of an area float beside the rail instead of taking a column from the page. */
const DOCK_QUERY = "(min-width: 1200px)"

const dockQuery = () => (typeof window.matchMedia === "function" ? window.matchMedia(DOCK_QUERY) : undefined)

function subscribeDock(notify: () => void) {
  const list = dockQuery()
  list?.addEventListener("change", notify)
  return () => list?.removeEventListener("change", notify)
}

function useRoomToDock() {
  return useSyncExternalStore(
    subscribeDock,
    () => dockQuery()?.matches ?? true,
    () => true,
  )
}

interface AdminNav {
  layout: PageLayout
  areas: NavArea[]
  /** The area that lists the page being read. */
  current?: NavArea
  /** Whether the screen is wide enough for the list of pages to stand beside the rail. */
  canDock: boolean
  /** Wide screens: whether the list of pages stands beside the rail. */
  panelOpen: boolean
  togglePanel: () => void
  /** The area whose pages the docked panel, the floating panel or the phone sheet shows. */
  shown: NavAreaKey
  pick: (area: NavAreaKey) => void
  /** The area shown on its own, floating beside the rail (wide, panel closed) or as a sheet (compact). */
  floating: NavAreaKey | null
  setFloating: (area: NavAreaKey | null) => void
  recent: string[]
}

const AdminNavContext = createContext<AdminNav | null>(null)

function readPanelCookie() {
  const match = document.cookie.match(/(?:^|;\s*)sidebar_state=(true|false)/)
  return match ? match[1] === "true" : true
}

function readRecent(key: string): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "[]")
    return Array.isArray(stored) ? stored.filter((entry): entry is string => typeof entry === "string") : []
  } catch {
    return []
  }
}

/** The pages this reader opened last, kept in this browser for each account. */
function useRecentPages(pathname: string) {
  const { actor } = useSession()
  const key = `aov-admin:recent-pages:${actor?.issuer}:${actor?.subject}`
  const [recent, setRecent] = useState(() => readRecent(key))
  const [readKey, setReadKey] = useState(key)
  if (readKey !== key) {
    setReadKey(key)
    setRecent(readRecent(key))
  }
  useEffect(() => {
    const to = activeNavItem(pathname)?.to
    if (to) setRecent((previous) => rememberRecent(previous, to))
  }, [key, pathname])
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(recent))
    } catch {
      /* The list still works for this visit. */
    }
  }, [key, recent])
  return recent
}

export function AdminNavProvider({ children }: { children: ReactNode }) {
  const layout = usePageLayout()
  const { pathname } = useLocation()
  const { actor } = useSession()
  const { enabled: hotkeys } = useHotkeys()
  const [panelWanted, setPanelWanted] = useState(readPanelCookie)
  const canDock = useRoomToDock()
  const panelOpen = panelWanted && canDock
  const [picked, setPicked] = useState<NavAreaKey | null>(null)
  const [floating, setFloating] = useState<NavAreaKey | null>(null)
  const recent = useRecentPages(pathname)
  const areas = useMemo(() => areasFor(NAV_AREAS, actor?.capabilities ?? []), [actor?.capabilities])
  const current = activeNavArea(pathname)

  // Opening a page brings its own area back into view and puts away whatever floats.
  useEffect(() => {
    setPicked(null)
    setFloating(null)
  }, [pathname])

  const togglePanel = useCallback(() => {
    setFloating(null)
    setPanelWanted((open) => {
      document.cookie = `${PANEL_COOKIE}=${!open}; path=/; max-age=${PANEL_COOKIE_MAX_AGE}`
      return !open
    })
  }, [])

  useEffect(() => {
    if (layout !== "wide" || !canDock || !hotkeys) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key.toLowerCase() !== "b" || !(event.metaKey || event.ctrlKey)) return
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')
      )
        return
      event.preventDefault()
      togglePanel()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [layout, canDock, hotkeys, togglePanel])

  const value = useMemo<AdminNav>(
    () => ({
      layout,
      areas,
      current,
      canDock,
      panelOpen,
      togglePanel,
      shown: picked ?? current?.key ?? "home",
      pick: setPicked,
      floating,
      setFloating,
      recent,
    }),
    [layout, areas, current, canDock, panelOpen, togglePanel, picked, floating, recent],
  )
  return <AdminNavContext.Provider value={value}>{children}</AdminNavContext.Provider>
}

export function useAdminNav() {
  const context = useContext(AdminNavContext)
  if (!context) throw new Error("useAdminNav must be used within AdminNavProvider.")
  return context
}
