import { Navigate, useLocation } from "react-router"

/** Sends an old address to where its page moved, keeping the query and hash, so saved links keep working. */
export function MovedRedirect({ to }: { to: string }) {
  const location = useLocation()
  return <Navigate to={to + location.search + location.hash} replace />
}
