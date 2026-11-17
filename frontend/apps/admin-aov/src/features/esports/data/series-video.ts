import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/tournament-api"

type GameWriter = Pick<typeof tournamentApi, "read" | "save">

/** A link that reached only some games: says how many carry it, so the editor knows what is left to do. */
export class SeriesVideoError extends Error {
  readonly written: number
  readonly total: number

  constructor(written: number, total: number, cause: unknown) {
    super(
      `Không ghi được liên kết video vào mọi ván: đã ghi ${written} trên ${total} ván, các ván còn lại giữ liên kết cũ. ${tournamentError(cause)}`,
      { cause },
    )
    this.name = "SeriesVideoError"
    this.written = written
    this.total = total
  }
}

/**
 * One broadcast for the whole match: the link is written to every game that does not carry it yet, each keeping its
 * own start second. Each game is read again first, so a game saved a moment ago is not overwritten with an old copy.
 */
export async function writeSeriesVideo(api: GameWriter, games: DocumentView<GameContent>[], url: string) {
  const pending = games.filter((entry) => entry.content.sourceUrl !== url)

  let written = 0
  for (const entry of pending) {
    try {
      const latest = await api.read("games", entry.id)
      await api.save("games", latest, { ...latest.content, sourceUrl: url })
    } catch (cause) {
      throw new SeriesVideoError(written, pending.length, cause)
    }
    written++
  }
  return written
}

/** Writes the link through a mutation, so a failure reaches the editor once, in the shared error toast. */
export function useSeriesVideo(games: DocumentView<GameContent>[]) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (url: string) => writeSeriesVideo(tournamentApi, games, url),
    onSettled: () => client.invalidateQueries({ queryKey: [...tournamentKeys.all, "games"] }),
  })
}
