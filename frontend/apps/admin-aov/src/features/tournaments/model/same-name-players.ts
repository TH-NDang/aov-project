/** An active player the server found under the name of a player being created (spec 04, players with the same name). */
export interface SameNamePlayer {
  id: string
  code: string
  nickname: string
  country: string
}

/** The players a refused create names, or null when the error is about something else. */
export function sameNamePlayers(error: unknown): SameNamePlayer[] | null {
  const problem = error as { code?: string; problem?: { players?: unknown } } | null
  if (problem?.code !== "TOURNAMENT_PLAYER_SAME_NAME") return null
  const players = problem.problem?.players
  return Array.isArray(players) ? (players as SameNamePlayer[]) : []
}
