import { Outlet, ScrollRestoration } from "react-router"
import { SidebarInset, SidebarProvider } from "@aov/ui/components/sidebar"
import { AppSidebar } from "./app-sidebar"
import { SiteHeader } from "./site-header"

function readSidebarCookie(): boolean {
  const match = document.cookie.match(/(?:^|;\s*)sidebar_state=(true|false)/)
  return match ? match[1] === "true" : true
}

/** Content on the left, navigation sidebar docked on the right edge. */
export function AppShell() {
  return (
    <SidebarProvider defaultOpen={readSidebarCookie()}>
      <SidebarInset className="min-w-0">
        <SiteHeader />
        <div className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
      </SidebarInset>
      <AppSidebar />
      <ScrollRestoration />
    </SidebarProvider>
  )
}
