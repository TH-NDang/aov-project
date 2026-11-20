import type { ComponentType } from "react"
import { GitCompareArrows, LayoutList } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import type { HeroWorkspaceView } from "../../model/hero-location"

type Icon = ComponentType<{ className?: string }>

const views: readonly [HeroWorkspaceView, Icon, string][] = [
  ["overview", LayoutList, "Nội dung"],
  ["history", GitCompareArrows, "Lịch sử"],
]

/**
 * Two tabs: the hero's content, read or translated, and its history (the version on screen, the changes patch by patch
 * and any two versions compared). Drafts start from the pencil in the header. The row stays under the scrolled hero
 * name so switching never needs a scroll back up; under the hero header it rides with it (`sticky={false}`).
 */
export function HeroWorkspaceTabs({
  view,
  busy,
  onView,
  sticky = true,
}: {
  view: HeroWorkspaceView
  busy: boolean
  onView: (view: HeroWorkspaceView) => void
  sticky?: boolean
}) {
  return (
    // Sticky bars are left out of scroll anchoring, so sections loading above the screen do not push the page down.
    <nav
      aria-label="Các phần của tướng"
      className={cn("flex border-b bg-background", sticky && "sticky top-12 z-10 [overflow-anchor:none]")}
    >
      <div role="tablist" aria-label="Không gian quản lý tướng" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {views.map(([key, Icon, label]) => {
          const selected = view === key || (key === "overview" && view === "translations")
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
                // One height at every width: the icon beside the label, the chosen tab underlined in the accent.
                "relative h-10 shrink-0 gap-1.5 rounded-b-none border-b-2 px-2.5",
                selected ? "border-primary text-primary" : "border-transparent text-muted-foreground",
              )}
              onClick={() => onView(key)}
            >
              <Icon className="size-4" />
              <span className="max-w-full truncate">{label}</span>
            </Button>
          )
        })}
      </div>
    </nav>
  )
}
