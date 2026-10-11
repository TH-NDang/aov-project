import { SidebarInset, SidebarProvider } from "@aov/ui/components/sidebar"
import { AppSidebar } from "./app-sidebar"
import { SiteHeader } from "./site-header"
import { PageTabPanels, PageTabsProvider } from "./page-tabs"
import { useHotkeys } from "../hotkeys"

function readSidebarCookie(): boolean {
  const match = document.cookie.match(/(?:^|;\s*)sidebar_state=(true|false)/)
  return match ? match[1] === "true" : true
}

/** Content on the left, navigation sidebar docked on the right edge. */
export function AppShell() {
  const { enabled } = useHotkeys()
  return (
    <PageTabsProvider>
      <SidebarProvider defaultOpen={readSidebarCookie()} keyboardShortcutEnabled={enabled}>
        <SidebarInset className="h-svh min-w-0 overflow-hidden">
          <SiteHeader />
          <PageTabPanels />
        </SidebarInset>
        <AppSidebar />
      </SidebarProvider>
    </PageTabsProvider>
  )
}
