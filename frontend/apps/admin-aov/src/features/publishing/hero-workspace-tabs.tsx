import type { ComponentType } from "react"
import {
  BookOpen,
  Check,
  GitCompareArrows,
  ImageIcon,
  Languages,
  Layers,
  MoreHorizontal,
  Sparkles,
  Swords,
} from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { cn } from "@aov/ui/lib/utils"
import type { HeroContentTab, HeroWorkspaceView } from "./hero-location"

type Icon = ComponentType<{ className?: string }>
type OtherView = Exclude<HeroWorkspaceView, "overview">

const contentTabs: readonly [HeroContentTab, Icon, string][] = [
  ["overview", BookOpen, "Tổng quan"],
  ["skills", Swords, "Kỹ năng"],
  ["skins", Sparkles, "Trang phục"],
  ["media", ImageIcon, "Ảnh"],
]
const otherViews: readonly [OtherView, Icon, string][] = [
  ["translations", Languages, "Bản dịch"],
  ["history", GitCompareArrows, "Lịch sử"],
  ["patch", Layers, "Theo patch"],
]

/**
 * One tab row: the hero's content sections, then translations, history and patch data. On a narrow page the content
 * sections share the width as icon tabs, the other views move into a "More" menu, and the row stays under the scrolled hero
 * name so switching never needs a scroll back up.
 */
export function HeroWorkspaceTabs({
  view,
  contentTab,
  busy,
  counts,
  onContentTab,
  onView,
}: {
  view: HeroWorkspaceView
  contentTab: HeroContentTab
  busy: boolean
  counts: Partial<Record<HeroContentTab, number | null>>
  onContentTab: (tab: HeroContentTab) => void
  onView: (view: OtherView) => void
}) {
  const activeOther = otherViews.find(([key]) => key === view)
  const MoreIcon = activeOther?.[1] ?? MoreHorizontal
  const tab = (selected: boolean, wide = false) =>
    cn(
      "relative shrink-0 rounded-b-none border-b-2 @2xl:h-9 @2xl:px-2.5",
      // Narrow: icon over label, every slot the same width.
      "@max-2xl:h-14 @max-2xl:min-w-0 @max-2xl:flex-col @max-2xl:gap-1 @max-2xl:px-0.5 @max-2xl:text-xs @max-2xl:has-[>svg]:px-0.5",
      wide && "@max-2xl:hidden",
      selected ? "border-primary text-primary" : "border-transparent text-muted-foreground",
    )
  return (
    <nav aria-label="Các phần của tướng" className="z-10 flex border-b bg-background @max-2xl:sticky @max-2xl:top-12">
      <div
        role="tablist"
        aria-label="Không gian quản lý tướng"
        className="grid min-w-0 flex-1 grid-cols-4 @2xl:flex @2xl:gap-0.5 @2xl:overflow-x-auto"
      >
        {contentTabs.map(([key, Icon, label]) => {
          const selected = view === "overview" && contentTab === key
          const count = counts[key]
          return (
            <Button
              key={key}
              role="tab"
              aria-selected={selected}
              aria-controls={key === "overview" ? "workspace-overview" : `hero-content-${key}`}
              disabled={busy}
              variant="ghost"
              size="sm"
              className={tab(selected)}
              onClick={() => onContentTab(key)}
            >
              <Icon className="size-4 @max-2xl:size-5" />
              <span className="max-w-full truncate">{label}</span>
              {count !== null && count !== undefined && (
                <span className="text-xs tabular-nums text-muted-foreground @max-2xl:absolute @max-2xl:top-1 @max-2xl:left-[calc(50%+0.5rem)] @max-2xl:rounded-full @max-2xl:bg-muted @max-2xl:px-1.5 @max-2xl:leading-4">
                  {count}
                </span>
              )}
            </Button>
          )
        })}
        {otherViews.map(([key, Icon, label]) => (
          <Button
            key={key}
            role="tab"
            aria-selected={view === key}
            aria-controls={`workspace-${key}`}
            disabled={busy}
            variant="ghost"
            size="sm"
            className={tab(view === key, true)}
            onClick={() => onView(key)}
          >
            <Icon className="size-4" />
            {label}
          </Button>
        ))}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            aria-label={
              activeOther ? `Đang mở ${activeOther[2]} · chọn phần khác` : "Thêm phần: Bản dịch, Lịch sử, Theo patch"
            }
            className={cn(tab(!!activeOther), "w-1/5 @2xl:hidden")}
          >
            <MoreIcon className="size-5" />
            <span className="max-w-full truncate">{activeOther?.[2] ?? "Thêm"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {otherViews.map(([key, Icon, label]) => (
            <DropdownMenuItem key={key} onSelect={() => onView(key)}>
              <Icon />
              {label}
              {view === key && <Check className="ml-auto" aria-label="Đang mở" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  )
}
