import type { ComponentType } from "react"
import { GitBranch, GitCompareArrows, Languages, Layers, LayoutList } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import type { HeroWorkspaceView } from "./hero-location"

type Icon = ComponentType<{ className?: string }>

const views: readonly [HeroWorkspaceView, Icon, string][] = [
  ["overview", LayoutList, "Nội dung"],
  ["translations", Languages, "Bản dịch"],
  ["history", GitCompareArrows, "Lịch sử"],
  ["patch", Layers, "Theo patch"],
  ["versions", GitBranch, "Phiên bản"],
]

/**
 * One tab row: the hero's content as a single page, then translations, history, patch data and version management.
 * On a narrow page the tabs share the width as icon tabs, and the row stays under the scrolled hero name so switching
 * never needs a scroll back up. The content page lists its own sections.
 */
export function HeroWorkspaceTabs({
  view,
  busy,
  onView,
}: {
  view: HeroWorkspaceView
  busy: boolean
  onView: (view: HeroWorkspaceView) => void
}) {
  return (
    // Sticky bars are left out of scroll anchoring, so sections loading above the screen do not push the page down.
    <nav
      aria-label="Các phần của tướng"
      className="sticky top-12 z-10 flex border-b bg-background [overflow-anchor:none]"
    >
      <div
        role="tablist"
        aria-label="Không gian quản lý tướng"
        className="flex min-w-0 flex-1 @2xl:gap-0.5 @2xl:overflow-x-auto"
      >
        {views.map(([key, Icon, label]) => {
          const selected = view === key
          return (
            <Button
              key={key}
              role="tab"
              aria-selected={selected}
              aria-controls={`workspace-${key}`}
              disabled={busy}
              variant="ghost"
              size="sm"
              className={cn(
                "relative shrink-0 rounded-b-none border-b-2 @2xl:h-9 @2xl:px-2.5",
                // Narrow: icon over label; slots start from their label width and share the rest, so no label is cut.
                "@max-2xl:h-14 @max-2xl:min-w-0 @max-2xl:flex-auto @max-2xl:flex-col @max-2xl:gap-1 @max-2xl:px-0.5 @max-2xl:text-xs @max-2xl:has-[>svg]:px-0.5",
                selected ? "border-primary text-primary" : "border-transparent text-muted-foreground",
              )}
              onClick={() => onView(key)}
            >
              <Icon className="size-4 @max-2xl:size-5" />
              <span className="max-w-full truncate">{label}</span>
            </Button>
          )
        })}
      </div>
    </nav>
  )
}
