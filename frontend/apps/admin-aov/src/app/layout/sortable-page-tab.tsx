import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { Link } from "react-router"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@aov/ui/components/hover-card"
import { cn } from "@aov/ui/lib/utils"
import { MEDIA_NAV, NAV_ITEMS } from "@/app/nav"
import { NavIcon } from "@/app/nav-icon"
import { PageTabPreviewImage } from "./page-tab-preview"

export interface TabPresentation {
  path: string
  to: string
  label: ReactNode
}
const TAB_NAV = [...MEDIA_NAV, ...NAV_ITEMS]

function TabLabel({ tab }: { tab: TabPresentation }) {
  const item = TAB_NAV.find((item) =>
    (item.activePaths ?? [item.to]).some(
      (path) => tab.path === path || (path !== "/" && tab.path.startsWith(path + "/")),
    ),
  ) ?? { icon: "page" as const }
  return (
    <>
      <NavIcon item={item} className="size-4" />
      <span className="min-w-0 truncate">{tab.label}</span>
    </>
  )
}

export function PageTabOverlay({ tab, width }: { tab: TabPresentation; width?: number }) {
  return (
    <div
      style={{ width }}
      className="flex h-8 w-44 items-center gap-2 rounded-t-md border bg-background px-2.5 text-xs shadow-lg"
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
  previewDisabled = false,
  onClose,
}: {
  tab: TabPresentation
  active: boolean
  canClose: boolean
  previewDisabled?: boolean
  onClose: () => void
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewTitle, setPreviewTitle] = useState("")
  const link = useRef<HTMLAnchorElement>(null)
  useEffect(() => setPreviewOpen(false), [active, tab.to, previewDisabled])
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
    <HoverCard
      open={previewOpen && !previewDisabled}
      openDelay={450}
      closeDelay={100}
      onOpenChange={(open) => {
        if (open) setPreviewTitle(link.current?.textContent?.trim() || "AOV Admin")
        setPreviewOpen(open && !previewDisabled)
      }}
    >
      <HoverCardTrigger asChild>
        <div
          ref={setTabRef}
          style={style}
          {...attributes}
          {...listeners}
          onPointerDownCapture={() => setPreviewOpen(false)}
          onKeyDown={(event) => {
            if (event.target === event.currentTarget) listeners?.onKeyDown?.(event)
          }}
          aria-label={`Di chuyển tab ${typeof tab.label === "string" ? tab.label : "chi tiết tướng"}`}
          className={cn(
            "flex h-8 w-44 shrink-0 cursor-grab items-center rounded-t-md border border-b-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            active ? "border-border bg-background" : "border-transparent text-muted-foreground hover:bg-muted",
            isDragging && "opacity-30",
          )}
        >
          <Link
            ref={link}
            to={tab.to}
            draggable={false}
            aria-current={active ? "page" : undefined}
            className="flex h-full min-w-0 flex-1 cursor-grab select-none items-center gap-2 px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <TabLabel tab={tab} />
          </Link>
          {canClose && (
            <Button
              variant="ghost"
              size="icon"
              className="mr-1 size-5 shrink-0 cursor-pointer"
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
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        className="pointer-events-none w-72 overflow-hidden rounded-lg p-0 shadow-xl"
        onEscapeKeyDown={() => setPreviewOpen(false)}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="min-w-0 flex-1 text-xs font-semibold leading-relaxed">{previewTitle}</span>
          {active && <span className="shrink-0 text-[10px] text-muted-foreground">Đang mở</span>}
        </div>
        <PageTabPreviewImage path={tab.path} />
      </HoverCardContent>
    </HoverCard>
  )
}
