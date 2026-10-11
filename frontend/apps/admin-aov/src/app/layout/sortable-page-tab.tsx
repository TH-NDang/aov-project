import { useCallback, type CSSProperties, type ReactNode } from "react"
import { Link } from "react-router"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { FileQuestion, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { MEDIA_NAV, NAV_ITEMS } from "@/app/nav"

export interface TabPresentation {
  path: string
  to: string
  label: ReactNode
}
const TAB_NAV = [...MEDIA_NAV, ...NAV_ITEMS]

function TabLabel({ tab }: { tab: TabPresentation }) {
  const Icon =
    TAB_NAV.find((item) =>
      (item.activePaths ?? [item.to]).some(
        (path) => tab.path === path || (path !== "/" && tab.path.startsWith(path + "/")),
      ),
    )?.icon ?? FileQuestion
  return (
    <>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{tab.label}</span>
    </>
  )
}

export function PageTabOverlay({ tab, width }: { tab: TabPresentation; width?: number }) {
  return (
    <div
      style={{ width }}
      className="flex h-10 items-center gap-2 rounded-t-lg border bg-background px-3 text-sm shadow-lg"
    >
      <TabLabel tab={tab} />
      <X aria-hidden="true" className="ml-auto size-3" />
    </div>
  )
}

export function SortablePageTab({
  tab,
  active,
  canClose,
  onClose,
}: {
  tab: TabPresentation
  active: boolean
  canClose: boolean
  onClose: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.path,
  })
  const setTabRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node)
      setActivatorNodeRef(node)
    },
    [setNodeRef, setActivatorNodeRef],
  )
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div
      ref={setTabRef}
      style={style}
      {...attributes}
      {...listeners}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget) listeners?.onKeyDown?.(event)
      }}
      aria-label={`Di chuyển tab ${typeof tab.label === "string" ? tab.label : "chi tiết tướng"}`}
      className={cn(
        "flex h-10 shrink-0 cursor-grab items-center rounded-t-lg border border-b-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        active ? "border-border bg-background" : "border-transparent text-muted-foreground hover:bg-muted",
        isDragging && "opacity-30",
      )}
    >
      <Link
        to={tab.to}
        draggable={false}
        aria-current={active ? "page" : undefined}
        className="flex h-full max-w-64 cursor-grab select-none items-center gap-2 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <TabLabel tab={tab} />
      </Link>
      {canClose && (
        <Button
          variant="ghost"
          size="icon"
          className="mr-1 size-6 shrink-0 cursor-pointer"
          onClick={onClose}
          onMouseDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          aria-label={`Đóng tab ${typeof tab.label === "string" ? tab.label : "chi tiết tướng"}`}
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  )
}
