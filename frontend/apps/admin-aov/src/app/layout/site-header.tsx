import { Fragment, useEffect, useState, type ReactNode } from "react"
import { Link, useMatches, useNavigation, type UIMatch } from "react-router"
import { PanelRight, Search } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@aov/ui/components/breadcrumb"
import { Button } from "@aov/ui/components/button"
import { Kbd, KbdGroup } from "@aov/ui/components/kbd"
import { Separator } from "@aov/ui/components/separator"
import { useSidebar } from "@aov/ui/components/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import { cn } from "@aov/ui/lib/utils"
import { api } from "@/lib/api/client"
import { CommandMenu } from "./command-menu"

export interface RouteHandle {
  crumb?: (match: UIMatch) => ReactNode
}

function Crumbs() {
  const matches = useMatches() as UIMatch<unknown, RouteHandle | undefined>[]
  const crumbs = matches.filter((match) => match.handle?.crumb)
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((match, index) => {
          const last = index === crumbs.length - 1
          const content = match.handle!.crumb!(match)
          return (
            <Fragment key={match.id}>
              {index > 0 && <BreadcrumbSeparator className="hidden md:block" />}
              <BreadcrumbItem className={cn("min-w-0", !last && "hidden md:inline-flex")}>
                {last ? (
                  <BreadcrumbPage className="truncate">{content}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={match.pathname}>{content}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export function SiteHeader() {
  const { toggleSidebar } = useSidebar()
  const navigation = useNavigation()
  const [commandOpen, setCommandOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setCommandOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 -bottom-px h-0.5 origin-left bg-primary transition-transform duration-500",
          navigation.state === "loading" ? "scale-x-75" : "scale-x-0 duration-0",
        )}
      />
      <Crumbs />
      <div className="ml-auto flex items-center gap-2">
        {api.mode === "mock" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="hidden sm:inline-flex">
                Dữ liệu mẫu
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              Đọc từ resources/Lien-Quan-v3. Thay đổi chỉ lưu trong trình duyệt này cho tới khi có admin API.
            </TooltipContent>
          </Tooltip>
        )}
        <Button
          variant="outline"
          className="h-8 w-9 justify-start gap-2 px-2 text-muted-foreground sm:w-56 lg:w-64"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="size-4" />
          <span className="hidden flex-1 text-left font-normal sm:inline">Tìm tướng, trang bị…</span>
          <KbdGroup className="hidden sm:inline-flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Button>
        <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" onClick={toggleSidebar}>
              <PanelRight />
              <span className="sr-only">Mở/đóng menu</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Mở/đóng menu <Kbd className="ml-1">Ctrl B</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </header>
  )
}
