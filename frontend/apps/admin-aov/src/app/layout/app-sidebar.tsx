import { Link, useLocation } from "react-router"
import { BookOpenText } from "lucide-react"
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
import { NAV_GROUPS, type NavItem } from "@/app/nav"
import { useAttentionCounts } from "@/lib/use-wiki-index"
import { UserMenu } from "./user-menu"

export function isNavActive(item: Pick<NavItem, "to">, pathname: string) {
  return item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(item.to + "/")
}

export function AppSidebar() {
  const { pathname } = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()
  const counts = useAttentionCounts()

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
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
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const count = item.badge ? counts[item.badge] : undefined
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isNavActive(item, pathname)} tooltip={item.title}>
                      <Link to={item.to} onClick={() => isMobile && setOpenMobile(false)}>
                        <item.icon />
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
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
