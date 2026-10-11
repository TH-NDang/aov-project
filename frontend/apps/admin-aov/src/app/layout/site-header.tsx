import { useEffect, useState, type ReactNode } from "react"
import { type UIMatch } from "react-router"
import { createPortal } from "react-dom"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Modifier,
} from "@dnd-kit/core"
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { PanelRight, Search } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { useSidebar } from "@aov/ui/components/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import { CommandMenu } from "./command-menu"
import { usePageTabs } from "./page-tabs"
import { PageTabOverlay, SortablePageTab } from "./sortable-page-tab"
import { useHotkeys } from "../hotkeys"

export interface RouteHandle {
  crumb?: (match: UIMatch) => ReactNode
}

const horizontalOnly: Modifier = ({ transform }) => ({ ...transform, y: 0 })
const modifiers = [horizontalOnly]

export function SiteHeader() {
  const { enabled } = useHotkeys()
  const { sessions: tabs, activePath: pathname, closeTab, moveTab } = usePageTabs()
  const { toggleSidebar, isMobile } = useSidebar()
  const [commandOpen, setCommandOpen] = useState(false)
  const [dragging, setDragging] = useState<{ path: string; width?: number } | null>(null)
  const draggedTab = tabs.find((tab) => tab.path === dragging?.path)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: enabled ? ["Space", "Enter"] : [], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!enabled) return
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setCommandOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled])

  return (
    <div className="sticky top-0 z-30 flex min-w-0 shrink-0 items-end gap-2 border-b bg-background px-2 pt-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={modifiers}
        onDragStart={({ active }) =>
          setDragging({ path: String(active.id), width: active.rect.current.initial?.width })
        }
        onDragCancel={() => setDragging(null)}
        onDragEnd={({ active, over }) => {
          if (over) moveTab(String(active.id), String(over.id))
          setDragging(null)
        }}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Nhấn Space để bắt đầu di chuyển tab, dùng mũi tên trái/phải, nhấn Space để thả hoặc Escape để hủy.",
          },
        }}
      >
        <nav
          aria-label="Các trang đang mở"
          className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto overflow-y-hidden"
        >
          <SortableContext items={tabs.map((tab) => tab.path)} strategy={horizontalListSortingStrategy}>
            {tabs.map((tab) => (
              <SortablePageTab
                key={tab.path}
                tab={tab}
                active={tab.path === pathname}
                canClose={tabs.length > 1 || tab.path !== "/"}
                onClose={() => closeTab(tab.path)}
              />
            ))}
          </SortableContext>
        </nav>
        {createPortal(
          <DragOverlay dropAnimation={null} modifiers={modifiers}>
            {draggedTab && <PageTabOverlay tab={draggedTab} width={dragging?.width} />}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
      <div className="flex shrink-0 items-center gap-1 pb-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setCommandOpen(true)}
              aria-label="Tìm kiếm (Ctrl K)"
            >
              <Search className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Tìm kiếm · Ctrl K</TooltipContent>
        </Tooltip>
        {isMobile && (
          <Button variant="ghost" size="icon" className="size-8" onClick={toggleSidebar} aria-label="Mở menu">
            <PanelRight />
          </Button>
        )}
      </div>
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  )
}
