import { useEffect, useState, type ReactNode } from "react"
import { type UIMatch } from "react-router"
import { PanelRight, Search } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { useSidebar } from "@aov/ui/components/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import { CommandMenu } from "./command-menu"
import { AdminBreadcrumb } from "./admin-breadcrumb"
import { useHotkeys } from "../hotkeys"

export interface RouteHandle {
  crumb?: (match: UIMatch) => ReactNode
  /** Redirect-only routes stay out of the breadcrumb. */
  pageTab?: boolean
}

/** The bar above every page: where the page sits, then search and, on phones, the menu. */
export function SiteHeader() {
  const { enabled } = useHotkeys()
  const { toggleSidebar, isMobile } = useSidebar()
  const [commandOpen, setCommandOpen] = useState(false)

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
    <div className="sticky top-0 z-30 flex h-12 min-w-0 shrink-0 items-center gap-2 border-b bg-background px-3">
      <AdminBreadcrumb />
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 md:size-8"
              onClick={() => setCommandOpen(true)}
              aria-label="Tìm kiếm (Ctrl K)"
            >
              <Search className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Tìm kiếm · Ctrl K</TooltipContent>
        </Tooltip>
        {isMobile && (
          <Button variant="ghost" size="icon" className="size-9" onClick={toggleSidebar} aria-label="Mở menu">
            <PanelRight />
          </Button>
        )}
      </div>
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  )
}
