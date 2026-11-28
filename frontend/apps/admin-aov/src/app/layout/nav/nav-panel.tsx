import { PanelLeftClose } from "lucide-react"
import { AovNavIcon } from "@/app/aov-nav-icon"
import type { NavArea } from "@/app/nav"
import { BackgroundTaskStatus } from "../background-task-status"
import { useAdminNav } from "./admin-nav"
import { AreaPages } from "./area-pages"
import "./admin-nav.css"

/** One area: its name over a faint crest of its mark, then its pages. */
export function AreaPanel({
  area,
  onNavigate,
  onCollapse,
}: {
  area: NavArea
  onNavigate?: () => void
  onCollapse?: () => void
}) {
  return (
    <>
      <header className="adm-area-head">
        <span className="adm-area-crest" aria-hidden="true">
          <AovNavIcon name={area.icon} className="size-full" />
        </span>
        <h2 className="adm-area-title type-section-title">{area.title}</h2>
        {onCollapse && (
          <button type="button" className="adm-icon-button" onClick={onCollapse} title="Thu gọn · Ctrl B">
            <PanelLeftClose aria-hidden="true" />
            <span className="sr-only">Thu gọn danh sách trang</span>
          </button>
        )}
      </header>
      <nav className="adm-area-pages" aria-label={area.title}>
        <AreaPages area={area} onNavigate={onNavigate} />
      </nav>
    </>
  )
}

/** The pages of the area picked on the rail, standing beside it until put away with Ctrl B. */
export function NavPanel() {
  const { areas, shown, togglePanel } = useAdminNav()
  const area = areas.find((entry) => entry.key === shown) ?? areas[0]
  if (!area) return null
  return (
    <aside className="adm-panel">
      <AreaPanel area={area} onCollapse={togglePanel} />
      <BackgroundTaskStatus />
    </aside>
  )
}
