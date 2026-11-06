import type { CSSProperties } from "react"
import { useLocation } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "@/app/auth/auth-gate"
import { selfProfile, userKeys } from "@/features/users/user-api"
import { useAccountCurrency } from "@aov/ui/lib/currency"
import { useAccountDateFormat, useAccountTimeZone } from "@aov/ui/lib/time-zone"
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

/** Lives in the shell because the sidebar and its account menu are not mounted on phones until opened. */
function AccountPreferences() {
  const { actor } = useSession()
  const profile = useQuery({
    queryKey: [...userKeys.self, actor?.issuer, actor?.subject],
    queryFn: ({ signal }) => selfProfile(signal),
    enabled: !!actor,
    refetchInterval: 600000,
  })
  useAccountTimeZone(profile.data)
  useAccountCurrency(profile.data)
  useAccountDateFormat(profile.data)
  return null
}

/** Navigation sidebar docked on the left edge, content on the right. */
export function AppShell() {
  const { enabled } = useHotkeys()
  const importing = useLocation().pathname === "/hero/import"
  return (
    <BackgroundTasksProvider>
      <AccountPreferences />
      <PageTabsProvider>
        <SidebarProvider
          defaultOpen={readSidebarCookie()}
          keyboardShortcutEnabled={enabled}
          style={{ "--sidebar-width": "15rem" } as CSSProperties}
        >
          <AppSidebar />
          <SidebarInset className="h-svh min-w-0 overflow-hidden">
            <SiteHeader />
            <div className={`${importing ? "hidden" : "flex"} min-h-0 flex-1 flex-col`}>
              <PageTabPanels />
            </div>
            <ImportWorkspaceHost />
          </SidebarInset>
        </SidebarProvider>
      </PageTabsProvider>
    </BackgroundTasksProvider>
  )
}
