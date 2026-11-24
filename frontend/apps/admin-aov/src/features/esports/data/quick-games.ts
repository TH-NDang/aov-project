import type { GameContent, SeriesContent } from "@aov/community-contracts"
import { tournamentError, type tournamentApi } from "@/features/tournaments/api/tournament-api"
import { initialGame } from "@/features/tournaments/model/tournament-model"
import { gameWinner, withQuickResult, type MatchTeam, type QuickRow } from "../model/series-score"

export type QuickEntry = { row: QuickRow; winner: MatchTeam | null; durationSeconds: number | null }

/** A quick entry that reached only some games: says how many are written, so the editor knows what is left. */
export class QuickGamesError extends Error {
  readonly written: number

  constructor(written: number, total: number, cause: unknown) {
    super(`Đã ghi ${written} trên ${total} ván. ${tournamentError(cause)}`, { cause })
    this.name = "QuickGamesError"
    this.written = written
  }
}

/** A game recorded only by who won it and how long it took; sides start as the schedule lists the teams. */
export function quickGame(
  series: { id: string; content: SeriesContent },
  number: number,
  winner: MatchTeam | null,
  durationSeconds: number | null,
  region?: string,
): GameContent {
  const game = initialGame(series.id, series.content, number, region)
  return withQuickResult(series.content, game, winner, durationSeconds)
}

/**
 * Makes the missing games and closes the open ones, in game order. A recorded game is read again first; a winner
 * somebody recorded meanwhile stays.
 */
export async function writeQuickGames(
  api: Pick<typeof tournamentApi, "create" | "read" | "save">,
  series: { id: string; content: SeriesContent },
  entries: readonly QuickEntry[],
  region?: string,
) {
  const ordered = [...entries].sort((a, b) => a.row.number - b.row.number)
  let written = 0
  for (const { row, winner, durationSeconds } of ordered) {
    try {
      if (!row.entry) await api.create("games", quickGame(series, row.number, winner, durationSeconds, region))
      else {
        const latest = await api.read("games", row.entry.id)
        if (!gameWinner(series.content, latest.content))
          await api.save("games", latest, withQuickResult(series.content, latest.content, winner, durationSeconds))
      }
    } catch (cause) {
      throw new QuickGamesError(written, ordered.length, cause)
    }
    written++
  }
  return written
}
