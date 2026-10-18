import { useEffect, useState, type ReactNode } from "react"
import { useLocation } from "react-router"
/** Keep background work mounted even when its navigation tab is closed. */
export function PersistentWorkspace({ path, children }: { path: string; children: ReactNode }) {
  const active = useLocation().pathname === path
  const [visited, setVisited] = useState(active)
  useEffect(() => {
    if (active) setVisited(true)
  }, [active])
  if (!active && !visited) return null
  return (
    <div
      hidden={!active}
      data-workspace={path}
      className={`${active ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col overflow-auto`}
    >
      {children}
    </div>
  )
}
