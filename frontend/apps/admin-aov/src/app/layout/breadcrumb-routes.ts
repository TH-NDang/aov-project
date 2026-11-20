import type { RouteObject } from "react-router"

let registered: RouteObject[] = []

/**
 * The router hands its routes over here, so the header can build the breadcrumb from them without importing the router
 * (which imports the shell and the header).
 */
export function setBreadcrumbRoutes(routes: RouteObject[]) {
  registered = routes
}

export function breadcrumbRoutes() {
  return registered
}
