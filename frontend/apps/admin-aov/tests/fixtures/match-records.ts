/** Records of one match between Azure ("a") and Crimson ("b") for the tests of the match page and its actions. */
import type { DocumentView, GameContent, Lane, SeriesContent, Side } from "@aov/community-contracts"
import type { TeamView } from "../../src/features/esports/model/game-view"
import { initialGame } from "../../src/features/tournaments/model/tournament-model"

export const view = <T>(id: string, content: T, extra: Partial<DocumentView<T>> = {}): DocumentView<T> => ({
  id,
  version: 1,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  missingFields: [],
  content,
  ...extra,
})

export const team = (id: string): TeamView =>
  id === "a"
    ? { id, name: "Azure", shortName: "AZU" }
    : id === "b"
      ? { id, name: "Crimson", shortName: "CRI" }
      : { id, name: `Team ${id}`, shortName: id.toUpperCase() }

/** A match of tournament "t"; `score` is its recorded result. */
export const match = (score?: [number, number], extra: Partial<SeriesContent> = {}, id = "s") =>
  view<SeriesContent>(id, {
    code: id,
    tournamentId: "t",
    teamAId: "a",
    teamBId: "b",
    bestOf: 5,
    scheduledAt: "2026-09-10T10:00:00Z",
    sourceUrl: "https://example.test/match",
    result: score
      ? { scoreA: score[0], scoreB: score[1], sourceUrl: "https://example.test/score", verification: "PRIMARY" }
      : null,
    ...extra,
  })

/** An empty game of the match; Azure plays blue unless `azure` says otherwise. */
export const game = (number: number, winner: "a" | "b" | null = null, extra: Partial<GameContent> = {}) => {
  const content: GameContent = { ...initialGame("s", match().content, number), ...extra }
  const side = content.sides.find((entry) => entry.teamId === winner)?.side ?? null
  return view<GameContent>(`g${number}`, { ...content, winner: extra.winner ?? side })
}

/** The game with one seat changed. */
export const seat = (
  entry: DocumentView<GameContent>,
  side: Side,
  lane: Lane,
  change: Partial<GameContent["sides"][number]["participants"][number]>,
): DocumentView<GameContent> => ({
  ...entry,
  content: {
    ...entry.content,
    sides: entry.content.sides.map((current) =>
      current.side !== side
        ? current
        : {
            ...current,
            participants: current.participants.map((participant) =>
              participant.lane === lane ? { ...participant, ...change } : participant,
            ),
          },
    ),
  },
})

/** A game with everything publishing asks for. */
export const completeGame = (number: number, winner: "a" | "b", extra: Partial<DocumentView<GameContent>> = {}) => {
  const entry = game(number, winner, { durationSeconds: 900 })
  return {
    ...entry,
    content: {
      ...entry.content,
      sides: entry.content.sides.map((side) => ({
        ...side,
        bans: side.bans.map((_, index) => ({ id: null, name: `${side.side} ban ${index}` })),
        participants: side.participants.map((participant) => ({
          ...participant,
          playerId: `${side.teamId}-${participant.lane}`,
          hero: { id: null, name: `${side.side} ${participant.lane}` },
          spell: { id: null, name: "Flicker" },
        })),
      })),
    },
    ...extra,
  }
}
