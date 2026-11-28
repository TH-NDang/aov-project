import { Link } from "react-router"
import { PanelLeftOpen, Search } from "lucide-react"
import { AovMark } from "@aov/ui/components/aov-brand"
import { Popover, PopoverAnchor, PopoverContent } from "@aov/ui/components/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import { AovNavIcon } from "@/app/aov-nav-icon"
import type { NavArea } from "@/app/nav"
import { BackgroundTaskStatus } from "../background-task-status"
import { useCommandSearch } from "../command-search"
import { useAttentionCounts } from "../use-attention-counts"
import { UserMenu } from "../user-menu"
import { useAdminNav } from "./admin-nav"
import { AreaPanel } from "./nav-panel"
import { areaCount } from "./nav-model"
import "./admin-nav.css"

function RailArea({ area, count }: { area: NavArea; count: number }) {
  const { current, shown, pick, panelOpen: docked, floating, setFloating } = useAdminNav()
  // With the list beside it the rail switches what the list shows; on its own it opens the area as a floating list.
  const open = floating === area.key
  const button = (
    <button
      type="button"
      className="adm-rail-area"
      data-current={current?.key === area.key || undefined}
      data-shown={(docked ? shown === area.key : open) || undefined}
      aria-pressed={docked ? shown === area.key : undefined}
      aria-expanded={docked ? undefined : open}
      aria-label={count ? `${area.title}, ${count} mục mới` : area.title}
      onClick={() => (docked ? pick(area.key) : setFloating(open ? null : area.key))}
    >
      <span className="adm-rail-socket">
        <AovNavIcon name={area.icon} className="size-6.5" />
        {!!count && <span className="adm-rail-count">{count}</span>}
      </span>
      <span className="adm-rail-label">{area.short ?? area.title}</span>
    </button>
  )
  if (docked) return button
  return (
    <Popover open={open} onOpenChange={(next) => setFloating(next ? area.key : null)}>
      <PopoverAnchor asChild>{button}</PopoverAnchor>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        className="adm-flyout w-64 p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <AreaPanel area={area} onNavigate={() => setFloating(null)} />
      </PopoverContent>
    </Popover>
  )
}

/**
 * The rail along the left edge of wide screens: the brand, search, the five areas and the account. It stays on the
 * night colour in both themes, like the game's own menu column.
 */
export function NavRail() {
  const { areas, canDock, panelOpen, togglePanel } = useAdminNav()
  const counts = useAttentionCounts()
  const search = useCommandSearch()
  return (
    <nav className="adm-rail" aria-label="Khu vực quản trị">
      <Link to="/" className="adm-rail-brand" aria-label="AOV Admin, bảng điều khiển">
        <AovMark />
      </Link>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="adm-rail-search" aria-label="Tìm kiếm" onClick={search.open}>
            <Search />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Tìm · Ctrl K</TooltipContent>
      </Tooltip>
      <div className="adm-rail-areas">
        {areas.map((area) => (
          <RailArea key={area.key} area={area} count={areaCount(area, counts)} />
        ))}
      </div>
      <div className="adm-rail-foot">
        {!panelOpen && <BackgroundTaskStatus variant="icon" />}
        {canDock && !panelOpen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="adm-rail-tool" aria-label="Mở danh sách trang" onClick={togglePanel}>
                <PanelLeftOpen />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Mở danh sách · Ctrl B</TooltipContent>
          </Tooltip>
        )}
        <UserMenu />
      </div>
    </nav>
  )
}
