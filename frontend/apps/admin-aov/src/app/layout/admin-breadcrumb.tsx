import { useMemo, type ReactNode } from "react"
import { Link, matchRoutes, useLocation, type UIMatch } from "react-router"
import { ChevronRight } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { breadcrumbRoutes } from "./breadcrumb-routes"
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

/** Where the open page sits in Admin; every step but the last is a link back. Replaces the old row of page tabs. */
export function AdminBreadcrumb() {
  const { pathname } = useLocation()
  const steps = useMemo(() => breadcrumbTrail(pathname), [pathname])
  return (
    <nav aria-label="Vị trí trang" className="min-w-0 flex-1">
      <ol className="flex min-w-0 items-center gap-1 type-body">
        {steps.map((step, index) => {
          const last = index === steps.length - 1
          return (
            <li
              key={step.to}
              className={cn(
                "flex min-w-0 items-center gap-1",
                last ? "font-semibold text-foreground" : "shrink",
                // On phones only the page itself and the step right above it stay.
                index < steps.length - 2 && "max-md:hidden",
              )}
            >
              {index > 0 && (
                <ChevronRight
                  aria-hidden="true"
                  className={cn("size-3.5 shrink-0 text-muted-foreground/60", !last && "max-md:hidden")}
                />
              )}
              {last ? (
                <span aria-current="page" className="truncate">
                  {step.label}
                </span>
              ) : (
                <Link
                  to={step.to}
                  className="truncate rounded-sm px-1 text-muted-foreground transition-colors hover:text-foreground"
                >
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
