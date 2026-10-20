import { Navigate, useLocation } from "react-router"

export function canonicalHeroUrl(pathname: string, search = "", hash = "") {
  return pathname.replace(/^\/publishing(?=\/|$)/, "/hero") + search + hash
}
export function LegacyHeroRedirect() {
  const location = useLocation()
  return <Navigate to={canonicalHeroUrl(location.pathname, location.search, location.hash)} replace />
}
