import { Navigate, useSearchParams } from "react-router"

/** The old team and player registry moved to /teams and /players; links to it keep working. */
export function LegacyRegistryRedirect() {
  const [params] = useSearchParams()
  const pathname = params.get("tab") === "players" ? "/players" : "/teams"
  const search = new URLSearchParams(params)
  search.delete("tab")
  return <Navigate to={{ pathname, search: search.toString() }} replace />
}
