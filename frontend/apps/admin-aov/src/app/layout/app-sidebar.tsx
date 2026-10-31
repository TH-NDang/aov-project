import { BackgroundTaskStatus } from "./background-task-status"
import { Link, useLocation } from "react-router"
import { useEffect, useState } from "react"
import { ChevronRight, PanelRightClose, PanelRightOpen } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { AovMark, AovWordmark } from "@aov/ui/components/aov-brand"
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
import { NAV_GROUPS, activeNavItem, isNavActive, type NavItem, type NavSection } from "@/app/nav"
import { NavIcon } from "@/app/nav-icon"
import { useAttentionCounts } from "@/lib/use-wiki-index"
import { UserMenu } from "./user-menu"
import { useSession } from "@/app/auth/auth-gate"

type AttentionCounts = ReturnType<typeof useAttentionCounts>

function NavLink({ item, counts, nested = false }: { item: NavItem; counts: AttentionCounts; nested?: boolean }) {
  const { actor } = useSession()
  const { pathname } = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()
  const count = item.badge ? counts[item.badge] : undefined
  if (item.capability && !actor?.capabilities.includes(item.capability)) return null
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className="h-8 gap-2 group-data-[collapsible=icon]:h-8! group-data-[collapsible=icon]:p-1! [&>svg]:size-5 data-[active=true]:[&>svg]:text-[var(--aov-icon-accent,#b28b44)]"
        isActive={activeNavItem(pathname)?.to === item.to}
        tooltip={item.title}
      >
        <Link to={item.to} className={nested ? "pl-5" : undefined} onClick={() => isMobile && setOpenMobile(false)}>
          <NavIcon item={item} />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
      {item.soon ? (
        <SidebarMenuBadge className="top-1.5! text-muted-foreground">Sắp có</SidebarMenuBadge>
      ) : count ? (
        <SidebarMenuBadge className="top-1.5! rounded-full bg-sidebar-accent px-1.5 text-sidebar-accent-foreground">
          {count}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  )
}

function NavigationSection({ section, counts }: { section: NavSection; counts: AttentionCounts }) {
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
    <Collapsible asChild open={open} onOpenChange={setOpen} className="group/nav-section">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="h-8 gap-2 font-medium [&>svg:first-child]:size-5" tooltip={section.title}>
            <NavIcon item={section} />
            <span>{section.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 ease-out group-data-[state=open]/nav-section:rotate-90 motion-reduce:transition-none" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
          <SidebarMenu className="pt-0.5">
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
                      className="group/brand relative size-8 shrink-0 rounded-lg bg-[#18181b] text-white shadow-none hover:bg-[#18181b]/90 focus-visible:ring-sidebar-ring"
                      onClick={toggleSidebar}
                      aria-label="Mở menu"
                    >
                      <AovMark className="size-6 group-hover/brand:opacity-0 group-focus-visible/brand:opacity-0" />
                      <PanelRightOpen className="absolute size-4 opacity-0 group-hover/brand:opacity-100 group-focus-visible/brand:opacity-100" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Mở menu · Ctrl B</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <SidebarMenuButton size="lg" asChild tooltip="AOV Admin">
                  <Link to="/" onClick={() => isMobile && setOpenMobile(false)}>
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#18181b]">
                      <AovMark className="size-6" />
                    </div>
                    <AovWordmark product="Admin" className="flex-1 text-base" />
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

      <SidebarContent className="[overflow-anchor:none] [scrollbar-gutter:stable] group-data-[collapsible=icon]:[scrollbar-gutter:auto]">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="px-2 py-1">
            <SidebarGroupLabel className="h-6 text-xs tracking-wide uppercase">{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.sections?.map((section) => (
                <NavigationSection key={section.title} section={section} counts={counts} />
              ))}
              {group.items.map((item) => (
                <NavLink key={item.to} item={item} counts={counts} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <BackgroundTaskStatus />
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
