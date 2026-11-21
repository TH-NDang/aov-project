import { cn } from "@aov/ui/lib/utils"
import { PAGE_MAX_WIDTH } from "@/components/page-header"
import { useMemo, type ReactNode } from "react"
import { Link, matchRoutes, useLocation, type UIMatch } from "react-router"
import { ChevronRight } from "lucide-react"
import { breadcrumbRoutes } from "./breadcrumb-routes"
import { activeNavItem } from "@/app/nav"
import type { RouteHandle } from "./site-header"

type Step = { to: string; label: ReactNode }

/**
 * The pages above the current one, read from the path: each leading part of it that is a page of its own becomes a step,
 * so a match shows the tournaments list, then the tournament, then the match. Redirect-only routes and the not-found page are left out.
 */
export function breadcrumbTrail(pathname: string): Step[] {
  const segments = pathname.split("/").filter(Boolean)
  const prefixes = ["/", ...segments.map((_, index) => `/${segments.slice(0, index + 1).join("/")}`)]
  const steps: Step[] = []
  for (const prefix of prefixes) {
    const last = matchRoutes(breadcrumbRoutes(), prefix)?.at(-1)
    const handle = last?.route.handle as RouteHandle | undefined
    if (!last || last.route.path === "*" || !handle?.crumb || handle.pageTab === false) continue
    const match = {
      id: last.route.id ?? prefix,
      pathname: last.pathname,
      params: last.params,
      data: undefined,
      loaderData: undefined,
      handle,
    } as UIMatch
    const label = handle.crumb(match)
    // A detail page titled like its list (game modes, twice) adds nothing to the trail.
    const previous = steps.at(-1)
    if (previous && typeof label === "string" && previous.label === label) previous.to = prefix
    else steps.push({ to: prefix, label })
  }
  return steps
}

/**
 * A thin trail above a page that sits under another one (a tournament's match, a hero's translations): the pages above
 * it as links, then its own name. A first-level page and any page the sidebar lists show nothing, since the title and
 * the sidebar already say where the reader is.
 */
export function AdminBreadcrumb() {
  const { pathname } = useLocation()
  // The dashboard is every page's root, so it is left out of the trail.
  const steps = useMemo(() => breadcrumbTrail(pathname).filter((step) => step.to !== "/"), [pathname])
  // A page the sidebar lists (the image workspace under Heroes, say) is reached from there, not from a parent page.
  const navItem = activeNavItem(pathname)
  const ownTrail = (matchRoutes(breadcrumbRoutes(), pathname)?.at(-1)?.route.handle as RouteHandle | undefined)
    ?.ownTrail
  if (steps.length < 2 || ownTrail || navItem?.to.split("?")[0] === pathname) return null
  return (
    <nav aria-label="Vị trí trang" className={cn("mx-auto w-full px-4 pt-3 md:px-6 md:pt-4", PAGE_MAX_WIDTH)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 type-meta">
        {steps.map((step, index) => {
          const last = index === steps.length - 1
          return (
            <li key={step.to} className="flex min-w-0 items-center gap-1">
              {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground/60" />}
              {last ? (
                <span aria-current="page" className="truncate text-foreground">
                  {step.label}
                </span>
              ) : (
                <Link to={step.to} className="truncate rounded-sm hover:text-foreground hover:underline">
                  {step.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
