import type { CSSProperties } from "react"
import { useLocation } from "react-router"
import { BackgroundTasksProvider } from "../background-tasks"
import { ImportWorkspaceHost } from "./import-workspace-host"
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
  const importing = useLocation().pathname === "/hero/import"
  return (
    <BackgroundTasksProvider>
      <PageTabsProvider>
        <SidebarProvider
          defaultOpen={readSidebarCookie()}
          keyboardShortcutEnabled={enabled}
          style={{ "--sidebar-width": "15rem" } as CSSProperties}
        >
          <SidebarInset className="h-svh min-w-0 overflow-hidden">
            <SiteHeader />
            <div className={`${importing ? "hidden" : "flex"} min-h-0 flex-1 flex-col`}>
              <PageTabPanels />
            </div>
            <ImportWorkspaceHost />
          </SidebarInset>
          <AppSidebar />
        </SidebarProvider>
      </PageTabsProvider>
    </BackgroundTasksProvider>
  )
}
