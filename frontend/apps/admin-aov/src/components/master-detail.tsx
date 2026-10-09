import type { ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@aov/ui/components/drawer"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@aov/ui/components/resizable"
import { cn } from "@aov/ui/lib/utils"
import { useIsWide } from "@/hooks/use-media-query"

interface MasterDetailProps {
  /** Main list/workspace. It owns its own scrolling. */
  children: ReactNode
  detail: ReactNode | null
  detailTitle: string
  onCloseDetail: () => void
  className?: string
}

/**
 * Workspace that fills the viewport below the header. On wide screens the detail opens as a
 * resizable panel beside the list; on narrow screens it slides up as a drawer.
 */
export function MasterDetail({ children, detail, detailTitle, onCloseDetail, className }: MasterDetailProps) {
  const wide = useIsWide()
  const frame = cn("flex h-[calc(100svh-3.5rem)] min-h-0", className)

  if (!wide) {
    return (
      <div className={frame}>
        <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
        <Drawer open={detail !== null} onOpenChange={(open) => !open && onCloseDetail()}>
          <DrawerContent className="max-h-[88svh]">
            <DrawerHeader className="sr-only">
              <DrawerTitle>{detailTitle}</DrawerTitle>
              <DrawerDescription>Chi tiết mục đang chọn</DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">{detail}</div>
          </DrawerContent>
        </Drawer>
      </div>
    )
  }

  // The panel group sets an inline `height: 100%`, so the fixed height lives on a wrapper.
  return (
    <div className={frame}>
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel id="master" minSize="40%" className="min-w-0">
          <div className="h-full overflow-y-auto">{children}</div>
        </ResizablePanel>
        {detail !== null && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel id="detail" defaultSize="38%" minSize={340} maxSize="60%" className="min-w-0">
              <aside aria-label={detailTitle} className="relative h-full overflow-y-auto bg-background">
                <div className="sticky top-0 z-20 h-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-3 right-3 bg-background/80"
                    onClick={onCloseDetail}
                    aria-label="Đóng chi tiết"
                  >
                    <X />
                  </Button>
                </div>
                {detail}
              </aside>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  )
}
