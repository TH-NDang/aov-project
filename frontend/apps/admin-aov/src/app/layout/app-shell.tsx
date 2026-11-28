import { useRef } from "react"
import { useContentScrollMemory } from "./use-content-scroll-memory"
import { Outlet, useLocation } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "@/app/auth/auth-gate"
import { selfProfile, userKeys } from "@/features/users/user-api"
import { useAccountCurrency } from "@aov/ui/lib/currency"
import { useAccountDateFormat, useAccountTimeZone } from "@aov/ui/lib/time-zone"
import { BackgroundTasksProvider } from "../background-tasks"
import { ImportWorkspaceHost } from "./import-workspace-host"
import { SiteHeader } from "./site-header"
import { AdminNavProvider } from "./nav/admin-nav"
import { CompactNavigation, SideNavigation } from "./nav/navigation"
import "./nav/admin-nav.css"
import { AdminBreadcrumb } from "./admin-breadcrumb"
import { CommandSearchProvider } from "./command-search"

/** Lives in the shell because the account menu is not mounted on phones until its sheet opens. */
function AccountPreferences() {
  const { actor } = useSession()
  const profile = useQuery({
    queryKey: userKeys.selfOf(actor?.issuer, actor?.subject),
    queryFn: ({ signal }) => selfProfile(signal),
    enabled: !!actor,
    refetchInterval: 600000,
  })
  useAccountTimeZone(profile.data)
  useAccountCurrency(profile.data)
  useAccountDateFormat(profile.data)
  return null
}

/** Navigation on the left edge (wide) or along the bottom (compact), content in between. */
export function AppShell() {
  const importing = useLocation().pathname === "/hero/import"
  const content = useRef<HTMLDivElement>(null)
  useContentScrollMemory(content)
  return (
    <BackgroundTasksProvider>
      <AccountPreferences />
      <CommandSearchProvider>
        <AdminNavProvider>
          <div className="adm-shell">
            <SideNavigation />
            <main className="adm-main">
              <SiteHeader content={content} />
              {/* One page at a time; its own scroll region sits under the phone bar and remembers each visit. */}
              <div
                ref={content}
                className={`${importing ? "hidden" : "flex"} min-h-0 min-w-0 flex-1 flex-col overflow-auto`}
              >
                <AdminBreadcrumb />
                <Outlet />
              </div>
              <ImportWorkspaceHost />
              <CompactNavigation content={content} />
            </main>
          </div>
        </AdminNavProvider>
      </CommandSearchProvider>
    </BackgroundTasksProvider>
  )
}
