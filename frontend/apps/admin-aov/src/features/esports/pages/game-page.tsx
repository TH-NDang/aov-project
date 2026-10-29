import { Navigate, useParams, useSearchParams } from "react-router"
import { matchPath } from "./esports-shell"

/** Games are watched inside their match's broadcast; older game links open the match at that game. */
export function GamePage() {
  const { tournamentId = "", seriesId = "", gameId = "" } = useParams()
  const [params] = useSearchParams()
  const next = new URLSearchParams(params)
  next.set("game", gameId)
  // A `t` on old game links was the game clock; the match page reads video seconds, so it is not carried over.
  next.delete("t")
  return <Navigate replace to={`${matchPath(tournamentId, seriesId)}?${next}`} />
}
