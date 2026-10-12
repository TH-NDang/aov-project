import { Link, useLocation } from "react-router"
import { useEffect, useState } from "react"
import { BookOpenText, ChevronRight, PanelRightClose, PanelRightOpen } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@aov/ui/components/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@aov/ui/components/sidebar"
import { NAV_GROUPS, type NavItem, type NavSection } from "@/app/nav"
import { NavIcon } from "@/app/nav-icon"
import { useAttentionCounts } from "@/lib/use-wiki-index"
import { UserMenu } from "./user-menu"
import { HotkeyHelp } from "./hotkey-help"

export function isNavActive(item: Pick<NavItem, "to" | "activePaths">, pathname: string) {
  return (item.activePaths ?? [item.to]).some((path) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/"),
  )
}

type AttentionCounts = ReturnType<typeof useAttentionCounts>

function NavLink({ item, counts, nested = false }: { item: NavItem; counts: AttentionCounts; nested?: boolean }) {
  const { pathname } = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()
  const count = item.badge ? counts[item.badge] : undefined
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className="group-data-[collapsible=icon]:p-1!"
        isActive={isNavActive(item, pathname)}
        tooltip={item.title}
      >
        <Link to={item.to} className={nested ? "pl-6" : undefined} onClick={() => isMobile && setOpenMobile(false)}>
          <NavIcon item={item} />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
      {item.soon ? (
        <SidebarMenuBadge className="text-muted-foreground">Sắp có</SidebarMenuBadge>
      ) : count ? (
        <SidebarMenuBadge className="rounded-full bg-sidebar-accent px-1.5 text-sidebar-accent-foreground">
          {count}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  )
}

function WikiSection({ section, counts }: { section: NavSection; counts: AttentionCounts }) {
  const { pathname } = useLocation()
  const { state, isMobile } = useSidebar()
  const active = section.items.some((item) => isNavActive(item, pathname))
  const [open, setOpen] = useState(true)
  useEffect(() => {
    if (active) setOpen(true)
  }, [active, pathname])

  if (state === "collapsed" && !isMobile) {
    return (
      <>
        {section.items.map((item) => (
          <NavLink key={item.to} item={item} counts={counts} />
        ))}
      </>
    )
  }

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen} className="group/wiki-section">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="font-medium" tooltip={section.title}>
            <NavIcon item={section} />
            <span>{section.title}</span>
            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/wiki-section:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenu className="mt-1">
            {section.items.map((item) => (
              <NavLink key={item.to} item={item} counts={counts} nested />
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

export function AppSidebar() {
  const { isMobile, setOpenMobile, state, toggleSidebar } = useSidebar()
  const counts = useAttentionCounts()
  const collapsed = state === "collapsed" && !isMobile

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {collapsed ? (
              <div className="flex h-12 items-center justify-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      className="size-8 shrink-0 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-none hover:bg-sidebar-primary/85 focus-visible:ring-sidebar-ring"
                      onClick={toggleSidebar}
                      aria-label="Mở menu"
                    >
                      <PanelRightOpen className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Mở menu · Ctrl B</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <SidebarMenuButton size="lg" asChild tooltip="AOV Admin">
                  <Link to="/" onClick={() => isMobile && setOpenMobile(false)}>
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <BookOpenText className="size-4" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">AOV Admin</span>
                      <span className="truncate text-xs text-muted-foreground">Liên Quân Wiki</span>
                    </div>
                  </Link>
                </SidebarMenuButton>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={toggleSidebar}
                  aria-label="Thu gọn menu"
                  title="Thu gọn menu · Ctrl B"
                >
                  <PanelRightClose className="size-4" />
                </Button>
              </div>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <NavLink key={item.to} item={item} counts={counts} />
              ))}
              {group.sections?.map((section) => (
                <WikiSection key={section.title} section={section} counts={counts} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <HotkeyHelp />
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
